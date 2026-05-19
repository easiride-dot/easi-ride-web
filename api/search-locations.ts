import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./_rate-limit.js";

const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").trim();

const schema = z.object({
  query: z.string().min(2).max(150).transform(sanitize),
});

const getAuthToken = (authorization?: string | string[]) => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
};

export default async function handler(req: any, res: any) {
  if (req.query.query && String(req.query.query).length > 200) {
    return res.status(400).json({ error: "Search query too long" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getAuthToken(req.headers.authorization);
  if (!token) {
    console.error("❌ Search Locations: Missing authorization token");
    return res.status(401).json({ error: "Missing auth token" });
  }

  const getEnv = (name: string) => {
    const value = process.env[name];
    if (!value) return "";
    return value;
  };

  const supabaseUrl = process.env.SUPABASE_URL || getEnv("VITE_SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_ANON_KEY || getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Search Locations: Supabase client variables are undefined!");
    return res.status(500).json({ error: "Supabase environment variables not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.error("❌ Search Locations: Auth token verification failed!", userError?.message || userError);
    return res.status(401).json({ error: "Invalid auth token" });
  }

  // Rate limiting: max 60 requests per minute (higher for typing autocomplete suggestions)
  if (!rateLimit(req, { intervalMs: 60 * 1000, maxRequests: 60 }, user.id)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
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
