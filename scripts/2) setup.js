print("\n======================================")
print("AUTOMATIC DATABASE SETUP")
print("======================================\n")

// Idempotent: every step can be re-run against an existing database.
if (!db.getCollectionNames().includes("restaurants")) {
  db.createCollection("restaurants")
  print("✅ Collection created")
} else {
  print("ℹ️ Collection already exists")
}

print("\nCreating indexes...")

print("Index: name")
printjson(db.restaurants.createIndex({ name: 1 }))

// A single index on category is not created: the compound index (category + score) below already covers
// every query that filters only by category, because MongoDB can use any prefix of a compound index.

print("\nIndex: score")
printjson(db.restaurants.createIndex({ score: -1 }))

print("\nIndex: ratings")
printjson(db.restaurants.createIndex({ ratings: -1 }))

print("\nIndex: zip_code")
printjson(db.restaurants.createIndex({ "address.zip_code": 1 }))

print("\nIndex: geospatial location")
// Required by $near / $geoNear on the GeoJSON points.
printjson(db.restaurants.createIndex({ location: "2dsphere" }))

print("\nIndex: compound (category + score)")
// Serves "best rated in category X" without an in-memory sort. On an array field it is a
// multikey index: one entry per category of each restaurant.
printjson(db.restaurants.createIndex({ category: 1, score: -1 }))

print("✅ Indexes created")

// This script is the single source of truth for the indexes of the collection.
// Any other index (left by an older schema or created by hand) costs storage and slows down every insert, so it is removed.
// The _id_ index is mandatory in MongoDB and is always kept.
const expectedIndexes = ["_id_", "name_1", "score_-1", "ratings_-1", "address.zip_code_1", "location_2dsphere", "category_1_score_-1"]

db.restaurants.getIndexes()
  .filter(idx => !expectedIndexes.includes(idx.name))
  .forEach(idx => {
    db.restaurants.dropIndex(idx.name)
    print(`Unexpected index removed: ${idx.name}`)
  })

print("\nValidating document structure (schema check)...")

const totalDocs = db.restaurants.countDocuments()

if (totalDocs === 0) {
  print("No data in the collection")
} else {

  // A document missing any top-level field of the model counts as invalid.
  const invalidDocs = db.restaurants.countDocuments({
    $or: [
      { name: { $exists: false } },
      { category: { $exists: false } },
      { address: { $exists: false } },
      { location: { $exists: false } }
    ]
  })

  if (invalidDocs > 0) {
    print(`Documents with invalid structure: ${invalidDocs}`)
  } else {
    print("All documents have a valid structure")
  }
}

print("\nSummary:")
print("Total documents:", db.restaurants.countDocuments())

print("\n======================================")
print("SETUP COMPLETED")
print("======================================\n")