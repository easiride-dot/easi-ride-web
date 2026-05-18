import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Clock, Users, User, ArrowRight, Locate, LucideIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRides, RideType } from "@/context/RideContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const TIME_SLOTS = ["06:30", "07:00", "07:30", "08:00", "16:00", "17:00"];
const CAMPUSES = ["Fourah Bay College", "IPAM Tower Hill", "Njala University", "Limkokwing"];

const Request = () => {
  const navigate = useNavigate();
  const { createRide } = useRides();
  const { subscription, loading: subLoading } = useSubscription();
  const { profile, loading: profileLoading } = useProfile();

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState(CAMPUSES[0]);
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[1]);
  const rideType = "solo";

  const detect = () => {
    setPickup("Wilkinson Road, near junction");
    toast.success("Location detected");
  };

  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const ride = await createRide({ pickup: pickup.trim(), destination, timeSlot, type: rideType, price: 0 });

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
        {/* Locations card */}
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="relative flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <Label htmlFor="pickup" className="text-xs text-muted-foreground">Pickup</Label>
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
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="mt-0.5 h-8 w-full bg-transparent text-base outline-none"
              >
                {CAMPUSES.map((c) => (
                  <option key={c} value={c} className="bg-background">{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Time slot */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Time slot
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map((t) => {
              const active = t === timeSlot;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeSlot(t)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-hairline bg-secondary/30 text-foreground hover:border-foreground/50"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="font-display text-lg font-medium capitalize text-foreground/90">
              Covered by your weekly plan
            </p>
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
