import { useEffect, useState, useMemo, useCallback } from "react";
import { MapView, LocationMarker, RouteLayer, MapControls, CameraController } from "@/map";
import { supabase } from "@/integrations/supabase/client";
import { parseApiJson } from "@/lib/parseApiResponse";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const FREETOWN_CENTER: [number, number] = [8.4844, -13.2344];

interface MapDisplayProps {
  pickupLat?: number;
  pickupLon?: number;
  campusLat?: number;
  campusLon?: number;
  campusName?: string;
  onPickupSelect?: (address: string, lat: number, lon: number) => void;
  isDraggable?: boolean;
  driverLocation?: { latitude: number; longitude: number; heading: number | null } | null;
}

export function MapDisplay({
  pickupLat,
  pickupLon,
  campusLat,
  campusLon,
  campusName,
  onPickupSelect,
  isDraggable = true,
  driverLocation,
}: MapDisplayProps) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const pickupCoords = useMemo<[number, number] | undefined>(() => {
    return pickupLat != null && pickupLon != null ? [pickupLat, pickupLon] : undefined;
  }, [pickupLat, pickupLon]);

  const campusCoords = useMemo<[number, number] | undefined>(() => {
    return campusLat != null && campusLon != null ? [campusLat, campusLon] : undefined;
  }, [campusLat, campusLon]);

  const driverCoords = useMemo<[number, number] | undefined>(() => {
    return driverLocation ? [driverLocation.latitude, driverLocation.longitude] : undefined;
  }, [driverLocation]);

  const fitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (pickupCoords) pts.push(pickupCoords);
    if (campusCoords) pts.push(campusCoords);
    if (driverCoords) pts.push(driverCoords);
    return pts;
  }, [pickupCoords, campusCoords, driverCoords]);

  useEffect(() => {
    if (!pickupCoords || !campusCoords) {
      setRoutePoints([]);
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
          setRoutePoints(coords);
        } else {
          setRoutePoints([pickupCoords, campusCoords]);
        }
      } catch {
        setRoutePoints([pickupCoords, campusCoords]);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [pickupCoords, campusCoords]);

  const handleCoordsChange = useCallback(async (lat: number, lon: number) => {
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
    } catch {
      toast.error("Failed to update location details.", { id: toastId });
    }
  }, [onPickupSelect]);

  const handleMarkerDragEnd = useCallback((lat: number, lon: number) => {
    handleCoordsChange(lat, lon);
  }, [handleCoordsChange]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (isDraggable) {
      handleCoordsChange(lat, lon);
    }
  }, [isDraggable, handleCoordsChange]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {loadingRoute && (
        <div className="absolute top-3 right-3 z-[1000] bg-background/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-hairline flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span>Calculating route...</span>
        </div>
      )}

      <MapView
        initialViewState={{
          longitude: (pickupCoords?.[1] ?? campusCoords?.[1] ?? FREETOWN_CENTER[1]),
          latitude: (pickupCoords?.[0] ?? campusCoords?.[0] ?? FREETOWN_CENTER[0]),
          zoom: 14,
          pitch: 45,
          bearing: 0,
        }}
        scrollZoom
        dragPan
        onClick={(e) => handleMapClick(e.lngLat.lat, e.lngLat.lng)}
        style={{ width: "100%", height: "100%" }}
      >
        <CameraController fitPoints={fitPoints} padding={40} />

        {pickupCoords && (
          <LocationMarker
            latitude={pickupCoords[0]}
            longitude={pickupCoords[1]}
            type="pickup"
            draggable={isDraggable}
            onDragEnd={handleMarkerDragEnd}
          />
        )}

        {campusCoords && (
          <LocationMarker
            latitude={campusCoords[0]}
            longitude={campusCoords[1]}
            type="campus"
          />
        )}

        {driverCoords && (
          <LocationMarker
            latitude={driverCoords[0]}
            longitude={driverCoords[1]}
            type="driver"
            heading={driverLocation?.heading ?? null}
          />
        )}

        {routePoints.length > 1 && <RouteLayer points={routePoints} />}

        <MapControls />
      </MapView>

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
