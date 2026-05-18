import { z } from "zod";

const schema = z.object({
  lat: z.number(),
  lon: z.number(),
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { lat, lon } = parsed.data;
  const apiKey = process.env.TOMTOM_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "TomTom API key not configured on server" });
  }

  try {
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.addresses && data.addresses.length > 0) {
      const addressObj = data.addresses[0].address;
      const placeName = addressObj.streetName || addressObj.municipalitySubdivision || addressObj.freeformAddress || "Freetown";
      return res.status(200).json({ placeName });
    } else {
      return res.status(404).json({ error: "Location name not found" });
    }
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return res.status(500).json({ error: "Failed to reverse geocode" });
  }
}
