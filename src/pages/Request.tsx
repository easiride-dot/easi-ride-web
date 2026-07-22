import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Clock, Users, User, ArrowRight, Locate, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRides, RideType } from "@/context/RideContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useColleges } from "@/hooks/useColleges";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseApiJson } from "@/lib/parseApiResponse";

const Request = () => {
  const navigate = useNavigate();
  const { createRide } = useRides();
  const { subscription, loading: subLoading } = useSubscription();
  const { profile, loading: profileLoading } = useProfile();

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [timeSlot, setTimeSlot] = useState("08:00");
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [pickupDetails, setPickupDetails] = useState("");
  const [rideType, setRideType] = useState<RideType>("solo");

  const { colleges, loading: collegesLoading } = useColleges();

  useEffect(() => {
    if (colleges.length > 0 && !destination) {
      setDestination(colleges[0].name);
    }
  }, [colleges, destination]);

  const [submitting, setSubmitting] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const detect = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported.");
      return;
    }
    setDetecting(true);
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
            toast.success("Location detected", { id: toastId });
          } else {
            toast.error(error || "Could not detect location", { id: toastId });
          }
        } catch {
          toast.error("Failed to detect location", { id: toastId });
        } finally {
          setDetecting(false);
        }
      },
      () => {
        toast.error("Please allow location access in your browser settings.", { id: toastId });
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.verification_status !== 'approved') {
      toast.error("Your account must be approved before you can book a ride.");
      return;
    }
    if (!pickup.trim()) {
      toast.error("Please add a pickup location");
      return;
    }
    if (pickup.length > 200) {
      toast.error("Pickup location too long");
      return;
    }
    const customLocation = pickupDetails.trim() 
      ? `${pickup.trim()} (${pickupDetails.trim()})`
      : pickup.trim();

    setSubmitting(true);
    try {
      const ride = await createRide({
        pickup: isReturnTrip ? destination : customLocation,
        destination: isReturnTrip ? customLocation : destination,
        timeSlot,
        type: rideType,
        price: 0
      });

      if (!ride) {
        toast.error("Could not create ride. Please try again.");
      } else {
        navigate(`/matching/${ride.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create ride";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isVerified = profile?.verification_status === 'approved';

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New ride</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Where to today?</h1>
      </div>

      {!subLoading && !subscription ? (
      <div className="glass-card flex flex-col items-center justify-center p-8 text-center rounded-2xl">
          <h2 className="font-display text-xl font-semibold mb-2">No active subscription</h2>
          <p className="text-sm text-muted-foreground mb-6">You need a weekly plan to book scheduled rides.</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button asChild variant="hero">
              <Link to="/checkout/weekly">Get weekly plan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/trip/book">Pay per trip instead</Link>
            </Button>
          </div>
        </div>
      ) : !profileLoading && !isVerified ? (
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center rounded-3xl border-amber-500/20 bg-amber-500/5">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="font-display text-2xl font-semibold mb-3">Verification required</h2>
          <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
            Your student ID is currently {profile?.verification_status === 'pending' ? 'being reviewed' : 'rejected'}. 
            You'll be able to book rides as soon as an admin approves your profile.
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Direction Toggle tabs */}
        <div className="flex p-1 bg-secondary/30 rounded-xl border border-hairline/40 shadow-inner">
          <button
            type="button"
            onClick={() => setIsReturnTrip(false)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              !isReturnTrip
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Home → College
          </button>
          <button
            type="button"
            onClick={() => setIsReturnTrip(true)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              isReturnTrip
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            College → Home
          </button>
        </div>

        {/* Locations card */}
        <div className="glass-card overflow-hidden rounded-2xl">
          {!isReturnTrip ? (
            <>
              {/* Row 1: Custom Location (Pickup) */}
              <div className="relative flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="pickup" className="text-xs text-muted-foreground">Pickup Location</Label>
                  <Input
                    id="pickup"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    placeholder="Enter your location"
                    className="h-8 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={detect}
                  disabled={detecting}
                  className="rounded-lg border border-hairline bg-secondary/50 p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label="Detect my location"
                >
                  {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                </button>
              </div>
              <div className="border-t border-hairline/60" />
              {/* Row 2: College (Destination) */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Destination Campus</Label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-0.5 h-8 w-full bg-transparent text-base outline-none"
                    disabled={collegesLoading}
                  >
                    {colleges.map((c) => (
                      <option key={c.id} value={c.name} className="bg-background">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Row 1: College (Pickup) */}
              <div className="relative flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Pickup Campus</Label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-0.5 h-8 w-full bg-transparent text-base outline-none"
                    disabled={collegesLoading}
                  >
                    {colleges.map((c) => (
                      <option key={c.id} value={c.name} className="bg-background">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border-t border-hairline/60" />
              {/* Row 2: Custom Location (Destination) */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="destination-custom" className="text-xs text-muted-foreground">Destination Location</Label>
                  <Input
                    id="destination-custom"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    placeholder="Enter your location"
                    className="h-8 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={detect}
                  disabled={detecting}
                  className="rounded-lg border border-hairline bg-secondary/50 p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label="Detect my location"
                >
                  {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
          <div className="border-t border-hairline/60" />
          <div className="flex items-center gap-3 p-4 bg-secondary/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label htmlFor="trip-details" className="text-xs text-muted-foreground">Landmark / Lane details (optional)</Label>
              <Input
                id="trip-details"
                value={pickupDetails}
                onChange={(e) => setPickupDetails(e.target.value)}
                placeholder="e.g., opposite mosque, blue gate, Lane 3..."
                className="h-8 border-0 bg-transparent px-0 text-base focus-visible:ring-0 text-foreground font-medium placeholder:font-normal"
              />
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
              className="h-12 rounded-xl border border-hairline bg-secondary/30 text-foreground px-4 text-base focus-visible:ring-1 focus-visible:ring-foreground/50 w-full max-w-[160px]"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Ride type</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRideType("solo")}
              className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                rideType === "solo" ? "border-foreground bg-foreground text-background" : "border-hairline bg-secondary/20"
              }`}
            >
              <User className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Solo</div>
                <div className={`text-xs ${rideType === "solo" ? "text-background/70" : "text-muted-foreground"}`}>
                  Match with a driver now
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRideType("shared")}
              className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                rideType === "shared" ? "border-foreground bg-foreground text-background" : "border-hairline bg-secondary/20"
              }`}
            >
              <Users className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Shared</div>
                <div className={`text-xs ${rideType === "shared" ? "text-background/70" : "text-muted-foreground"}`}>
                  Invite a friend first
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="font-display text-lg font-medium capitalize text-foreground/90">
              {rideType === "shared" ? "Shared ride from weekly plan" : "Covered by your weekly plan"}
            </p>
            {rideType === "shared" && (
              <p className="mt-1 text-xs text-muted-foreground">Your ride will wait for a seat claim before driver matching.</p>
            )}
          </div>
          <Button type="submit" variant="hero" size="lg" disabled={submitting}>
            {submitting ? "Booking…" : (<>Confirm booking <ArrowRight className="h-4 w-4" /></>)}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
};

export default Request;
