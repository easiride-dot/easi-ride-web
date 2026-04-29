import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

export type Profile = Tables<"profiles">;

export const useProfile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        console.warn("Profile not found in useProfile, signing out...");
        await signOut();
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    if (!user) return;

    const handleRefresh = () => {
      fetchProfile();
    };

    const channel = supabase
      .channel(`profile-updates:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user?.id}` },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(handleRefresh, 15000);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { profile, loading, refresh: fetchProfile };
};
