import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, Check, MapPin, Navigation, LucideIcon, Loader2, ShieldAlert, Share2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Matching = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rides, loading } = useRides();
  const { user } = useAuth();
  const ride = rides.find((r) => r.id === id);
  const [paying, setPaying] = useState(false);

  const handlePayForTrip = async () => {
    if (!ride) return;
    setPaying(true);
    try {
      console.log("Starting payment for ride:", ride.id, "Type:", ride.type, "Payment type:", ride.paymentType);

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

      console.log("Payment response status:", response.status);
      const result = await response.json().catch(() => null);
      console.log("Payment response data:", result);

      if (!response.ok || !result?.redirectUrl) {
        console.error("Payment failed:", result);
        toast.error(result?.error || "Unable to start payment");
        setPaying(false);
        return;
      }
      window.location.href = result.redirectUrl;
    } catch (error) {
      console.error("Payment error:", error);
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
  const isAssigned = ride.status === "driver_assigned";
  const isDispatched = ride.status === "paid_and_dispatched";
  const requiresPayment = ride.paymentType === "trip" && ride.paymentStatus !== "paid";
  const isShared = ride.type === "shared";
  const isFriend = user && ride.userId !== user.id;
  const friendNeedsToPay = isShared && isFriend && requiresPayment && (waitingForSeat || waitingForDriver);

  const waNumber = ride.driverPhone?.replace(/\D/g, "") ?? "23278000000";

  // Calculate friend's share (1/3 of total fare for shared rides)
  const friendShare = Math.round((ride.fareAmount || ride.price) / 3);

  return (
    <div className="space-y-6 animate-fade-up">
      {friendNeedsToPay && (
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-4">
            <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-300">Seat claimed!</p>
              <p className="text-xs text-muted-foreground mt-1">Complete your payment to confirm your spot in the shared ride.</p>
            </div>
          </div>
          <div className="mb-4 p-4 rounded-xl bg-secondary/20">
            <p className="text-xs text-muted-foreground mb-1">Your share (1/3 of total fare)</p>
            <p className="font-display text-3xl font-semibold">{friendShare} NLe</p>
          </div>
          <Button onClick={handlePayForTrip} disabled={paying} className="w-full h-12">
            {paying ? <Loader2 className="animate-spin" /> : `Pay ${friendShare} NLe`}
          </Button>
        </div>
      )}

      {(waitingForSeat || waitingForDriver) && !friendNeedsToPay && (
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
      )}

      {(isAssigned || isDispatched) && (
        <>
          <div className="flex items-center gap-3 rounded-full border border-hairline bg-secondary/30 px-4 py-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="h-3.5 w-3.5" />
            </span>
            {isAssigned ? `Driver assigned - Arriving in ${ride.etaMinutes || "?"} min` : "Paid and dispatched"}
          </div>

          <div className="glass-card overflow-hidden rounded-3xl shadow-elevated">
            <div className="flex items-center gap-4 p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary border font-display text-lg font-semibold">
                {ride.driverName?.[0] ?? "D"}
              </div>
              <div className="flex-1">
                <div className="font-display text-lg font-semibold">{ride.driverName || "Driver"}</div>
                <div className="text-sm text-muted-foreground">{ride.vehicle || "Verified Keke"}</div>
              </div>
            </div>

            {requiresPayment && isAssigned && (
              <div className="p-6 border-t border-hairline/70 bg-amber-500/5">
                <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">Driver is waiting! Pay {ride.price} NLe to confirm.</p>
                </div>
                <Button onClick={handlePayForTrip} disabled={paying} className="w-full h-12 bg-amber-500">
                  {paying ? <Loader2 className="animate-spin" /> : `Pay ${ride.price} NLe`}
                </Button>
              </div>
            )}

            {!requiresPayment && (isAssigned || isDispatched) && (
              <div className="grid grid-cols-2 border-t border-hairline/70">
                <a href={`tel:${ride.driverPhone}`} className="flex items-center justify-center gap-2 py-4 text-sm font-medium"><Phone className="h-4 w-4" /> Call</a>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-l py-4 text-sm font-medium"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              </div>
            )}
          </div>
        </>
      )}

      {isShared && (
        <div className="glass-card p-6 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">{waitingForSeat ? "Send invite link" : "Invite friends"}</div>
              <div className="text-xs text-muted-foreground">
                {waitingForSeat ? "Driver matching starts after your friend claims a seat" : "Share the ride fare"}
              </div>
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

      {!waitingForSeat && !waitingForDriver && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trip details</h3>
          <div className="mt-4 space-y-4">
            <Row icon={MapPin} label="Pickup" value={ride.pickup} />
            <Row icon={Navigation} label="Destination" value={ride.destination} />
          </div>
        </div>
      )}

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link to="/dashboard">Back to dashboard</Link>
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
