import { glProvider } from "./gl";

// ── Mapbox styles (used when VITE_MAPBOX_ACCESS_TOKEN is set) ──────────────
export const MAPBOX_DARK_STYLE  = "mapbox://styles/mapbox/dark-v11";
export const MAPBOX_LIGHT_STYLE = "mapbox://styles/mapbox/light-v11";

// ── MapLibre / CartoDB fallbacks ───────────────────────────────────────────
export const CARTO_DARK_STYLE  = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const CARTO_LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Legacy alias kept for any existing imports
export const DARK_STYLE  = glProvider === "mapbox" ? MAPBOX_DARK_STYLE  : CARTO_DARK_STYLE;
export const LIGHT_STYLE = glProvider === "mapbox" ? MAPBOX_LIGHT_STYLE : CARTO_LIGHT_STYLE;

export function resolveMapStyle(theme: "light" | "dark"): string {
  if (glProvider === "mapbox") {
    return theme === "dark" ? MAPBOX_DARK_STYLE : MAPBOX_LIGHT_STYLE;
  }
  return theme === "dark" ? CARTO_DARK_STYLE : CARTO_LIGHT_STYLE;
}

// Mapbox public access token — undefined when not configured (triggers MapLibre fallback)
export const MAP_ACCESS_TOKEN =
  (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) || undefined;

export const MAP_CONFIG = {
  defaultZoom: 15,
  defaultPitch: 45,
  defaultBearing: 0,
  minZoom: 3,
  maxZoom: 20,
  freetownCenter: [8.4844, -13.2344] as [number, number],
} as const;

export const ROUTE_SOURCE_ID = "route";
export const ROUTE_LAYER_ID  = "route-line";

// Student-PWA route style — blue to match the app's primary colour
export const routeLayerStyle = {
  id: ROUTE_LAYER_ID,
  type: "line" as const,
  source: ROUTE_SOURCE_ID,
  layout: {
    "line-cap":  "round" as const,
    "line-join": "round" as const,
  },
  paint: {
    "line-color":   "#3b82f6",
    "line-width":    6,
    "line-opacity":  0.85,
    "line-blur":     0,
  },
};
