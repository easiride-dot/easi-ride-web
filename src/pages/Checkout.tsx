import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";

const CAMPUSES = ["Fourah Bay College", "IPAM Tower Hill", "Njala University", "Limkokwing"];

interface FareZoneEntry {
  pickup_area: string;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [busy, setBusy] = useState(false);

  // Pickup area selection
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [pickupArea, setPickupArea] = useState("");
  const [campus, setCampus] = useState(CAMPUSES[0]);
  const [weeklyPrice, setWeeklyPrice] = useState<number | null>(null);
  const [loadingFare, setLoadingFare] = useState(false);

  const isVerified = profile?.verification_status === "approved";

  // Load available pickup areas from fare_zones
  useEffect(() => {
    const loadAreas = async () => {
      const { data } = await supabase
        .from("fare_zones")
        .select("pickup_area")
        .order("pickup_area");
      if (data) {
        const unique = [...new Set((data as FareZoneEntry[]).map((d) => d.pickup_area))];
        setAvailableAreas(unique);
        if (unique.length > 0) setPickupArea(unique[0]);
      }
    };
    loadAreas();
  }, []);

  // Fetch weekly price whenever pickup area or campus changes
  useEffect(() => {
    if (!pickupArea || !campus || !user) return;

    const fetchFare = async () => {
      setLoadingFare(true);
      setWeeklyPrice(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch("/api/get-weekly-fare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ pickupArea, campus }),
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.weeklyPrice) {
          setWeeklyPrice(result.weeklyPrice);
        } else {
          setWeeklyPrice(null); // Route not supported yet
        }
      } catch {
        setWeeklyPrice(null);
      } finally {
        setLoadingFare(false);
      }
    };

    fetchFare();
  }, [pickupArea, campus, user]);

  const handlePay = async () => {
    if (!user) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }
    if (!isVerified) {
      toast.error("Your student ID must be approved before you can subscribe.");
      navigate("/dashboard");
      return;
    }
    if (!weeklyPrice) {
      toast.error("Please select a valid pickup area and campus.");
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/monime-create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          paymentType: "weekly",
          pickupArea,
          campus,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.redirectUrl) {
        toast.error(result?.error || "Unable to start payment");
        setBusy(false);
        return;
      }

      window.location.href = result.redirectUrl;
    } catch {
      toast.error("Unable to start payment");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </div>
      </header>

      <main className="container max-w-md py-12 animate-fade-up">
        <div className="glass-card rounded-3xl p-8 shadow-elevated">
          {profileLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : !isVerified ? (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Approval required</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Your student ID must be approved before you can subscribe to the weekly plan.
              </p>
              <Button className="mt-8 w-full" variant="outline" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-center mb-6">Weekly Plan</h1>

              {/* Route selector */}
              <div className="bg-secondary/30 rounded-2xl overflow-hidden border border-hairline mb-6">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Your pickup area</Label>
                    {availableAreas.length > 0 ? (
                      <select
                        value={pickupArea}
                        onChange={(e) => setPickupArea(e.target.value)}
                        className="mt-0.5 h-8 w-full bg-transparent text-sm font-medium outline-none"
                      >
                        {availableAreas.map((area) => (
                          <option key={area} value={area} className="bg-background">{area}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-muted-foreground">Loading areas...</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-hairline/60" />
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Destination campus</Label>
                    <select
                      value={campus}
                      onChange={(e) => setCampus(e.target.value)}
                      className="mt-0.5 h-8 w-full bg-transparent text-sm font-medium outline-none"
                    >
                      {CAMPUSES.map((c) => (
                        <option key={c} value={c} className="bg-background">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Price summary */}
              <div className="bg-secondary/30 rounded-2xl p-5 mb-8 border border-hairline">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Plan</span>
                  <span className="font-semibold">Weekly Solo</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Rides included</span>
                  <span className="font-semibold">14 rides</span>
                </div>
                <div className="border-t border-hairline/60 my-4" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Weekly price</span>
                  {loadingFare ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : weeklyPrice ? (
                    <span className="font-display text-2xl font-semibold">{weeklyPrice} NLe</span>
                  ) : pickupArea ? (
                    <span className="text-sm text-muted-foreground">Route not available</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select a route</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground text-center mb-4">Payment</p>
                <Button
                  variant="outline"
                  className="w-full h-14 justify-start px-6"
                  disabled={busy || !weeklyPrice || loadingFare}
                  onClick={handlePay}
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-left font-medium">
                    {busy ? "Opening secure checkout..." : weeklyPrice ? `Pay ${weeklyPrice} NLe with Monime` : "Select a route above"}
                  </span>
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mobile money, bank transfer, and cards via Monime
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Checkout;
