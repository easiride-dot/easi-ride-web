import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RideType = "shared" | "solo";
export type RideStatus = "pending" | "assigned" | "completed";

export interface Ride {
  id: string;
  pickup: string;
  destination: string;
  timeSlot: string;
  type: RideType;
  price: number;
  status: RideStatus;
  driverName?: string;
  driverPhone?: string;
  vehicle?: string;
  etaMinutes?: number;
  createdAt: string;
  userId: string;
}

interface RideContextValue {
  rides: Ride[];
  loading: boolean;
  createRide: (data: Omit<Ride, "id" | "status" | "createdAt" | "userId">) => Promise<Ride | null>;
  assignDriver: (id: string, driver: { name: string; phone: string; vehicle: string; eta: number }) => Promise<void>;
  refresh: () => Promise<void>;
  getRide: (id: string) => Ride | undefined;
}

const RideContext = createContext<RideContextValue | null>(null);

type RideRow = {
  id: string;
  user_id: string;
  pickup: string;
  destination: string;
  time_slot: string;
  type: RideType;
  price: number;
  status: RideStatus;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle: string | null;
  eta_minutes: number | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (r: RideRow): Ride => ({
  id: r.id,
  pickup: r.pickup,
  destination: r.destination,
  timeSlot: r.time_slot,
  type: r.type,
  price: r.price,
  status: r.status,
  driverName: r.driver_name ?? undefined,
  driverPhone: r.driver_phone ?? undefined,
  vehicle: r.vehicle ?? undefined,
  etaMinutes: r.eta_minutes ?? undefined,
  createdAt: r.created_at,
  userId: r.user_id,
});

export const RideProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setRides(data.map(mapRow));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();

    if (!user) return;

    const channel = supabase
      .channel(`rides_changes:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `user_id=eq.${user.id}` },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, user]);

  const createRide: RideContextValue["createRide"] = async (data) => {
    if (!user) return null;
    const { data: row, error } = await supabase
      .rpc("create_ride_booking", {
        p_pickup: data.pickup,
        p_destination: data.destination,
        p_time_slot: data.timeSlot,
        p_type: data.type,
        p_price: data.price,
      })

    if (error) {
      throw new Error(error.message);
    }

    if (!row) return null;

    const ride = mapRow(row);
    setRides((prev) => [ride, ...prev]);
    return ride;
  };

  const assignDriver: RideContextValue["assignDriver"] = async (id, driver) => {
    const { data: row, error } = await supabase
      .from("rides")
      .update({
        status: "assigned",
        driver_name: driver.name,
        driver_phone: driver.phone,
        vehicle: driver.vehicle,
        eta_minutes: driver.eta,
      })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) {
      const updated = mapRow(row);
      setRides((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  };

  const getRide = (id: string) => rides.find((r) => r.id === id);

  return (
    <RideContext.Provider value={{ rides, loading, createRide, assignDriver, refresh, getRide }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRides = () => {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useRides must be used within RideProvider");
  return ctx;
};
