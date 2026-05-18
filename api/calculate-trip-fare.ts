import { z } from "zod";

const schema = z.object({
  originAddress: z.string().min(3),
  campus: z.string().min(1),
});

const BASE_RATE = 6;       // NLe per km
const MIN_FARE = 20;       // NLe — applied for trips under 5km
const MIN_DISTANCE_KM = 5; // threshold for minimum fare

// ============================================================
// PLACEHOLDER: Approximate road distances (km) from known
// Freetown pickup areas to each campus.
// Replace with real Google Maps Distance Matrix API call by
// setting GOOGLE_MAPS_API_KEY in your environment variables.
// ============================================================
const MOCK_DISTANCES: Record<string, Record<string, number>> = {
  "lumley":       { "Fourah Bay College": 14.2, "IPAM Tower Hill": 12.8, "Njala University": 182, "Limkokwing": 11.5 },
  "aberdeen":     { "Fourah Bay College": 12.1, "IPAM Tower Hill": 10.5, "Njala University": 180, "Limkokwing": 9.8  },
  "model":        { "Fourah Bay College": 11.0, "IPAM Tower Hill": 9.2,  "Njala University": 178, "Limkokwing": 8.5  },
  "wilberforce":  { "Fourah Bay College": 10.0, "IPAM Tower Hill": 5.0,  "Njala University": 176, "Limkokwing": 7.0  },
  "congo cross":  { "Fourah Bay College": 8.5,  "IPAM Tower Hill": 6.2,  "Njala University": 174, "Limkokwing": 6.0  },
  "murray town":  { "Fourah Bay College": 9.0,  "IPAM Tower Hill": 7.0,  "Njala University": 175, "Limkokwing": 7.5  },
  "kingtom":      { "Fourah Bay College": 9.5,  "IPAM Tower Hill": 6.5,  "Njala University": 175, "Limkokwing": 7.0  },
  "brookfields":  { "Fourah Bay College": 11.5, "IPAM Tower Hill": 8.5,  "Njala University": 177, "Limkokwing": 9.0  },
  "tower hill":   { "Fourah Bay College": 7.0,  "IPAM Tower Hill": 1.5,  "Njala University": 173, "Limkokwing": 5.5  },
  "central":      { "Fourah Bay College": 8.0,  "IPAM Tower Hill": 4.0,  "Njala University": 174, "Limkokwing": 6.0  },
};

const DEFAULT_DISTANCE_KM = 9; // fallback for unknown pickup areas

const getMockDistance = (origin: string, campus: string): number => {
  const key = origin.toLowerCase().trim();
  // Try exact match first, then partial match
  const exactMatch = MOCK_DISTANCES[key];
  if (exactMatch && exactMatch[campus] !== undefined) {
    return exactMatch[campus];
  }
  // Try partial match (e.g. "Lumley Junction" → matches "lumley")
  for (const [area, campuses] of Object.entries(MOCK_DISTANCES)) {
    if (key.includes(area) && campuses[campus] !== undefined) {
      return campuses[campus];
    }
  }
  return DEFAULT_DISTANCE_KM;
};

const callOSRM = async (origin: string, campus: string): Promise<number> => {
  // Hardcode campus coordinates (longitude, latitude) to save API calls
  const campusCoords: Record<string, string> = {
    "Fourah Bay College": "-13.2134,8.4844",
    "IPAM Tower Hill": "-13.2355,8.4811",
    "Njala University": "-13.2389,8.4833", // Freetown branch approx
    "Limkokwing": "-13.2678,8.4689",
  };

  const destCoords = campusCoords[campus];
  if (!destCoords) {
    throw new Error(`Unknown campus for routing: ${campus}`);
  }

  // 1. Geocode the origin address using OpenStreetMap Nominatim
  const originQuery = encodeURIComponent(`${origin}, Freetown, Sierra Leone`);
  const geoUrl = `https://nominatim.openstreetmap.org/search?q=${originQuery}&format=json&limit=1`;
  
  const geoResponse = await fetch(geoUrl, {
    headers: { "User-Agent": "EasiRideApp/1.0" } // Nominatim requires a User-Agent
  });
  const geoData = await geoResponse.json();

  if (!geoData || geoData.length === 0) {
    throw new Error(`Could not find origin: ${origin}`);
  }

  const originCoords = `${geoData[0].lon},${geoData[0].lat}`;

  // 2. Get driving distance using OSRM (Open Source Routing Machine)
  const dirUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords};${destCoords}?overview=false`;
  const dirResponse = await fetch(dirUrl);
  const dirData = await dirResponse.json();

  if (dirData.code !== "Ok" || !dirData.routes || dirData.routes.length === 0) {
    throw new Error(`Routing failed: ${dirData.code}`);
  }

  // distance is in meters -> convert to km
  return dirData.routes[0].distance / 1000;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { originAddress, campus } = parsed.data;
  // We no longer need an API key for OSRM, so we can always try it first
  let distanceKm: number;
  let isEstimate = false;

  try {
    distanceKm = await callOSRM(originAddress, campus);
  } catch (err) {
    console.error("Distance calculation error:", err);
    // Fall back to mock if OSRM fails (e.g. rate limit)
    distanceKm = getMockDistance(originAddress, campus);
    isEstimate = true;
  }

  const rawFare = BASE_RATE * distanceKm;
  const fareAmount = distanceKm < MIN_DISTANCE_KM ? MIN_FARE : Math.round(rawFare);

  return res.status(200).json({
    distanceKm: Math.round(distanceKm * 10) / 10,  // 1 decimal place
    fareAmount,
    isEstimate,        // true when using placeholder distances
    minimumApplied: distanceKm < MIN_DISTANCE_KM,
  });
}
