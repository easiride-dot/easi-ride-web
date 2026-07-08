import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, MapPin, Navigation, LucideIcon, Loader2, Share2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { MapDisplay } from "@/components/MapDisplay";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { Drawer } from "vaul";

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

  if (isAssigned || isDispatched) {
    return (
      <div className="relative w-full h-[100dvh] overflow-hidden">
        <MapDisplay driverLocation={driverLocation} isDraggable={false} interactive={false} />

        <button
          onClick={() => navigate("/dashboard")}
          className="absolute top-14 left-4 z-20 flex items-center justify-center h-9 w-9 rounded-full bg-background/80 backdrop-blur-md shadow"
        >
          <svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <Drawer.Root snapPoints={[0.15, 0.35, 0.75]} defaultSnap={0.35} modal={false}>
          <Drawer.Portal>
            <Drawer.Content
              className="fixed bottom-0 left-0 right-0 z-10 bg-background rounded-t-[20px] focus:outline-none shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
              style={{ height: "75vh" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-medium text-foreground shrink-0">
                    {ride.driverName?.[0] ?? "D"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground">{ride.driverName || "Driver"}</p>
                    <p className="text-sm text-muted-foreground">{ride.vehicle || "Verified Keke"}</p>
                  </div>
                </div>

                {isAssigned ? (
                  <p className="text-[42px] font-light text-foreground leading-none mb-1">
                    {ride.etaMinutes || "?"} <span className="text-base font-normal text-muted-foreground">min away</span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground mb-1">On your way</p>
                    <p className="text-[42px] font-light text-foreground leading-none mb-1">
                      {ride.etaMinutes || "?"} <span className="text-base font-normal text-muted-foreground">min</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{ride.destination}</p>
                  </>
                )}

                {!requiresPayment && (
                  <div className="flex items-center gap-5 mt-4">
                    <a href={`tel:${ride.driverPhone}`} className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </div>
                )}
              </div>

              <hr className="border-t border-border mx-5" />

              <div className="overflow-y-auto px-5 pb-8 pt-4" style={{ maxHeight: "calc(75vh - 220px)" }}>
                {requiresPayment && isAssigned && (
                  <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">Driver is waiting! Pay to confirm your ride.</p>
                    <button onClick={handlePayForTrip} disabled={paying} className="w-full bg-amber-500 text-white font-medium py-3.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${isShared ? userShare : ride.price} NLe`}
                    </button>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-foreground shrink-0" />
                      <div className="w-0.5 h-8 bg-muted-foreground/30 shrink-0" />
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm font-medium text-foreground">{ride.pickup}</p>
                      <p className="text-xs text-muted-foreground mt-3">Destination</p>
                      <p className="text-sm font-medium text-foreground">{ride.destination}</p>
                    </div>
                  </div>
                </div>

                {isShared && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/claim/${ride.id}`);
                      toast.success("Invite link copied");
                    }}
                    className="w-full flex items-center gap-3 py-3.5 text-sm font-medium text-foreground border-t border-border"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" /> Invite friends to share fare
                  </button>
                )}

                <button
                  onClick={() => window.open(`https://wa.me/23278000000?text=EMERGENCY: I need help with my Easi Ride. Ride ID: ${ride.id}`, "_blank")}
                  className="w-full flex items-center gap-3 py-3.5 text-sm font-medium text-destructive border-t border-border"
                >
                  Emergency / Contact Support
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
