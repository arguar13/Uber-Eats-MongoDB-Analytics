print("\n======================================")
print("DATA VALIDATION CHECKS")
print("======================================\n")

// 1. Scores out of range
print("1 Scores greater than 5 (should be 0)")
printjson(db.restaurants.countDocuments({ score: { $gt: 5 } }))

// 2. Negative Scores
print("\n2 Negative scores (should be 0)")
printjson(db.restaurants.countDocuments({ score: { $lt: 0 } }))

// 3. Negative Ratings
print("\n3 Negative Ratings (should be 0)")
printjson(db.restaurants.countDocuments({ ratings: { $lt: 0 } }))

// 4. Documents without a name
print("\n4 Documents without a name")
printjson(db.restaurants.countDocuments({ name: { $in: [null, ""] } }))

// 5. Empty Categories
print("\n5 Uncategorized Documents")
printjson(db.restaurants.countDocuments({ category: { $size: 0 } }))

// 6. No geographic location
print("\n6 No location")
printjson(db.restaurants.countDocuments({ location: null }))

// 7. ZIP code missing
print("\n7 Without ZIP code")
printjson(db.restaurants.countDocuments({ "address.zip_code": null }))

// 7b. ZIP code with invalid format
print("\n7b ZIP code not in 5-digit format (should be 0)")
// Anything that is not exactly 5 digits; a NaN would also be caught here.
printjson(db.restaurants.countDocuments({ "address.zip_code": { $ne: null, $not: /^\d{5}$/ } }))

// 8. Invalid price range
print("\n8 Invalid price range (should be 0)")
// null means "unknown" and is allowed.
printjson(db.restaurants.countDocuments({ price_range: { $nin: [null, "$", "$$", "$$$", "$$$$"] } }))

// 9. NaN values
print("\n9 NaN scores or ratings (should be 0)")
// NaN is a number in MongoDB, not null: it passes {$ne: null} filters and turns every $avg into NaN.
printjson(db.restaurants.countDocuments({ $or: [{ score: NaN }, { ratings: NaN }] }))

// 10. Exact duplicates (same name and same address): restaurants loaded more than once
print("\n10 Duplicates by name + address (should be 0)")
printjson(
  db.restaurants.aggregate([
    // Documents without an address cannot be compared, so they are excluded.
    { $match: { "address.full_address": { $ne: null } } },
    {
      $group: {
        _id: { name: "$name", address: "$address.full_address" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $count: "duplicated_groups" }
  ]).toArray()
)

// 11. Repeated names
// The same name at different addresses is usually a chain, not an error. Only the 10 most repeated are shown.
print("\n11 Most repeated names (chains, not errors)")
printjson(
  db.restaurants.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray()
)

// 12. Category spelling variants
// Two labels that only differ in case, "&" vs "and", spaces or separators ("Coffee & Tea" / "coffee and tea", "Barfood" / "Bar Food") split one category in two.
print("\n12 Category spelling variants (should be [])")
printjson(
  db.restaurants.aggregate([
    { $unwind: "$category" },
    { $group: { _id: "$category" } },
    {
      // Same idea as category_key() in the ETL (without the plural rule): lowercase,
      // "&" -> "and", alphanumerics only.
      $project: {
        key: {
          $trim: {
            input: {
              $reduce: {
                input: { $regexFindAll: { input: { $replaceAll: { input: { $toLower: "$_id" }, find: "&", replacement: " and " } }, regex: /[a-z0-9]+/ } },
                initialValue: "",
                in: { $concat: ["$$value", "$$this.match"] }
              }
            }
          }
        }
      }
    },
    // $addToSet collects the distinct labels that share a key. More than one label means spelling variants.
    { $group: { _id: "$key", variants: { $addToSet: "$_id" } } },
    { $match: { "variants.1": { $exists: true } } }
  ]).toArray()
)

print("\n✅ Validation completed\n")