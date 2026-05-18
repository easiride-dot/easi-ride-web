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
  const mockDistances: Record<string, Record<string, number>> = {
    "Lumley": { "Fourah Bay College": 12, "IPAM Tower Hill": 8, "Njala University": 10, "Limkokwing": 6 },
    "Aberdeen": { "Fourah Bay College": 14, "IPAM Tower Hill": 9, "Njala University": 11, "Limkokwing": 7 },
    "Wilberforce": { "Fourah Bay College": 10, "IPAM Tower Hill": 6, "Njala University": 8, "Limkokwing": 4 },
  };

  const originMock = Object.keys(mockDistances).find(k => origin.toLowerCase().includes(k.toLowerCase()));
  if (originMock && mockDistances[originMock][campus]) {
    return mockDistances[originMock][campus];
  }
  return DEFAULT_DISTANCE_KM;
};

const callTomTom = async (origin: string, campus: string, lat?: number, lon?: number): Promise<number> => {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new Error("TomTom API key not configured");

  let originLat = lat;
  let originLon = lon;

  if (!originLat || !originLon) {
    const originQuery = encodeURIComponent(`${origin}, Freetown, Sierra Leone`);
    const geoUrl = `https://api.tomtom.com/search/2/geocode/${originQuery}.json?key=${apiKey}&limit=1`;
    
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Could not find origin: ${origin}`);
    }

    originLat = geoData.results[0].position.lat;
    originLon = geoData.results[0].position.lon;
  }

  const destQuery = encodeURIComponent(`${campus}, Freetown, Sierra Leone`);
  const destUrl = `https://api.tomtom.com/search/2/geocode/${destQuery}.json?key=${apiKey}&limit=1`;
  
  const destResponse = await fetch(destUrl);
  const destData = await destResponse.json();

  if (!destData.results || destData.results.length === 0) {
    throw new Error(`Could not find destination: ${campus}`);
  }

  const destLat = destData.results[0].position.lat;
  const destLon = destData.results[0].position.lon;

  const destLatLon = `${destLat},${destLon}`;
  const originLatLon = `${originLat},${originLon}`;

  const dirUrl = `https://api.tomtom.com/routing/1/calculateRoute/${originLatLon}:${destLatLon}/json?key=${apiKey}`;
  const dirResponse = await fetch(dirUrl);
  const dirData = await dirResponse.json();

  if (!dirData.routes || dirData.routes.length === 0) {
    throw new Error(`Routing failed`);
  }

  return dirData.routes[0].summary.lengthInMeters / 1000;
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

  const { originAddress, campus, originLat, originLon } = parsed.data;

  let distanceKm = 0;
  let isEstimate = false;

  try {
    distanceKm = await callTomTom(originAddress, campus, originLat, originLon);
  } catch (err) {
    console.error("Distance calculation error:", err);
    distanceKm = getMockDistance(originAddress, campus);
    isEstimate = true;
  }

  const fareAmount = distanceKm < MIN_DISTANCE_KM
    ? MIN_FARE
    : Math.round(BASE_RATE * distanceKm);

  return res.status(200).json({
    distanceKm: Number(distanceKm.toFixed(1)),
    fareAmount,
    isEstimate,
    minimumApplied: distanceKm < MIN_DISTANCE_KM
  });
}
