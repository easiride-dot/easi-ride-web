import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface College {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const useColleges = () => {
  const { user } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColleges = useCallback(async () => {
    if (!user) {
      setColleges([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("colleges")
      .select("id, name, lat, lon")
      .order("name", { ascending: true });

    if (!error && data) {
      setColleges(data as College[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchColleges();
  }, [fetchColleges]);

  return { colleges, loading };
};