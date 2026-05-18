import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MapPin, Navigation, Clock, ArrowRight, Locate, ArrowLeft,
  Loader2, AlertCircle, CreditCard, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LocationAutocomplete, LocationSuggestion } from "@/components/LocationAutocomplete";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShieldAlert } from "lucide-react";

const CAMPUSES = ["Fourah Bay College", "IPAM Tower Hill", "Limkokwing"];

interface FareResult {
  distanceKm: number;
  fareAmount: number;
  isEstimate: boolean;
  minimumApplied: boolean;
}

const TripBooking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  const [pickup, setPickup] = useState("");
  const [originLat, setOriginLat] = useState<number | undefined>(undefined);
  const [originLon, setOriginLon] = useState<number | undefined>(undefined);
  
  const [campus, setCampus] = useState(CAMPUSES[0]);
  const [timeSlot, setTimeSlot] = useState("08:00");
  const [fare, setFare] = useState<FareResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [booking, setBooking] = useState(false);

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
          
          const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lon: longitude })
          });
          
          const data = await response.json();
          
          if (response.ok && data.placeName) {
            setPickup(data.placeName);
            setOriginLat(latitude);
            setOriginLon(longitude);
            toast.success("Location detected", { id: toastId });
          } else {
            toast.error(data.error || "Could not get street name. Please type it.", { id: toastId });
          }
          setFare(null);
        } catch (error) {
          toast.error("Could not detect street name. Please type it.", { id: toastId });
        }
      },
      () => {
        toast.error("Could not access GPS. Please type your location.", { id: toastId });
      }
    );
  };

  const handleCalculateFare = async () => {
    if (!pickup.trim()) {
      toast.error("Please enter your pickup location");
      return;
    }
    setCalculating(true);
    setFare(null);
    try {
      const response = await fetch("/api/calculate-trip-fare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          originAddress: pickup.trim(), 
          campus,
          originLat,
          originLon
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        toast.error(result?.error || "Could not calculate fare. Please try again.");
        return;
      }
      setFare(result as FareResult);
    } catch {
      toast.error("Could not reach the server. Please check your connection.");
    } finally {
      setCalculating(false);
    }
  };

  const handleBookTrip = async () => {
    if (!user) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }
    if (!fare) {
      toast.error("Please calculate your fare first");
      return;
    }

    setBooking(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          user_id: user.id,
          pickup: pickup.trim(),
          destination: campus,
          time_slot: timeSlot,
          type: "solo", // single trip is solo
          price: fare.fareAmount,
          payment_type: "trip",
          payment_status: "pending",
          status: "pending"
        })
        .select("id")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Ride requested successfully!");
      navigate(`/matching/${data.id}`);
    } catch (err) {
      toast.error("Could not request your ride. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="container max-w-md py-10 animate-fade-up">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pay Per Trip</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Book a single ride</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pay only for the trip you need. No subscription required.</p>
        </div>

        {/* Verification check */}
        {!profileLoading && !isVerified && (
          <div className="glass-card flex flex-col items-center p-8 text-center rounded-3xl border-amber-500/20 bg-amber-500/5 mb-6">
            <ShieldAlert className="h-10 w-10 text-amber-500 mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">Verification required</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your student ID must be approved before you can book a trip.
            </p>
            <Button asChild variant="outline">
              <Link to="/account">Go to account</Link>
            </Button>
          </div>
        )}

        {(profileLoading || isVerified) && (
          <div className="space-y-5">
            {/* Location card */}
            <div className="glass-card rounded-2xl">
              <div className="relative flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="trip-pickup" className="text-xs text-muted-foreground">Pickup location</Label>
                  <LocationAutocomplete
                    id="trip-pickup"
                    value={pickup}
                    onChange={(val) => {
                      setPickup(val);
                      setFare(null);
                      setOriginLat(undefined);
                      setOriginLon(undefined);
                    }}
                    onSelect={(loc) => {
                      setPickup(loc.address);
                      setOriginLat(loc.lat);
                      setOriginLon(loc.lon);
                      setFare(null);
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Destination</Label>
                  <select
                    value={campus}
                    onChange={(e) => { setCampus(e.target.value); setFare(null); }}
                    className="mt-0.5 h-8 w-full bg-transparent text-base outline-none"
                  >
                    {CAMPUSES.map((c) => (
                      <option key={c} value={c} className="bg-background">{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Time selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Pickup Time
              </div>
              <div className="relative">
                <Input
                  type="time"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="h-12 rounded-xl border border-hairline bg-secondary/30 text-foreground px-4 text-base focus-visible:ring-1 focus-visible:ring-foreground/50 w-full"
                  required
                />
              </div>
            </div>

            {/* Calculate button */}
            {!fare && (
              <Button
                className="w-full"
                variant="outline"
                onClick={handleCalculateFare}
                disabled={calculating || !pickup.trim()}
              >
                {calculating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculating fare...</>
                ) : (
                  <>Calculate fare <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            )}

            {/* Fare result */}
            {fare && (
              <div className="glass-card rounded-2xl overflow-hidden animate-fade-up">
                <div className="bg-secondary/20 px-5 py-4 border-b border-hairline/60">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Route</p>
                      <p className="font-medium text-sm">{pickup} → {campus}</p>
                    </div>
                    <button
                      onClick={() => { setFare(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Distance</span>
                    <span className="font-medium">{fare.distanceKm} km</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {fare.minimumApplied ? "Minimum fare" : "Fare"}
                    </span>
                    <span className="font-display text-2xl font-semibold">{fare.fareAmount} NLe</span>
                  </div>

                  {fare.isEstimate && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200">
                        Distance is estimated. Exact fare is confirmed at time of payment.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-5 pb-5">
                  <Button
                    className="w-full h-14 font-display text-base font-semibold tracking-wide shadow-lg hover:shadow-xl active:scale-[0.98] transition-transform duration-200"
                    onClick={handleBookTrip}
                    disabled={booking}
                  >
                    {booking ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Booking your ride...</>
                    ) : (
                      <><ArrowRight className="h-5 w-5 mr-2" /> Book Ride for {fare.fareAmount} NLe</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {!fare && (
              <p className="text-center text-xs text-muted-foreground">
                6 NLe per km · Minimum 20 NLe · Powered by Monime
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TripBooking;
