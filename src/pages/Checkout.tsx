import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin, Navigation, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { parseApiJson } from "@/lib/parseApiResponse";

const CAMPUSES = ["Fourah Bay College", "IPAM Tower Hill", "Limkokwing"];

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [busy, setBusy] = useState(false);

  const [pickup, setPickup] = useState("");
  const [originLat, setOriginLat] = useState<number | undefined>(undefined);
  const [originLon, setOriginLon] = useState<number | undefined>(undefined);
  const [campus, setCampus] = useState(CAMPUSES[0]);
  const [weeklyPrice, setWeeklyPrice] = useState<number | null>(null);
  const [loadingFare, setLoadingFare] = useState(false);

  const isVerified = profile?.verification_status === "approved";

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    
    const toastId = toast.loading("Detecting your location...");
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          const response = await fetch("/api/reverse-geocode", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ lat: latitude, lon: longitude }),
          });

          const { ok, data, error } = await parseApiJson<{ placeName?: string; error?: string }>(response);

          if (ok && data?.placeName) {
            setPickup(data.placeName);
            setOriginLat(latitude);
            setOriginLon(longitude);
            toast.success("Location detected", { id: toastId });
          } else {
            toast.error(error || "Could not get street name. Please type it.", { id: toastId });
          }
          setWeeklyPrice(null);
        } catch (error) {
          toast.error("Could not detect street name. Please type it.", { id: toastId });
        }
      },
      () => {
        toast.error("Could not access GPS. Please type your location.", { id: toastId });
      }
    );
  };

  // Fetch weekly price whenever pickup area or campus changes
  useEffect(() => {
    if (!pickup.trim() || pickup.trim().length < 3 || !campus || !user) {
      setWeeklyPrice(null);
      return;
    }

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
          body: JSON.stringify({ 
            originAddress: pickup.trim(), 
            campus,
            originLat,
            originLon 
          }),
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.weeklyPrice) {
          setWeeklyPrice(result.weeklyPrice);
        } else {
          setWeeklyPrice(null);
        }
      } catch {
        setWeeklyPrice(null);
      } finally {
        setLoadingFare(false);
      }
    };

    // Debounce the call if no lat/lon exists (typing mode) to limit geocoding requests
    const delay = !originLat || !originLon ? 600 : 0;
    const timer = setTimeout(fetchFare, delay);
    return () => clearTimeout(timer);
  }, [pickup, campus, originLat, originLon, user]);

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
      toast.error("Please enter a valid pickup location.");
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
          originAddress: pickup.trim(),
          campus,
          originLat,
          originLon
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
              <div className="bg-secondary/30 rounded-2xl border border-hairline mb-6">
                <div className="relative flex items-center gap-3 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="trip-pickup" className="text-xs text-muted-foreground">Your pickup location</Label>
                    <LocationAutocomplete
                      id="trip-pickup"
                      value={pickup}
                      onChange={(val) => {
                        setPickup(val);
                        setWeeklyPrice(null);
                        setOriginLat(undefined);
                        setOriginLon(undefined);
                      }}
                      onSelect={(loc) => {
                        setPickup(loc.address);
                        setOriginLat(loc.lat);
                        setOriginLon(loc.lon);
                        setWeeklyPrice(null);
                      }}
                      placeholder="Search or type a location..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    className="rounded-lg border border-hairline bg-secondary/50 p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Detect my location"
                  >
                    <Locate className="h-4 w-4" />
                  </button>
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
                      onChange={(e) => { setCampus(e.target.value); setWeeklyPrice(null); }}
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
                  ) : pickup ? (
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
