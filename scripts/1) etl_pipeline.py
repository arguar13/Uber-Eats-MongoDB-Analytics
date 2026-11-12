"""ETL: Uber Eats restaurants CSV -> MongoDB `restaurants` collection.

Cleans the scraped fields, turns categories into canonical arrays and coordinates into
GeoJSON points, then reloads the whole collection, so re-running it is safe.
"""
import html
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
from pymongo import MongoClient

# Overridable through the environment to point the pipeline at another server or database.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB", "restaurants_db")
COLLECTION_NAME = "restaurants"
# Resolved from this file (scripts/ -> project root -> data/), not from the working directory.
CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "restaurants.csv"

# Valid Uber Eats price levels. Anything else (e.g. "$$$$$$$$$$$$$$$$$") is treated as a scraping error.
VALID_PRICE_RANGES = {"$", "$$", "$$$", "$$$$"}


def load_data(path):
    print("\nLoading CSV...")
    # zip_code is read as text: as a number it would lose leading zeros (e.g. "02108" -> 2108).
    df = pd.read_csv(path, dtype={"zip_code": str})
    print(f"Original rows: {len(df)}")
    return df


def normalize_zip(zip_code):
    """Normalize a ZIP code to the 5-digit US format, or None if it is not a ZIP code.

    "35233-1944" (ZIP+4) -> "35233", "260623720" (ZIP+4 without dash) -> "26062",
    "3574" (lost leading zero) -> "03574", "United States" / "WA" / "Milwaukee" -> None.
    """
    if pd.isna(zip_code):
        return None

    digits = str(zip_code).strip().split("-")[0]
    if not digits.isdigit():
        return None
    if len(digits) == 9:
        return digits[:5]
    if 3 <= len(digits) <= 5:
        return digits.zfill(5)
    return None


def clean_data(df):
    """Fix types and text, null out invalid values and drop unnamed or duplicated restaurants."""
    df = df.copy()

    df.columns = df.columns.str.strip().str.lower()

    # Non-numeric scraped values become NaN instead of breaking the cast.
    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df["ratings"] = pd.to_numeric(df["ratings"], errors="coerce")

    df["price_range"] = df["price_range"].where(df["price_range"].isin(VALID_PRICE_RANGES), np.nan)

    df["zip_code"] = df["zip_code"].apply(normalize_zip)

    # (0, 0) is a placeholder used by the source when the location is unknown, not a real restaurant position.
    unknown_location = (df["lat"] == 0) | (df["lng"] == 0)
    df.loc[unknown_location, ["lat", "lng"]] = np.nan

    # The scraper left HTML entities ("Coffee &amp; Tea") and trailing spaces
    # ("The Ice Cream Shop "), which would otherwise split one restaurant into two.
    for column in ["name", "category", "full_address"]:
        df[column] = df[column].map(html.unescape, na_action="ignore").str.strip()

    # Empty strings count as missing names too.
    df["name"] = df["name"].replace("", np.nan)
    df = df.dropna(subset=["name"])

    # Duplicates = same name at the same address. Rows without an address are kept:
    # several stores of a chain can share the name and have no address.
    duplicated = df.duplicated(subset=["name", "full_address"]) & df["full_address"].notna()
    df = df[~duplicated]

    return df


def clean_category(category):
    """Comma-separated category string -> list of trimmed, non-empty labels."""
    if pd.isna(category):
        return []

    return [
        c.strip()
        for c in str(category).split(",") if c.strip()
    ]


def category_key(category):
    """Spelling-insensitive key, so every variant of a category maps to the same value.

    The source mixes "Burgers" / "burger", "Coffee and Tea" / "Coffee & Tea",
    "Sandwich" / "Sandwiches", "Vegetarian Friendly" / "Vegetarian-Friendly" and
    "Barfood" / "Bar Food": the key ignores case, "&" vs "and", separators and plurals.
    """
    text = category.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)

    words = []
    for word in text.split():
        if word.endswith(("ches", "shes", "xes", "sses")):
            word = word[:-2]
        elif word.endswith("ies") and len(word) > 4:
            word = word[:-3] + "y"
        elif word.endswith("s") and not word.endswith("ss") and len(word) > 3:
            word = word[:-1]
        words.append(word)

    return "".join(words)


def build_category_map(category_lists):
    """Map every category variant to its canonical label: the most frequent spelling.

    Letting the data choose the label avoids maintaining a manual synonyms dictionary.
    """
    counts = pd.Series([c for categories in category_lists for c in categories]).value_counts()

    canonical = {}
    for category in counts.index:  # value_counts() is sorted by frequency, so the first variant seen for a key wins
        canonical.setdefault(category_key(category), category)

    return {category: canonical[category_key(category)] for category in counts.index}


def engineer_features(df):
    """Reshape the flat CSV row into the document model: category array, address and GeoJSON."""
    df = df.copy()

    df["category"] = df["category"].apply(clean_category)

    # dict.fromkeys() drops the duplicates canonicalisation can create
    # ("Sandwich" + "Sandwiches" in the same restaurant) while keeping the order.
    category_map = build_category_map(df["category"])
    df["category"] = df["category"].apply(lambda categories: list(dict.fromkeys(category_map[c] for c in categories)))

    df["address"] = [
        {
            # Nested fields are not covered by to_documents(), so NaN is converted to None here.
            "full_address": None if pd.isna(address) else address,
            "zip_code": None if pd.isna(zip_code) else zip_code
        }
        for address, zip_code in zip(df["full_address"], df["zip_code"])
    ]

    # GeoJSON stores coordinates as [longitude, latitude], the opposite order of the CSV columns.
    df["location"] = [
        None if pd.isna(lat) or pd.isna(lng)
        else {
            "type": "Point",
            "coordinates": [float(lng), float(lat)]
        }
        for lat, lng in zip(df["lat"], df["lng"])
    ]

    # Now nested inside `address` and `location`.
    df = df.drop(columns=["full_address", "zip_code", "lat", "lng"])

    return df


def to_documents(df):
    """DataFrame rows -> dicts, with every NaN scalar replaced by None.

    pymongo would store NaN as a number, and in MongoDB NaN is not null:
    {score: {$ne: null}} would match it and {$avg: "$score"} would return NaN.
    """
    records = df.to_dict(orient="records")

    return [
        {
            key: None if isinstance(value, float) and np.isnan(value) else value
            for key, value in record.items()
        }
        for record in records
    ]


def load_to_mongo(collection, records):
    """Full reload: empty the collection, then insert every document.

    Not atomic: readers see an empty collection until insert_many() finishes. A shared
    deployment would load a staging collection and rename it over the live one.
    """
    print("\nCleaning up the collection... ")
    collection.delete_many({})

    print("Entering data...")
    collection.insert_many(records)

    print("✅ ETL completed successfully")


def quick_check(collection):
    """Print a few counts to sanity-check the load."""
    print("\nQuick Check:")
    print("Total documents:", collection.count_documents({}))
    print("With location:", collection.count_documents({"location": {"$ne": None}}))
    # "category.0" exists only when the array has at least one element.
    print("With categories:", collection.count_documents({"category.0": {"$exists": True}}))
    print("With score:", collection.count_documents({"score": {"$type": "number"}}))


def main():
    df = load_data(CSV_PATH)

    print("\nData Cleaning...")
    df = clean_data(df)
    print(f"Rows after cleaning: {len(df)}")

    print("\nFeature Engineering...")
    df = engineer_features(df)
    records = to_documents(df)

    with MongoClient(MONGO_URI) as client:
        collection = client[DB_NAME][COLLECTION_NAME]
        load_to_mongo(collection, records)
        quick_check(collection)


if __name__ == "__main__":
    main()
