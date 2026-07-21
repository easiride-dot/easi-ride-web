import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { MapPin, Navigation, Clock, Users, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PoolRide {
  id: string;
  pickup: string;
  destination: string;
  time_slot: string;
  type: string;
  status: string;
  created_at: string;
  user_id: string;
  payment_type: string;
  price: number;
  fare_amount: number | null;
  seats_claimed: number;
  profiles: {
    full_name: string | null;
  } | null;
}

const ClaimSeat = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [ride, setRide] = useState<PoolRide | null>(null);
  const [loadingRide, setLoadingRide] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Invalid invite link.");
      setLoadingRide(false);
      return;
    }

    const fetchRide = async () => {
      setLoadingRide(true);

      const { data, error: fetchError } = await supabase
        .from("rides")
        .select("id, pickup, destination, time_slot, type, status, created_at, user_id, payment_type, price, fare_amount, seats_claimed, profiles(full_name)")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !data) {
        console.error("Failed to fetch ride:", fetchError);
        setError("This ride pool could not be found or no longer exists.");
      } else if (data.status !== "pending_friend_commitment") {
        setError("This pool is no longer accepting seat claims — it may have already been locked.");
      } else {
        setRide(data as PoolRide);
      }
      setLoadingRide(false);
    };

    fetchRide();
  }, [id]);

  const handleClaimSeat = async () => {
    if (authLoading) {
      return; // Wait for auth to complete
    }
    if (!user) {
      toast.error("Please sign in first to claim your seat.");
      navigate(`/auth?redirect=/claim/${id}`, { state: { rideId: id } });
      return;
    }
    if (!ride) return;

    // Prevent users from claiming their own rides
    if (ride.user_id === user.id) {
      toast.error("You cannot claim your own ride. This link is meant for friends to join your shared ride.");
      return;
    }

    setClaiming(true);
    try {
      const { error: updateError } = await supabase
        .rpc("claim_shared_ride_seat", {
          p_ride_id: ride.id,
        });

      if (updateError) {
        console.error("RPC Error:", updateError);
        toast.error(`Could not claim your seat: ${updateError.message || "The pool may have already been locked."}`);
        return;
      }

      setClaimed(true);
      toast.success("Seat claimed! Waiting for a driver to be assigned.");
      // Trigger driver broadcast
      try {
        const apiBase = import.meta.env.VITE_API_URL || "";
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${apiBase}/api/broadcast-ride`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ rideId: ride.id }),
        });
      } catch {
        // best-effort
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (authLoading || loadingRide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>

      <main className="container max-w-md py-12 animate-fade-up">
        {error ? (
          <div className="glass-card flex flex-col items-center p-10 text-center rounded-3xl border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="font-display text-2xl font-semibold mb-2">Seat Unavailable</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        ) : claimed ? (
          <div className="glass-card flex flex-col items-center p-10 text-center rounded-3xl border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
            <h1 className="font-display text-2xl font-semibold mb-2">Seat Claimed!</h1>
            {ride.payment_type === 'trip' ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Your seat is locked in. Please complete your payment to confirm your spot.
                </p>
                <div className="mb-6 p-4 rounded-xl bg-secondary/20">
                  <p className="text-xs text-muted-foreground mb-1">Your share (1/3 of total fare)</p>
                  <p className="font-display text-3xl font-semibold">
                    {ride.fare_amount ? Math.round(ride.fare_amount / 3) : Math.round(ride.price / 3)} NLe
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    const response = await fetch("/api/monime-create-checkout", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                      },
                      body: JSON.stringify({
                        paymentType: "trip",
                        rideId: ride.id,
                        originAddress: ride.pickup,
                        campus: ride.destination,
                        rideType: ride.type,
                        passengerCount: 3,
                      }),
                    });
                    const result = await response.json().catch(() => null);
                    if (!response.ok || !result?.redirectUrl) {
                      toast.error(result?.error || "Unable to start payment");
                      return;
                    }
                    window.location.href = result.redirectUrl;
                  }}
                  variant="hero"
                  className="w-full"
                >
                  Pay Now
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-6">
                  Your seat is locked in. A driver will be assigned shortly — payment is covered by the subscription.
                </p>
                {user ? (
                  <Button asChild variant="hero">
                    <Link to="/dashboard">View your dashboard</Link>
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate(`/auth?redirect=/dashboard`, { state: { rideId: ride.id } })}
                    variant="hero"
                  >
                    Sign In to View Dashboard
                  </Button>
                )}
              </>
            )}
          </div>
        ) : ride ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Shared Ride Invitation</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Claim My Seat</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{ride.profiles?.full_name || "A student"}</span> has invited you to share a keke ride. Confirm your seat below — no payment is required at this stage.
              </p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Pickup */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary border border-hairline">
                  <MapPin className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium text-sm">{ride.pickup}</p>
                </div>
              </div>
              <div className="border-t border-hairline/60" />
              {/* Destination */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Navigation className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium text-sm">{ride.destination}</p>
                </div>
              </div>
              <div className="border-t border-hairline/60" />
              {/* Time + Type */}
              <div className="grid grid-cols-2 divide-x divide-hairline/60">
                <div className="flex items-center gap-3 p-4">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup time</p>
                    <p className="font-medium text-sm">{ride.time_slot}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ride type</p>
                    <p className="font-medium text-sm capitalize">{ride.type}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pool status badge */}
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              {ride.seats_claimed}/2 seats claimed — {2 - ride.seats_claimed} seat(s) available.
            </div>

            <Button
              className="w-full h-14 font-display text-base font-semibold tracking-wide shadow-lg hover:shadow-xl active:scale-[0.98] transition-transform duration-200"
              onClick={handleClaimSeat}
              disabled={claiming}
            >
              {claiming ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Claiming your seat...</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" /> Claim My Seat</>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              No payment is collected at this step. You'll be notified when a driver is assigned.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default ClaimSeat;
