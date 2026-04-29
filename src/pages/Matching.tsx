import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, Check, MapPin, Navigation, LucideIcon } from "lucide-react";

const Matching = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rides, loading } = useRides();
  const ride = rides.find((r) => r.id === id);
  const [matched, setMatched] = useState(ride?.status === "assigned");

  useEffect(() => {
    if (loading) return;
    if (!ride) {
      navigate("/dashboard");
      return;
    }
    setMatched(ride.status !== "pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.id, loading]);

  if (loading || !ride) return null;

  if (!matched) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-foreground/20" />
          <span className="absolute inline-flex h-16 w-16 animate-pulse-slow rounded-full bg-foreground/30" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
            <Navigation className="h-5 w-5" />
          </div>
        </div>
        <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight">Finding a driver…</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Hang tight. We're matching you with the closest verified keke headed your way.
        </p>
      </div>
    );
  }

  const waNumber = ride.driverPhone?.replace(/\D/g, "") ?? "23278000000";

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3 rounded-full border border-hairline bg-secondary/30 px-4 py-2 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {ride.status === "assigned" ? `Driver assigned • Arriving in ${ride.etaMinutes || "?"} min` : "Finding your driver..."}
      </div>

      <div className="glass-card overflow-hidden rounded-3xl shadow-elevated">
        <div className="flex items-center gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary border border-hairline font-display text-lg font-semibold">
            {ride.driverName?.[0] ?? "D"}
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">{ride.driverName || "Assigning..."}</div>
            <div className="text-sm text-muted-foreground">{ride.vehicle || "Verified Keke"}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ETA</div>
            <div className="font-display text-2xl font-semibold">{ride.etaMinutes ?? "?"}m</div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-hairline/70">
          <a
            href={`tel:${ride.driverPhone}`}
            className="flex items-center justify-center gap-2 py-4 text-sm hover:bg-secondary/40"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Hi, I just booked an Easi Ride to " + ride.destination)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 border-l border-hairline/70 py-4 text-sm hover:bg-secondary/40"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trip details</h3>
        <div className="mt-4 space-y-4">
          <Row icon={MapPin} label="Pickup" value={ride.pickup} />
          <div className="ml-4 h-4 w-px bg-hairline" />
          <Row icon={Navigation} label="Destination" value={ride.destination} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-hairline/70 pt-4 text-sm">
          <Stat label="Time" value={ride.timeSlot} />
          <Stat label="Type" value={ride.type === "shared" ? "Shared" : "Solo"} />
          <Stat label="Price" value={`${ride.price} NLe`} />
        </div>
      </div>

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
};

const Row = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-hairline">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

export default Matching;
