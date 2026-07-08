import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, MapPin, Navigation, User, LucideIcon, Loader2, Share2, Users, ArrowLeft, MessageSquareWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { MapDisplay } from "@/components/MapDisplay";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

const Matching = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rides, loading } = useRides();
  const { user } = useAuth();
  const ride = rides.find((r) => r.id === id);
  const [paying, setPaying] = useState(false);
  
  const driverLocation = useDriverLocation(ride?.driverId);

  const handlePayForTrip = async () => {
    if (!ride) return;
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/monime-create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          paymentType: "trip",
          rideId: ride.id,
          originAddress: ride.pickup,
          campus: ride.destination,
          rideType: ride.type,
          passengerCount: ride.type === "shared" ? 3 : 1,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.redirectUrl) {
        toast.error(result?.error || "Unable to start payment");
        setPaying(false);
        return;
      }
      window.location.href = result.redirectUrl;
    } catch (error) {
      toast.error("Unable to start payment");
      setPaying(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!ride) navigate("/dashboard");
  }, [ride?.id, loading, navigate]);

  if (loading || !ride) return null;

  const waitingForSeat = ride.status === "pending_friend_commitment";
  const waitingForDriver = ride.status === "pool_locked_awaiting_driver" || ride.status === "pending_driver_acceptance";
  const isAssigned = ride.status === "driver_assigned";
  const isDispatched = ride.status === "paid_and_dispatched";
  const requiresPayment = ride.paymentType === "trip" && ride.paymentStatus !== "paid";
  const isShared = ride.type === "shared";
  const isFriend = user && ride.userId !== user.id;
  const friendNeedsToPay = isShared && isFriend && requiresPayment && (waitingForSeat || waitingForDriver);

  const waNumber = ride.driverPhone?.replace(/\D/g, "") ?? "23278000000";
  const userShare = Math.round((ride.fareAmount || ride.price) / 3);

  const STUDENT_STATUS_CONFIG: Record<string, { label: string; sublabel: string; color: string; bgColor: string }> = {
    driver_assigned: {
      label: "Driver Assigned",
      sublabel: "Your driver is on the way",
      color: "text-blue-400", bgColor: "bg-blue-500/15",
    },
    paid_and_dispatched: {
      label: "On Your Way",
      sublabel: "Enjoy your ride!",
      color: "text-emerald-400", bgColor: "bg-emerald-500/15",
    },
  };

  const statusCfg = STUDENT_STATUS_CONFIG[ride.status] ?? STUDENT_STATUS_CONFIG.driver_assigned;

  // Friend payment / waiting states — unchanged
  if (friendNeedsToPay) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-4">
            <div>
              <p className="text-sm font-medium text-emerald-300">Seat claimed!</p>
              <p className="text-xs text-muted-foreground mt-1">Complete your payment to confirm your spot in the shared ride.</p>
            </div>
          </div>
          <div className="mb-4 p-4 rounded-xl bg-secondary/20">
            <p className="text-xs text-muted-foreground mb-1">Your share (1/3 of total fare)</p>
            <p className="font-display text-3xl font-semibold">{userShare} NLe</p>
          </div>
          <Button onClick={handlePayForTrip} disabled={paying} className="w-full h-12">
            {paying ? <Loader2 className="animate-spin" /> : `Pay ${userShare} NLe`}
          </Button>
        </div>
      </div>
    );
  }

  if (waitingForSeat || waitingForDriver) {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${waitingForSeat ? "min-h-[38vh]" : "min-h-[70vh]"}`}>
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-foreground/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
            <Navigation className="h-5 w-5" />
          </div>
        </div>
        <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight">
          {waitingForSeat ? "Waiting for your friend..." : "Finding a driver..."}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {waitingForSeat
            ? "Share your invite link so your friend can confirm their seat before we dispatch a driver."
            : "Hang tight. We're matching you with the closest verified keke headed your way."}
        </p>
      </div>
    );
  }

  const [drawerOpen, setDrawerOpen] = useState(true);
  const [snap, setSnap] = useState<number | string | null>(0.85);

  if (isAssigned || isDispatched) {
    return (
      <div className="relative h-[100dvh] bg-black overflow-hidden">
        <MapDisplay driverLocation={driverLocation} isDraggable={false} interactive />

        {/* Top gradient overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-12 pb-4 px-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <button
            onClick={() => navigate("/dashboard")}
            className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-hairline/50 shadow-elevated"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>

        <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} snapPoints={[0.5, 0.85]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} dismissible={false} modal={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40" />
            <Drawer.Content
              className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-3xl bg-[#1A1A1A] border-t border-hairline outline-none max-h-[85dvh]"
              style={{ boxShadow: "0 -8px 30px rgba(0,0,0,0.3)" }}
            >
              <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-border flex-shrink-0" />

              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
                {/* Status banner */}
                <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3", statusCfg.bgColor)}>
                  <div className={cn("flex-shrink-0", statusCfg.color)}>
                    {isDispatched ? (
                      <Navigation className="h-5 w-5 animate-pulse" />
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-semibold", statusCfg.color)}>{statusCfg.label}</p>
                    <p className="text-xs text-muted-foreground">{statusCfg.sublabel}</p>
                  </div>
                  {!requiresPayment && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ETA</p>
                      <p className="text-sm font-bold text-foreground">{ride.etaMinutes || "?"} min</p>
                    </div>
                  )}
                </div>

                {/* Fare / Payment card */}
                <div className="rounded-2xl bg-background border border-hairline p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Trip fare</span>
                    <span className="font-display text-lg font-bold text-foreground">
                      {ride.price != null ? `${ride.price} NLe` : "—"}
                    </span>
                  </div>
                  {isShared && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Your share</span>
                      <span className="font-semibold text-foreground">{userShare} NLe</span>
                    </div>
                  )}
                </div>

                {/* Call / WhatsApp */}
                {!requiresPayment && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-hairline">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Driver</p>
                      <p className="text-sm font-medium text-foreground">{ride.driverName || "Driver"}</p>
                    </div>
                    <a href={`tel:${ride.driverPhone}`}
                      className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition-colors">
                      <Phone className="h-4 w-4 text-emerald-400" />
                    </a>
                    <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"
                      className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition-colors">
                      <MessageCircle className="h-4 w-4 text-emerald-400" />
                    </a>
                  </div>
                )}

                {/* Payment CTA */}
                {requiresPayment && isAssigned && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4">
                    <p className="text-xs text-amber-400 mb-3">Driver is waiting! Pay to confirm your ride.</p>
                    <button onClick={handlePayForTrip} disabled={paying} className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors text-white text-sm font-bold disabled:opacity-50">
                      {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${isShared ? userShare : ride.price} NLe`}
                    </button>
                  </div>
                )}

                {/* Pickup */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
                  <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Pickup</p>
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{ride.pickup}</p>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
                  <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Navigation className="h-3 w-3 text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Destination</p>
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{ride.destination}</p>
                  </div>
                </div>

                {/* Share invite */}
                {isShared && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/claim/${ride.id}`);
                      toast.success("Invite link copied");
                    }}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-background border border-hairline text-sm font-semibold text-foreground hover:bg-secondary/30 transition-colors"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" /> Invite friends to share fare
                  </button>
                )}

                {/* Emergency */}
                <button
                  onClick={() => window.open(`https://wa.me/23278000000?text=EMERGENCY: I need help with my Easi Ride. Ride ID: ${ride.id}`, "_blank")}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  <MessageSquareWarning className="h-5 w-5 text-white" />
                  <span className="text-sm font-semibold text-white uppercase tracking-wider">Emergency</span>
                </button>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  }

  // Trip details / other states
  return (
    <div className="space-y-6 animate-fade-up">
      {isShared && (
        <div className="glass-card p-6 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">Invite friends</div>
              <div className="text-xs text-muted-foreground">Share the ride fare</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/claim/${ride.id}`);
              toast.success("Invite link copied");
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trip details</h3>
        <div className="mt-4 space-y-4">
          <Row icon={MapPin} label="Pickup" value={ride.pickup} />
          <Row icon={Navigation} label="Destination" value={ride.destination} />
        </div>
      </div>

      <Button onClick={() => navigate("/dashboard")} variant="outline" size="lg" className="w-full">
        Back to dashboard
      </Button>
    </div>
  );
};

const Row = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border"><Icon className="h-4 w-4" /></div>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  </div>
);

export default Matching;
