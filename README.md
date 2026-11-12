*Read this in other languages: [Español](README_es.md)*
# Uber Eats Restaurants Analytics: MongoDB Data Engineering & Analytics Project

## Project Overview

This project presents an end-to-end data engineering and analytics workflow using **MongoDB** as the main analytical data store, based on a real-world dataset of **63k+ Uber Eats USA restaurants**.

It demonstrates MongoDB beyond storage, covering:

- Data validation  
- Index optimization  
- Analytical queries  
- KPI computation  
- Geospatial analysis  

The pipeline integrates **Python (ETL)** with **MongoDB** to simulate a production-ready analytics system.

## Key Characteristics

- End-to-end reproducible pipeline  
- MongoDB for storage, indexing, validation, and analytics  
- Python for ETL and transformation  
- Geospatial analysis with GeoJSON   

## Project Objectives

The goal is to build a scalable MongoDB analytics pipeline:

- Ingest and transform CSV data into NoSQL  
- Design an analytics-oriented document schema  
- Implement indexing strategies for performance  
- Ensure data quality at scale  
- Compute KPIs using the aggregation framework  
- Run geospatial and advanced queries  

## Responsibility Split

- **MongoDB**: storage, indexing, validation, aggregations  
- **Python**: ETL, cleaning, transformation  

## Dataset Context

- 63,000+ Uber Eats USA restaurants  
- Real-world scraped metadata  

Enables analysis of:

- Categories and popularity  
- Price vs rating relationships  
- Geographic distribution  
- Review patterns  

## MongoDB Data Modeling

- One document per restaurant  
- Nested address structure  
- Categories as arrays  
- GeoJSON for spatial queries  

MongoDB is used as:

- Analytical database  
- Aggregation engine  
- Geospatial query system  

## ETL Pipeline (Python)

Built with `pandas` + `pymongo`:

- Load CSV data (ZIP codes read as text to keep leading zeros)  
- Clean and normalize: HTML entities, extra spaces, invalid price levels, ZIP+4 → 5-digit ZIP, `(0, 0)` placeholder coordinates, duplicated restaurants  
- Category spelling variants unified (`Burgers` / `burger`, `Coffee and Tea` / `Coffee & Tea`) under the most frequent label  
- Feature engineering (nested fields, GeoJSON)  
- Missing values stored as real `null` (not `NaN`, which breaks `$avg` and `$ne: null` filters)  
- Batch insertion into MongoDB  

## Data Validation Layer

Detects:

- Invalid scores  
- Missing fields  
- Duplicates  
- Incomplete location data  
- Invalid ZIP / price formats and `NaN` values  
- Category spelling variants  

## Indexing Strategy

- `name`, `score`, `ratings`  
- `address.zip_code`  
- 2dsphere index for location  
- Compound index (category, score), which also serves category-only queries (index prefix), so no separate `category` index is needed  

`setup.js` is the single source of truth for indexes: any index not declared there is removed.

Improves filtering, sorting, and geospatial performance.

## Analytics & KPIs

Using MongoDB Aggregation Framework:

- Average rating by category  
- Restaurants per price range  
- Top-rated restaurants  
- Ratings by ZIP code  
- Category frequency  
- Engagement-based metrics  

## Advanced Queries

- Bayesian weighted rating (IMDb formula): ranks restaurants by score while accounting for how many reviews support it  
- Price vs rating analysis  
- High rating / low visibility detection  
- Category filtering  

## Geospatial Analysis

Uses MongoDB operators:

- `$near`  
- `$geoNear`  

Enables:

- Nearby recommendations  
- Proximity search  
- Regional insights  

## How to Run

Requirements: Python 3.12+, MongoDB 7.0+ running on `localhost:27017` and `mongosh`.

```bash
pip install -r requirements.txt
cd scripts
python "1) etl_pipeline.py"
mongosh restaurants_db "2) setup.js"
mongosh restaurants_db "3) data_validation.js"
mongosh restaurants_db "4) advanced_queries.js"
mongosh restaurants_db "5) aggregation_kpis.js"
```

The ETL reads `MONGO_URI` and `MONGO_DB` from environment variables (defaults: `mongodb://localhost:27017` and `restaurants_db`).

## Author

**Armando Guarnera**  
Data Scientist, Argentina