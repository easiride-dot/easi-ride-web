import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { parseApiJson } from "@/lib/parseApiResponse";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Freetown Center fallback
const FREETOWN_CENTER: [number, number] = [8.4844, -13.2344];

// Custom SVGs for markers to fit Easi Ride dark premium aesthetic
const getPickupIcon = (isDragging: boolean) => L.divIcon({
  className: "custom-pickup-marker",
  html: `
    <div class="relative flex items-center justify-center h-10 w-10">
      <span class="animate-ping-slow absolute inline-flex h-8 w-8 rounded-full bg-emerald-500/20 opacity-75"></span>
      <div class="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-background shadow-lg transition-transform duration-200 ${
        isDragging ? "scale-125 bg-emerald-400" : ""
      }">
        <div class="h-2 w-2 rounded-full bg-background"></div>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const campusIcon = L.divIcon({
  className: "custom-campus-marker",
  html: `
    <div class="relative flex items-center justify-center h-12 w-12 animate-fade-up">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary border border-border shadow-elevated">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-primary-foreground">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

interface MapDisplayProps {
  pickupLat?: number;
  pickupLon?: number;
  campusLat?: number;
  campusLon?: number;
  campusName?: string;
  onPickupSelect?: (address: string, lat: number, lon: number) => void;
  isDraggable?: boolean;
}

// Inner helper component to auto-fit and animate zoom to fit coordinates
const MapAutoFitter = ({
  pickupCoords,
  campusCoords,
}: {
  pickupCoords?: [number, number];
  campusCoords?: [number, number];
}) => {
  const map = useMap();

  useEffect(() => {
    if (pickupCoords && campusCoords) {
      const bounds = L.latLngBounds([pickupCoords, campusCoords]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (pickupCoords) {
      map.setView(pickupCoords, 15);
    } else if (campusCoords) {
      map.setView(campusCoords, 15);
    }
  }, [pickupCoords, campusCoords, map]);

  return null;
};

// Inner component to handle clicking on the map to set pickup
const MapClickHandler = ({
  onMapClick,
}: {
  onMapClick: (lat: number, lon: number) => void;
}) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export function MapDisplay({
  pickupLat,
  pickupLon,
  campusLat,
  campusLon,
  campusName,
  onPickupSelect,
  isDraggable = true,
}: MapDisplayProps) {
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pickupCoords = useMemo<[number, number] | undefined>(() => {
    return pickupLat != null && pickupLon != null ? [pickupLat, pickupLon] : undefined;
  }, [pickupLat, pickupLon]);

  const campusCoords = useMemo<[number, number] | undefined>(() => {
    return campusLat != null && campusLon != null ? [campusLat, campusLon] : undefined;
  }, [campusLat, campusLon]);

  // Fetch route geometries via OSRM public API on the frontend
  useEffect(() => {
    if (!pickupCoords || !campusCoords) {
      setRoutePolyline([]);
      return;
    }

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const [pickupLatVal, pickupLonVal] = pickupCoords;
        const [campusLatVal, campusLonVal] = campusCoords;

        const url = `https://router.project-osrm.org/route/v1/driving/${pickupLonVal},${pickupLatVal};${campusLonVal},${campusLatVal}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );
          setRoutePolyline(coords);
        } else {
          // fallback to simple straight line
          setRoutePolyline([pickupCoords, campusCoords]);
        }
      } catch (err) {
        console.error("OSRM Routing Error:", err);
        setRoutePolyline([pickupCoords, campusCoords]);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [pickupCoords, campusCoords]);

  // Geocode coords back to string address (Reverse Geocoding)
  const handleCoordsChange = async (lat: number, lon: number) => {
    if (!onPickupSelect) return;
    
    const toastId = toast.loading("Updating pickup address...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/reverse-geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lat, lon }),
      });

      const { ok, data, error } = await parseApiJson<{ placeName?: string; error?: string }>(response);

      if (ok && data?.placeName) {
        onPickupSelect(data.placeName, lat, lon);
        toast.success("Pickup updated", { id: toastId });
      } else {
        toast.error(error || "Could not retrieve address details.", { id: toastId });
      }
    } catch (error) {
      toast.error("Failed to update location details.", { id: toastId });
    }
  };

  const handleMarkerDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target;
    if (marker != null) {
      const position = marker.getLatLng();
      setDragging(false);
      handleCoordsChange(position.lat, position.lng);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (isDraggable) {
      handleCoordsChange(lat, lon);
    }
  };

  return (
    <div className="relative glass-card rounded-2xl overflow-hidden shadow-elevated border border-hairline/60 h-[280px] w-full z-10 animate-fade-up">
      {/* Visual loaders for fetching routing details */}
      {loadingRoute && (
        <div className="absolute top-3 right-3 z-[1000] bg-background/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-hairline flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span>Calculating route...</span>
        </div>
      )}

      <MapContainer
        center={pickupCoords || campusCoords || FREETOWN_CENTER}
        zoom={14}
        scrollWheelZoom={true}
        className="h-full w-full"
        zoomControl={true}
      >
        {/* Sleek Dark Matter map tiles for premium aesthetic */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapAutoFitter pickupCoords={pickupCoords} campusCoords={campusCoords} />
        
        {onPickupSelect && <MapClickHandler onMapClick={handleMapClick} />}

        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker
            position={pickupCoords}
            icon={getPickupIcon(dragging)}
            draggable={isDraggable}
            eventHandlers={{
              dragstart: () => setDragging(true),
              dragend: handleMarkerDragEnd,
            }}
          />
        )}

        {/* Campus Destination Marker */}
        {campusCoords && (
          <Marker
            position={campusCoords}
            icon={campusIcon}
          />
        )}

        {/* Route Line */}
        {routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{
              color: "#3b82f6", // sleek blue route path
              weight: 4,
              opacity: 0.8,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}
      </MapContainer>
      
      {isDraggable && !pickupCoords && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40 z-[999] backdrop-blur-[1px]">
          <div className="bg-background/90 px-4 py-2.5 rounded-2xl border border-hairline/80 shadow-elevated text-center max-w-[80%]">
            <p className="text-xs font-semibold">Tap on the map or search to choose pickup</p>
          </div>
        </div>
      )}
    </div>
  );
}
