import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [exists, setExists] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkUserExists = async () => {
      if (!user) {
        setVerifying(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Profile check failed:", error);
          setExists(true);
        } else if (!data) {
          console.warn("User profile not found, signing out...");
          setExists(false);
          await signOut();
        } else {
          setExists(true);
        }
      } catch (err) {
        console.error("User verification failed:", err);
        setExists(true);
      } finally {
        setVerifying(false);
      }
    };

    if (!authLoading) {
      checkUserExists();
    }
  }, [user, authLoading, signOut]);

  if (authLoading || verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!user || !exists) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
