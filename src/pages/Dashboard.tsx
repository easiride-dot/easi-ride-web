import { Link, useNavigate } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle, MapPin, Navigation, Calendar, CreditCard, LucideIcon, ShieldQuestion, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending_friend_commitment: "bg-amber-500/10 text-amber-200",
  pool_locked_awaiting_driver: "bg-secondary text-muted-foreground",
  driver_assigned: "bg-foreground text-background",
  paid_and_dispatched: "bg-emerald-500/10 text-emerald-300",
};

const statusLabel: Record<string, string> = {
  pending_friend_commitment: "Waiting for seat",
  pool_locked_awaiting_driver: "Finding driver",
  driver_assigned: "Driver assigned",
  paid_and_dispatched: "Dispatched",
};

const Dashboard = () => {
  const { rides } = useRides();
  const { subscription } = useSubscription();
  const { profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claimedSeats, setClaimedSeats] = useState<any[]>([]);
  const [loadingClaimed, setLoadingClaimed] = useState(true);
  const [payingFor, setPayingFor] = useState<string | null>(null);

  const upcomingSub = rides.filter((r) => r.status !== "paid_and_dispatched" && r.paymentType === "subscription");
  const upcomingTrip = rides.filter((r) => r.status !== "paid_and_dispatched" && r.paymentType === "trip");
  const past = rides.filter((r) => r.status === "paid_and_dispatched");

  const daysLeft = subscription
    ? Math.max(0, differenceInDays(new Date(subscription.end_date), new Date()))
    : 0;

  useEffect(() => {
    if (!user) {
      setLoadingClaimed(false);
      return;
    }

    const fetchClaimedSeats = async () => {
      const { data, error } = await supabase
        .from("ride_participants" as any)
        .select(`
          *,
          rides (
            id,
            pickup,
            destination,
            time_slot,
            type,
            status,
            payment_type,
            fare_amount,
            price,
            profiles (full_name)
          )
        `)
        .eq("user_id" as any, user.id)
        .order("claimed_at", { ascending: false });

      if (error) {
        console.error("Error fetching claimed seats:", error);
      } else {
        setClaimedSeats(data || []);
      }
      setLoadingClaimed(false);
    };

    fetchClaimedSeats();
  }, [user]);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Your rides</h1>
        </div>
        <div className="flex gap-2">
          {subscription ? (
            <Button asChild size="sm" variant="hero">
              <Link to="/request">
                <Plus className="h-4 w-4 mr-1" /> Request
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="hero">
              <Link to="/trip/book">
                <Plus className="h-4 w-4 mr-1" /> Book Trip
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Verification status banner */}
      {profile && profile.verification_status !== 'approved' && (
        <div className={`rounded-2xl p-4 flex gap-3 ${
          profile.verification_status === 'pending' 
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200' 
            : 'bg-destructive/10 border border-destructive/20 text-destructive-foreground'
        }`}>
          {profile.verification_status === 'pending' ? (
            <ShieldQuestion className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {profile.verification_status === 'pending' 
                ? "Verification Pending" 
                : "ID Rejected"}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              {profile.verification_status === 'pending' 
                ? "The admin is reviewing your student ID. You can book rides once approved." 
                : "Your student ID was not approved. Please contact support or update your profile."}
            </p>
          </div>
        </div>
      )}

      {/* Subscription card */}
      <div className="glass-card relative overflow-hidden rounded-3xl p-6 shadow-elevated">
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="relative">
          {subscription ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active plan</p>
                  <p className="mt-1 font-display text-xl font-semibold capitalize">
                    {subscription.plan_type} • Weekly
                  </p>
                </div>
                <span className="rounded-full border border-hairline bg-secondary/40 px-3 py-1 text-xs">
                  {daysLeft} days left
                </span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-hairline/70 pt-4 text-sm">
                <Stat icon={Calendar} label="Rides this week" value={`${subscription.rides_used} / ${subscription.rides_limit}`} />
                <Stat icon={CreditCard} label="Renews" value={new Date(subscription.end_date).toLocaleDateString('en-US', { weekday: 'short' })} />
                <Stat icon={Navigation} label="Saved trips" value="2" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="mb-2 text-sm text-muted-foreground">No active subscription</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/checkout/weekly">Get a weekly plan</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Rides */}
      {subscription && (
        <Section title="Subscription Rides">
          {upcomingSub.length === 0 ? (
            <Empty link="/request" text="Book a scheduled ride" />
          ) : (
            <div className="space-y-3">
              {upcomingSub.map((r) => (
                <RideCard key={r.id} ride={r} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Pay-Per-Trip Rides */}
      <Section title="Pay-Per-Trip Rides">
        {upcomingTrip.length === 0 ? (
          <Empty link="/trip/book" text="Book a single trip" />
        ) : (
          <div className="space-y-3">
            {upcomingTrip.map((r) => (
              <RideCard key={r.id} ride={r} />
            ))}
          </div>
        )}
      </Section>

      {/* Past */}
      {past.length > 0 && (
        <Section title="Past rides">
          <div className="space-y-3">
            {past.map((r) => (
              <RideCard key={r.id} ride={r} />
            ))}
          </div>
        </Section>
      )}

      {/* Claimed Seats */}
      {user && (
        <Section title="Claimed Seats">
          {loadingClaimed ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : claimedSeats.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No claimed seats yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {claimedSeats.map((participant) => {
                const ride = participant.rides;
                if (!ride) return null;
                const userShare = Math.round((ride.fare_amount || ride.price) / 3);
                return (
                  <ClaimedSeatCard
                    key={participant.id}
                    participant={participant}
                    ride={ride}
                    userShare={userShare}
                    onPay={async () => {
                      setPayingFor(participant.id);
                      try {
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
                      } catch {
                        toast.error("Unable to start payment");
                      } finally {
                        setPayingFor(null);
                      }
                    }}
                    paying={payingFor === participant.id}
                  />
                );
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const Empty = ({ link, text }: { link: string; text: string }) => (
  <div className="glass-card rounded-2xl p-8 text-center">
    <p className="text-sm text-muted-foreground">No upcoming rides yet.</p>
    <Button asChild className="mt-4" variant="hero">
      <Link to={link}>{text}</Link>
    </Button>
  </div>
);

const Stat = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div>
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="mt-1 font-medium">{value}</div>
  </div>
);

const RideCard = ({ ride }: { ride: ReturnType<typeof useRides>["rides"][number] }) => {
  const navigate = useNavigate();
  const wa = ride.driverPhone?.replace(/\D/g, "") ?? "23278000000";
  
  const handleCardClick = () => {
    if (ride.status !== "paid_and_dispatched") {
      navigate(`/matching/${ride.id}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`glass-card group block rounded-2xl p-5 transition ${ride.status !== "paid_and_dispatched" ? "cursor-pointer hover:shadow-elevated" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${statusStyles[ride.status] ?? "bg-secondary text-muted-foreground"}`}>
          {statusLabel[ride.status] ?? ride.status.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-muted-foreground">{formatRelative(ride.createdAt)}</span>
      </div>
      <div className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{ride.pickup}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Navigation className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{ride.destination}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-hairline/70 pt-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{ride.timeSlot}</span>
          <span className="text-muted-foreground">•</span>
          <span className="capitalize">{ride.type}</span>
        </div>
        {ride.status === "driver_assigned" && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-black"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Driver
          </a>
        )}
      </div>
    </div>
  );
};

const ClaimedSeatCard = ({ participant, ride, userShare, onPay, paying }: { participant: any; ride: any; userShare: number; onPay: () => void; paying: boolean }) => {
  const inviterName = ride.profiles?.full_name || "A student";
  const isPaid = participant.payment_status === 'paid';
  const needsPayment = ride.payment_type === 'trip' && !isPaid;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${statusStyles[ride.status] ?? "bg-secondary text-muted-foreground"}`}>
          {statusLabel[ride.status] ?? ride.status.replace(/_/g, " ")}
        </span>
        {isPaid && (
          <div className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Paid</span>
          </div>
        )}
      </div>
      <div className="mb-3">
        <p className="text-xs text-muted-foreground">Invited by</p>
        <p className="font-medium text-sm">{inviterName}</p>
      </div>
      <div className="space-y-2.5 text-sm mb-4">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{ride.pickup}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Navigation className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{ride.destination}</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-hairline/70 pt-4 text-sm mb-4">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{ride.time_slot}</span>
          <span className="text-muted-foreground">•</span>
          <span className="capitalize">{ride.type}</span>
        </div>
      </div>
      {needsPayment && (
        <div className="p-3 rounded-xl bg-secondary/20 mb-3">
          <p className="text-xs text-muted-foreground mb-1">Your share (1/3 of total fare)</p>
          <p className="font-display text-2xl font-semibold">{userShare} NLe</p>
        </div>
      )}
      {needsPayment && (
        <Button onClick={onPay} disabled={paying} className="w-full h-12">
          {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : <><CreditCard className="h-4 w-4 mr-2" /> Pay {userShare} NLe</>}
        </Button>
      )}
    </div>
  );
};

export default Dashboard;
