import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
}

export function useDriverLocation(driverId?: string) {
  const [location, setLocation] = useState<DriverLocation | null>(null);

  useEffect(() => {
    if (!driverId) {
      setLocation(null);
      return;
    }

    // Fetch initial location
    supabase
      .from("driver_locations")
      .select("latitude, longitude, heading")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading,
          });
        }
      });

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`driver_loc_${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && newRow.latitude && newRow.longitude) {
            setLocation({
              latitude: newRow.latitude,
              longitude: newRow.longitude,
              heading: newRow.heading,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return location;
}
