import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { ActiveRideMap } from "@/components/MapDisplay";
import { Navigation, Loader2 } from "lucide-react";
import { Drawer } from "vaul";

function getStatusLabel(status: string): string {
  switch (status) {
    case "driver_assigned": return "Driver on the way";
    case "driver_arrived": return "Driver arrived";
    case "in_progress": return "Ride in progress";
    case "completed": return "Ride completed";
    case "paid_and_dispatched": return "Paid and dispatched";
    default: return "Finding your driver...";
  }
}

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
    } catch {
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
  const waitingForDriver = ride.status === "pool_locked_awaiting_driver";
  const isAssigned = ride.status === "driver_assigned" || ride.status === "driver_arrived";
  const isDispatched = ride.status === "paid_and_dispatched";
  const isCompleted = ride.status === "completed" || ride.status === "cancelled";
  const requiresPayment = ride.paymentType === "trip" && ride.paymentStatus !== "paid";
  const showActiveRide = waitingForDriver || isAssigned || ride.status === "pending_driver_acceptance" || ride.status === "in_progress" || isDispatched;

  // Waiting states — show old spinner UI
  if (!showActiveRide) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-col items-center justify-center text-center min-h-[70vh]">
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
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* Full-screen map */}
      {showActiveRide && (
        <ActiveRideMap ride={ride} driverLocation={driverLocation} />
      )}

      {/* Top header overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-12 pb-4 px-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-hairline/50 shadow-elevated"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Top status chip */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-background/90 backdrop-blur-md border border-hairline rounded-full px-4 py-2 shadow-elevated flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {getStatusLabel(ride.status)}
          </span>
        </div>
      </div>

      {/* Vaul Drawer bottom sheet */}
      <Drawer.Root snapPoints={[0.35, 0.65]} defaultSnap={0.35} modal={false}>
        <Drawer.Portal>
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-10 bg-background rounded-t-[20px] border-t border-border focus:outline-none"
            style={{ height: "65vh" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Scrollable content */}
            <div
              className="overflow-y-auto px-4 pb-8"
              style={{ maxHeight: "calc(65vh - 32px)" }}
            >
              {/* Status banner */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium uppercase tracking-wider text-foreground">
                  {getStatusLabel(ride.status)}
                </span>
              </div>

              {/* Driver info card */}
              <div className="bg-card border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Your Driver
                    </p>
                    <p className="font-semibold text-base text-foreground">
                      {ride.driverName || "Driver"}
                    </p>
                    <p className="text-sm text-muted-foreground">{ride.vehicle || "Verified Keke"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ETA</p>
                    <p className="text-2xl font-bold text-foreground">{ride.etaMinutes ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">min</p>
                  </div>
                </div>
              </div>

              {/* Route card */}
              <div className="bg-card border border-border rounded-2xl p-4 mb-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Pickup
                      </p>
                      <p className="text-sm font-medium text-foreground">{ride.pickup}</p>
                    </div>
                  </div>
                  <div className="ml-1.5 w-px h-4 bg-border" />
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Destination
                      </p>
                      <p className="text-sm font-medium text-foreground">{ride.destination}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fare card */}
              <div className="bg-card border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Trip Fare
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {ride.fareAmount ?? ride.price ?? "—"}
                      <span className="text-sm font-normal text-muted-foreground ml-1">NLe</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Distance
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {ride.distanceKm ? ride.distanceKm.toFixed(1) : "—"}
                      <span className="text-sm font-normal text-muted-foreground ml-1">km</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment button */}
              {ride.paymentType === "trip" && ride.paymentStatus === "pending" && (
                <button
                  onClick={handlePayForTrip}
                  disabled={paying}
                  className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
                >
                  {paying ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Pay {ride.fareAmount ?? ride.price} NLe</span>
                  )}
                </button>
              )}

              {/* Paid / subscription badge */}
              {(ride.paymentStatus === "paid" || ride.paymentType === "subscription") && (
                <div className="w-full bg-green-500/10 border border-green-500/30 rounded-2xl py-3 px-4 flex items-center justify-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-500 font-medium text-sm">
                    {ride.paymentType === "subscription" ? "Covered by subscription" : "Payment confirmed"}
                  </span>
                </div>
              )}

              {/* Emergency / Contact */}
              <button
                onClick={() => {
                  window.open(
                    `https://wa.me/23278000000?text=EMERGENCY: I need help with my Easi Ride. Ride ID: ${ride.id}`,
                    "_blank"
                  );
                }}
                className="w-full border border-border text-muted-foreground font-medium py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform"
              >
                Emergency / Contact Support
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
};

export default Matching;