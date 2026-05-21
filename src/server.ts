import express from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const app = express();
app.use(express.json());

// Import API handlers (default export functions)
const reverseGeocode = require("../api/reverse-geocode").default;
const calculateTripFare = require("../api/calculate-trip-fare").default;
// Add other handlers as needed, e.g.:
// const searchLocations = require("../api/search-locations").default;

// Register routes
app.post("/api/reverse-geocode", reverseGeocode);
app.post("/api/calculate-trip-fare", calculateTripFare);
// app.get("/api/search-locations", searchLocations);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API server listening on http://localhost:${PORT}`);
});
