import { z } from "zod";

const schema = z.object({
  query: z.string().min(2),
});

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = req.query.query;
  const parsed = schema.safeParse({ query });
  
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "TomTom API key not configured on server" });
  }

  try {
    const q = encodeURIComponent(parsed.data.query);
    // Bias search to Freetown area using center lat/lon and a 15km radius
    const url = `https://api.tomtom.com/search/2/search/${q}.json?key=${apiKey}&lat=8.4844&lon=-13.2344&radius=15000&limit=5`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.results) {
      const suggestions = data.results.map((result: any) => ({
        // Sometimes freeformAddress is best, otherwise fallback to streetName + subdivision
        address: result.address.freeformAddress || 
                 [result.address.streetName, result.address.municipalitySubdivision].filter(Boolean).join(", ") || 
                 "Freetown Location",
        lat: result.position.lat,
        lon: result.position.lon,
      }));
      return res.status(200).json({ suggestions });
    } else {
      return res.status(200).json({ suggestions: [] });
    }
  } catch (error) {
    console.error("Search API error:", error);
    return res.status(500).json({ error: "Failed to search locations" });
  }
}
