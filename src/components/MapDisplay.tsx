import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { DriverLocation } from "@/hooks/useDriverLocation";
import { Ride } from "@/context/RideContext";

const FREETOWN_CENTER: [number, number] = [-13.2344, 8.4844];

interface ActiveRideMapProps {
  ride: Ride;
  driverLocation: DriverLocation | null;
  onMapLoad?: (map: maplibregl.Map) => void;
}

export function ActiveRideMap({
  ride,
  driverLocation,
  onMapLoad,
}: ActiveRideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routeDrawnRef = useRef(false);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const hasRouteCoords = 
    ride.pickupLatitude != null &&
    ride.pickupLongitude != null &&
    ride.destinationLatitude != null &&
    ride.destinationLongitude != null;

  const pickupLngLat = hasRouteCoords
    ? [ride.pickupLongitude!, ride.pickupLatitude!] as [number, number]
    : null;

  const destLngLat = hasRouteCoords
    ? [ride.destinationLongitude!, ride.destinationLatitude!] as [number, number]
    : null;

  const driverLngLat = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude] as [number, number]
    : null;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: pickupLngLat ?? destLngLat ?? FREETOWN_CENTER,
      zoom: 14,
      pitch: 45,
      bearing: 0,
      interactive: false,
      attributionControl: false,
      logoPosition: "bottom-right",
    });

    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);
      onMapLoad?.(map);
      drawRouteIfNeeded(map);
      addMarkers(map);
      fitBounds(map);
    });

    return () => {
      cleanupMarkers();
      map.remove();
      mapRef.current = null;
      routeDrawnRef.current = false;
      setMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    updateDriverMarker(mapRef.current);
  }, [driverLocation, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !hasRouteCoords) return;
    if (routeDrawnRef.current) {
      updateRouteSource(mapRef.current);
    } else {
      drawRouteIfNeeded(mapRef.current);
    }
  }, [pickupLngLat, destLngLat, mapLoaded]);

  const drawRouteIfNeeded = async (map: maplibregl.Map) => {
    if (!hasRouteCoords || routeDrawnRef.current) return;

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${pickupLngLat![1]},${pickupLngLat![0]};${destLngLat![1]},${destLngLat![0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === "Ok" && data.routes?.[0]?.geometry) {
        const routeGeoJSON = data.routes[0].geometry;
        addRouteSource(map, routeGeoJSON);
        routeDrawnRef.current = true;
      }
    } catch (error) {
      console.error("Failed to fetch route:", error);
    }
  };

  const addRouteSource = (map: maplibregl.Map, geometry: any) => {
    if (map.getSource("student-route")) return;

    map.addSource("student-route", {
      type: "geojson",
      data: { type: "Feature", geometry, properties: {} },
    });

    map.addLayer({
      id: "student-route-casing",
      type: "line",
      source: "student-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#000000",
        "line-width": 7,
        "line-opacity": 0.3,
      },
    });

    map.addLayer({
      id: "student-route-line",
      type: "line",
      source: "student-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#FFFFFF",
        "line-width": 4,
        "line-opacity": 0.9,
      },
    });
  };

  const updateRouteSource = (map: maplibregl.Map) => {
    if (!hasRouteCoords) return;
    const source = map.getSource("student-route") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      const url = `https://router.project-osrm.org/route/v1/driving/${pickupLngLat![1]},${pickupLngLat![0]};${destLngLat![1]},${destLngLat![0]}?overview=full&geometries=geojson`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.code === "Ok" && data.routes?.[0]?.geometry) {
            source.setData({ type: "Feature", geometry: data.routes[0].geometry, properties: {} });
          }
        })
        .catch(console.error);
    }
  };

  const addMarkers = (map: maplibregl.Map) => {
    if (pickupLngLat) {
      const pickupEl = document.createElement("div");
      pickupEl.style.cssText = `
        width: 14px;
        height: 14px;
        background: #22C55E;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `;
      pickupMarkerRef.current = new maplibregl.Marker({ element: pickupEl })
        .setLngLat(pickupLngLat)
        .addTo(map);
    }

    if (destLngLat) {
      const destEl = document.createElement("div");
      destEl.style.cssText = `
        width: 14px;
        height: 14px;
        background: #EF4444;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: destEl })
        .setLngLat(destLngLat)
        .addTo(map);
    }

    if (driverLngLat) {
      const driverEl = document.createElement("div");
      driverEl.style.cssText = `
        width: 32px;
        height: 32px;
        background: #F59E0B;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      `;
      driverEl.innerHTML = "🛺";
      driverMarkerRef.current = new maplibregl.Marker({ element: driverEl })
        .setLngLat(driverLngLat)
        .addTo(map);
    }
  };

  const updateDriverMarker = (map: maplibregl.Map) => {
    if (!driverLngLat) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat(driverLngLat);
    } else {
      const driverEl = document.createElement("div");
      driverEl.style.cssText = `
        width: 32px;
        height: 32px;
        background: #F59E0B;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      `;
      driverEl.innerHTML = "🛺";
      driverMarkerRef.current = new maplibregl.Marker({ element: driverEl })
        .setLngLat(driverLngLat)
        .addTo(map);
    }
  };

  const fitBounds = (map: maplibregl.Map) => {
    if (!hasRouteCoords) return;

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(pickupLngLat!);
    bounds.extend(destLngLat!);
    if (driverLngLat) bounds.extend(driverLngLat);

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 380, left: 40, right: 40 },
      duration: 800,
    });
  };

  const cleanupMarkers = () => {
    pickupMarkerRef.current?.remove();
    destMarkerRef.current?.remove();
    driverMarkerRef.current?.remove();
    pickupMarkerRef.current = null;
    destMarkerRef.current = null;
    driverMarkerRef.current = null;
  };

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 w-full h-full z-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
}