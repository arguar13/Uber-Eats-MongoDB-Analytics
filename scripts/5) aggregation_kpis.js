print("\n======================================")
print("KPI 1: Average Rating by Category (min. 30 rated restaurants)")
print("========================================\n")

printjson(
  db.restaurants.aggregate([
    // Only rated restaurants: otherwise total_restaurants would count restaurants that do not take part in the average.
    { $match: { score: { $ne: null } } },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category",
        avg_rating: { $avg: "$score" },
        total_restaurants: { $sum: 1 }
      }
    },
    // Minimum sample size: a category with 1-2 restaurants rated 5.0 is not comparable with one of 5,000.
    { $match: { total_restaurants: { $gte: 30 } } },
    { $sort: { avg_rating: -1 } },
    { $limit: 15 },
    { $set: { avg_rating: { $round: ["$avg_rating", 2] } } }
  ]).toArray()
)


print("\n======================================")
print("KPI 2: Number of Restaurants by Price Range")
print("========================================\n")

printjson(
  db.restaurants.aggregate([
    {
      $group: {
        _id: "$price_range",
        total_restaurants: { $sum: 1 }
      }
    },
    { $sort: { total_restaurants: -1 } }
  ]).toArray()
)


print("\n======================================")
print("KPI 3: Top 10 Restaurants by Rating")
print("========================================\n")

printjson(
  db.restaurants.aggregate([
    { $match: { score: { $ne: null } } },
    { $sort: { score: -1, ratings: -1 } },
    { $limit: 10 },
    {$project: {name: 1, score: 1, ratings: 1, category: 1}}
  ]).toArray()
)


print("\n======================================")
print("KPI 4: Average Rating by ZIP Code (min. 10 rated restaurants)")
print("========================================\n")

printjson(
  db.restaurants.aggregate([
    { $match: { score: { $ne: null }, "address.zip_code": { $ne: null } } },
    {
      $group: {
        _id: "$address.zip_code",
        avg_rating: { $avg: "$score" },
        total_restaurants: { $sum: 1 }
      }
    },
    { $match: { total_restaurants: { $gte: 10 } } },
    { $sort: { avg_rating: -1 } },
    { $limit: 15 },
    { $set: { avg_rating: { $round: ["$avg_rating", 2] } } }
  ]).toArray()
)


print("\n======================================")
print("KPI 5: Most Common Restaurant Categories")
print("======================================\n")

printjson(
  db.restaurants.aggregate([
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray()
)


print("\n======================================")
print("KPI 6: Restaurants with More Than 50 Reviews")
print("========================================\n")

// $facet runs several sub-pipelines over the same input: the total count and the top 20 in a single query.
printjson(
  db.restaurants.aggregate([
    {$match: {ratings: { $gt: 50 }}},
    {
      $facet: {
        total: [{ $count: "restaurants" }],
        top_20: [
          { $sort: { score: -1, ratings: -1 } },
          { $limit: 20 },
          {$project: {name: 1, score: 1, ratings: 1, category: 1}}
        ]
      }
    }
  ]).toArray()
)