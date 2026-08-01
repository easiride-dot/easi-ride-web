import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

export type Profile = Tables<"profiles">;

const isNetworkError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("ERR_CONNECTION")
  );
};

export const useProfile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setFetchError(null);
      return;
    }

    if (!navigator.onLine) {
      setFetchError("You appear to be offline. Check your connection and try again.");
      setLoading(false);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        await signOut();
        return;
      }

      setProfile(data);
      setFetchError(null);
    } catch (error) {
      if (isNetworkError(error)) {
        setFetchError("Could not reach the server. Check your internet or try again shortly.");
      } else {
        setFetchError("Could not load your profile. Please try again.");
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [user, signOut]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();

    if (!user) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        fetchProfile();
      }
    };

    const channel = supabase
      .channel(`profile-updates:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  return { profile, loading, fetchError, refresh: fetchProfile };
};
