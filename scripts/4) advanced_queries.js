print("\n===============================")
print("1 Top 10 Best Rated Restaurants")
print("===============================\n")
// Ties on score are broken by number of reviews: more reviews, more evidence.
db.restaurants.find(
  { score: { $ne: null } },
  { name: 1, score: 1, ratings: 1, category: 1 }
)
.sort({ score: -1, ratings: -1 })
.limit(10)
.forEach(printjson)


print("\n==============================")
print("2 Restaurants with the most reviews")
print("==============================\n")

db.restaurants.find(
  { ratings: { $ne: null } },
  { name: 1, ratings: 1, score: 1 }
)
.sort({ ratings: -1 })
.limit(10)
.forEach(printjson)


print("\n==============================")
print("3 High-priced restaurants")
print("===============================\n")

db.restaurants.find(
  { price_range: "$$$" },
  { name: 1, price_range: 1, score: 1 }
)
.sort({ score: -1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("4 Restaurants with a score of 4.5 or higher")
print("==============================\n")

// More than 25k restaurants match, so the total is shown and only the top 20 are printed.
print("Total:", db.restaurants.countDocuments({ score: { $gte: 4.5 } }))
db.restaurants.find(
  { score: { $gte: 4.5 } },
  { name: 1, score: 1, ratings: 1 }
)
.sort({ score: -1, ratings: -1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("5 Sushi Restaurants")
print("==============================\n")

// A regex on an array matches if any element matches. Case-insensitive regexes cannot
// use the category index efficiently; fine for an ad-hoc query.
db.restaurants.find(
  { category: /Sushi/i },
  { name: 1, category: 1, score: 1 }
)
.sort({ score: -1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("6 Vegetarian restaurants")
print("==============================\n")

db.restaurants.find(
  { category: /Vegetarian/i },
  { name: 1, category: 1, score: 1 }
)
.sort({ score: -1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("7 Restaurant Count by Price Range")
print("===============================\n")

printjson(
  db.restaurants.aggregate([
    {
      $group: {
        _id: "$price_range",
        total: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]).toArray()
)


print("\n==============================")
print("8 Average score by price range")
print("==============================\n")

printjson(
  db.restaurants.aggregate([
    { $match: { score: { $ne: null } } },
    {
      $group: {
        _id: "$price_range",
        avg_score: { $avg: "$score" },
        total: { $sum: 1 }
      }
    },
    { $sort: { avg_score: -1 } }
  ]).toArray()
)


print("\n==============================")
print("9 Average score per ZIP code (min. 10 rated restaurants)")
print("=============================\n")

printjson(
  db.restaurants.aggregate([
    { $match: { score: { $ne: null }, "address.zip_code": { $ne: null } } },
    {
      $group: {
        _id: "$address.zip_code",
        avg_score: { $avg: "$score" },
        restaurants: { $sum: 1 }
      }
    },
    // A ZIP code with a single restaurant rated 5.0 would top the ranking. A minimum sample size keeps the average meaningful.
    { $match: { restaurants: { $gte: 10 } } },
    { $sort: { avg_score: -1 } },
    { $limit: 10 }
  ]).toArray()
)
  

print("\n==============================")
print("10 Top 10 Restaurant Categories")
print("==============================\n")

printjson(
  db.restaurants.aggregate([
    // One document per category: a restaurant counts once in each of its categories.
    { $unwind: "$category" }, 
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]).toArray()
)

print("\n==============================")
print("11 Restaurants with more than 50 reviews")
print("==============================\n")

print("Total:", db.restaurants.countDocuments({ ratings: { $gt: 50 } }))
db.restaurants.find(
  { ratings: { $gt: 50 } },
  { name: 1, ratings: 1, score: 1 }
)
.sort({ ratings: -1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("12 Restaurants with few reviews but high scores")
print("==============================\n")

// Uber Eats only publishes a score after 10 ratings, so the minimum value of ratings is 10.
// "Few reviews" is defined as 20 or less (roughly the lowest fifth of rated restaurants: 19% of them).
db.restaurants.find(
  {
    score: { $gte: 4.5 },
    ratings: { $lte: 20 }
  },
  { name: 1, score: 1, ratings: 1 }
)
.sort({ score: -1, ratings: 1 })
.limit(20)
.forEach(printjson)


print("\n==============================")
print("13 Count of restaurants by category")
print("=============================\n")

printjson(
  db.restaurants.aggregate([
    { $unwind: "$category" }, 
    {
      $group: {
        _id: "$category",
        total_restaurants: { $sum: 1 }
      }
    },
    { $sort: { total_restaurants: -1 } },
    { $limit: 20 }
  ]).toArray()
)


print("\n==============================")
print("14 Restaurants without score")
print("=============================\n")

// Around 28k restaurants have no score: the total is shown and only a sample is printed.
print("Total:", db.restaurants.countDocuments({ score: null }))
db.restaurants.find(
  { score: null },
  { name: 1, category: 1 }
)
.limit(10)
.forEach(printjson)


print("\n==============================")
print("15 Restaurants without a price range")
print("==============================\n")

// The ETL stores a missing price range as null (not as an empty string).
print("Total:", db.restaurants.countDocuments({ price_range: null }))
db.restaurants.find(
  { price_range: null },
  { name: 1, category: 1 }
)
.limit(10)
.forEach(printjson)


print("\n==============================")
print("16 Average number of reviews per category")
print("==============================\n")

printjson(
  db.restaurants.aggregate([
    { $match: { ratings: { $ne: null } } },
    { $unwind: "$category" }, 
    {
      $group: {
        _id: "$category",
        avg_ratings: { $avg: "$ratings" },
        restaurants: { $sum: 1 }
      }
    },
    // Categories with very few restaurants are excluded so that one outlier does not define the average.
    { $match: { restaurants: { $gte: 30 } } },
    { $sort: { avg_ratings: -1 } },
    { $limit: 20 }
  ]).toArray()
)


print("\n==============================")
print("17 Most Popular Restaurants by Category")
print("==============================\n")

printjson(
  db.restaurants.aggregate([
    // Filtering and sorting before $unwind works on 35k documents (and can use the ratings index) instead of on every category copy.
    { $match: { ratings: { $ne: null } } },
    { $sort: { ratings: -1 } },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category",
        // $first is only meaningful because of the $sort above: $unwind keeps the order,
        // so the first document of each category is its most reviewed restaurant.
        top_restaurant: { $first: "$name" },
        max_ratings: { $first: "$ratings" }
      }
    },
    { $sort: { max_ratings: -1 } },
    { $limit: 20 }
  ]).toArray()
)


print("\n==============================")
print("18 Top 10 restaurants by Bayesian weighted rating")
print("===============================\n")

// A 5.0 with 10 reviews is weaker evidence than a 4.9 with 500. The Bayesian average (the IMDb Top 250 formula)
// pulls every score towards the global mean, and the pull fades as the number of reviews grows:
//   weighted_rating = (v / (v + m)) * R + (m / (v + m)) * C
//   R = restaurant score, v = its number of reviews, C = mean score of all restaurants, m = prior weight.
// m is the median number of reviews: a restaurant needs as many reviews as a typical one before its own score weighs more than the global mean.

// Step 1: C and m are computed from the data, not hardcoded.
// $percentile (MongoDB 7.0+) returns an array with one value per requested percentile.
const prior = db.restaurants.aggregate([
  { $match: { score: { $ne: null }, ratings: { $ne: null } } },
  {
    $group: {
      _id: null,
      C: { $avg: "$score" },
      m: { $percentile: { input: "$ratings", p: [0.5], method: "approximate" } }
    }
  }
]).toArray()[0]
const C = prior.C
const m = prior.m[0]
print(`Global mean score (C): ${C.toFixed(2)} | Prior weight (m, median reviews): ${m}\n`)

// Step 2: weighted rating per restaurant.
printjson(
  db.restaurants.aggregate([
    { $match: { score: { $ne: null }, ratings: { $ne: null } } },
    {
      $addFields: {
        weighted_rating: {
          $add: [
            { $multiply: [{ $divide: ["$ratings", { $add: ["$ratings", m] }] }, "$score"] },
            { $multiply: [{ $divide: [m, { $add: ["$ratings", m] }] }, C] }
          ]
        }
      }
    },
    // Restaurants with the same score and reviews get the same weighted rating: name is only a deterministic tie-breaker.
    { $sort: { weighted_rating: -1, ratings: -1, name: 1 } },
    { $limit: 10 },
    { $project: { name: 1, score: 1, ratings: 1, weighted_rating: { $round: ["$weighted_rating", 3] } } }
  ]).toArray()
)


print("\n==============================")
print("19 Restaurants near a location")
print("==============================\n")

// $near needs the 2dsphere index and returns the closest first. The point is downtown
// Birmingham, AL, in GeoJSON order [lng, lat]; $maxDistance is in meters.
db.restaurants.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-86.80, 33.51]
      },
      $maxDistance: 3000
    }
  }
},
{ name: 1, "address.full_address": 1, score: 1 }
)
.limit(10)
.forEach(printjson)


print("\n==============================")
print("20 Best rated restaurants within a 5 km radius")
print("===============================\n")

// Unlike $near, $geoNear lets the result be re-sorted by another field (score) after the
// distance filter. It must be the first stage of the pipeline; distances are in meters.
printjson(
  db.restaurants.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [-86.80, 33.51]
        },
        distanceField: "distance",
        spherical: true,
        maxDistance: 5000,
        // Filtered inside the geo search itself, so unrated restaurants never reach the next stages.
        query: { score: { $ne: null } }
      }
    },
    { $sort: { score: -1, distance: 1 } },
    { $limit: 10 },
    {
      $project: {
        name: 1,
        score: 1,
        distance_m: { $round: ["$distance", 0] }
      }
    }
  ]).toArray()
)