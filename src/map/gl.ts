// GL renderer selection shim — mirrors the driver PWA's gl.ts.
//
// Both `react-map-gl/mapbox` and `react-map-gl/maplibre` export an identical
// component API (Map, useMap, Marker, Source, Layer, NavigationControl …),
// so we import both bundles once and re-export the active provider's bindings.
//
//   VITE_MAP_PROVIDER=mapbox    → Mapbox GL JS (3D standard styles, DEFAULT when token present)
//   VITE_MAP_PROVIDER=maplibre  → MapLibre GL (CartoDB dark fallback)
//
// Mapbox is used whenever VITE_MAPBOX_ACCESS_TOKEN is set and the provider
// isn't explicitly forced to "maplibre". Both packages stay installed so the
// app can fall back to MapLibre with zero errors when no token is configured.

import type { ComponentType, PropsWithChildren } from "react";
import * as box from "react-map-gl/mapbox";
import * as libre from "react-map-gl/maplibre";

export type GlProviderName = "mapbox" | "maplibre";

export function resolveGlProvider(): GlProviderName {
  const forced = (import.meta.env.VITE_MAP_PROVIDER as string | undefined) || "";
  if (forced === "maplibre") return "maplibre";
  if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) return "mapbox";
  return "maplibre";
}

export const glProvider: GlProviderName = resolveGlProvider();

// Both providers share the same runtime contract. We bind types to the Mapbox
// entry (the default) to avoid union-type friction between the two GL typings.

const MapComponent =
  glProvider === "mapbox"
    ? (box.Map as ComponentType<PropsWithChildren<any>>)
    : (libre.Map as ComponentType<PropsWithChildren<any>>);

const MarkerComponent   = glProvider === "mapbox" ? box.Marker           : libre.Marker;
const SourceComponent   = glProvider === "mapbox" ? box.Source           : libre.Source;
const LayerComponent    = glProvider === "mapbox" ? box.Layer            : libre.Layer;
const NavControlComp    = glProvider === "mapbox" ? box.NavigationControl : libre.NavigationControl;

export const Map              = MapComponent;
export const Marker           = MarkerComponent;
export const Source           = SourceComponent;
export const Layer            = LayerComponent;
export const NavigationControl = NavControlComp;
export const useMap           = glProvider === "mapbox" ? box.useMap : libre.useMap;
