import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRides } from "@/context/RideContext";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, MapPin, Navigation, User, LucideIcon, Loader2, Share2, Users, ArrowLeft, MessageSquareWarning, CarFront, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
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
  const { rides, loading, refresh } = useRides();
  const { user } = useAuth();
  const [initialRide, setInitialRide] = useState<any | null>(null);
  const ride = rides.find((r) => r.id === id) || initialRide;
  const [paying, setPaying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [snap, setSnap] = useState<number | string | null>(0.85);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [campusCoords, setCampusCoords] = useState<{ lat: number; lon: number } | null>(null);
  
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

  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isPickingDriver, setIsPickingDriver] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [excludedDriverIds, setExcludedDriverIds] = useState<string[]>([]);
  const [showExpiredMessage, setShowExpiredMessage] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState<'idle' | 'submitted' | 'notified' | 'waiting_response' | 'declined' | 'expired' | 'offline'>('idle');
  const [offlineDriverName, setOfflineDriverName] = useState<string | null>(null);
  const [requestedDriver, setRequestedDriver] = useState<any | null>(null);
  const [confirmDriver, setConfirmDriver] = useState<any | null>(null);
  const [fetchingRide, setFetchingRide] = useState(true);
  const countdownStartedRef = useRef(false);
  const invitationIdRef = useRef<string | null>(null);
  const deliveryStateRef = useRef<'idle' | 'submitted' | 'notified' | 'waiting_response' | 'declined' | 'expired' | 'offline'>('idle');

  // Fetch online drivers and listen for invitation changes
  useEffect(() => {
    if (!ride) return;

    if (ride.status === "pool_locked_awaiting_driver") {
      setCountdown(30);
      setShowExpiredMessage(false);
      setSelectedDriverId(null);
      setInvitationId(null);
      setNotificationStatus(null);
      setDeliveryState('idle');
      setRequestedDriver(null);
      setOfflineDriverName(null);
      countdownStartedRef.current = false;

      const fetchDrivers = async () => {
        const { data } = await supabase.rpc("get_online_drivers");
        if (data) setOnlineDrivers(data.filter((d: any) => !excludedDriverIds.includes(d.id)));
      };
      fetchDrivers();

      const channel = supabase
        .channel(`ride-invitations-${ride.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ride_invitations", filter: `ride_id=eq.${ride.id}` },
          (payload: any) => {
            const inv = payload.new;
            const currentInvId = invitationIdRef.current;
            const currentDeliveryState = deliveryStateRef.current;

              if (inv.status === "declined") {
                setExcludedDriverIds((prev) => [...prev, inv.driver_id]);
                if (currentInvId && inv.id === currentInvId) {
                  setDeliveryState('declined');
                  deliveryStateRef.current = 'declined';
                }
              }
              if (inv.status === "accepted" && currentInvId && inv.id === currentInvId) {
                setDeliveryState('idle');
                deliveryStateRef.current = 'idle';
                setNotificationStatus('accepted');
              }
              if (currentInvId && inv.id === currentInvId) {
                setNotificationStatus(inv.notification_status);
                if (inv.notification_status === 'delivered' && currentDeliveryState === 'submitted') {
                  setDeliveryState('notified');
                  deliveryStateRef.current = 'notified';
                }
              }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [ride?.id, ride?.status]);

  // Countdown — starts only after driver acknowledges
  useEffect(() => {
    if (deliveryState !== 'notified') return;
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;
    setCountdown(30);
    setShowExpiredMessage(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowExpiredMessage(true);
          setDeliveryState('expired');
          deliveryStateRef.current = 'expired';
          handleCancelRequest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [deliveryState]);

  // Cancel pending request
  const handleCancelRequest = async () => {
    if (!ride) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${apiBase}/api/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ type: "cancel", rideId: ride.id }),
      });
    } catch {
      // best-effort
    }
  };

  // Pick a driver
  const handlePickDriver = async (driverId: string) => {
    if (!ride) return;
    setIsPickingDriver(true);
    setOfflineDriverName(null);
    setDeliveryState('idle');
    setInvitationId(null);
    setNotificationStatus(null);
    countdownStartedRef.current = false;
    invitationIdRef.current = null;
    deliveryStateRef.current = 'idle';

    const driver = onlineDrivers.find((d: any) => d.id === driverId);
    setRequestedDriver(driver || null);

    try {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiBase}/api/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ type: "pick", rideId: ride.id, driverId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        const errorMsg = result?.error || "Failed to request driver.";
        if (errorMsg.toLowerCase().includes("not online") || errorMsg.toLowerCase().includes("unavailable")) {
          setOfflineDriverName(driver?.full_name || "Driver");
          setDeliveryState('offline');
        } else {
          toast.error(errorMsg);
        }
        return;
      }
      // Track the invitation
      if (result.invitation_id) {
        setInvitationId(result.invitation_id);
        invitationIdRef.current = result.invitation_id;
      }
      setDeliveryState('submitted');
      deliveryStateRef.current = 'submitted';
    } catch (e) {
      console.error("Pick driver error:", e);
      toast.error("Network error. Please try again.");
    } finally {
      setIsPickingDriver(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    if (ride) {
      setFetchingRide(false);
      // Refresh ride data to pick up any stale payment status
      refresh();
      return;
    }
    if (!loading) {
      refresh();
      supabase.from("rides").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (!data) { navigate("/dashboard"); return; }
        setFetchingRide(false);
      });
    }
  }, [ride?.id, id, loading, navigate, refresh, ride]);

  useEffect(() => {
    if (!ride) return;
    const geocode = async (address: string) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=sl`
        );
        const data = await res.json();
        if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      } catch {}
      return null;
    };
    if (!ride.pickupLatitude && ride.pickup) {
      geocode(ride.pickup).then(setPickupCoords);
    } else if (ride.pickupLatitude && ride.pickupLongitude) {
      setPickupCoords({ lat: ride.pickupLatitude, lon: ride.pickupLongitude });
    }
    if (!ride.destinationLatitude && ride.destination) {
      geocode(ride.destination).then(setCampusCoords);
    } else if (ride.destinationLatitude && ride.destinationLongitude) {
      setCampusCoords({ lat: ride.destinationLatitude, lon: ride.destinationLongitude });
    }
  }, [ride?.id, ride?.pickup, ride?.destination, ride?.pickupLatitude, ride?.pickupLongitude, ride?.destinationLatitude, ride?.destinationLongitude]);

  if (fetchingRide || !ride) return null;

  const waitingForSeat = ride.status === "pending_friend_commitment";
  const pickingDriver = ride.status === "pool_locked_awaiting_driver" && deliveryState === 'idle';
  const waitingForDriver = ride.status === "searching_driver" || ride.status === "pending_driver_acceptance";
  const isAssigned = ride.status === "driver_assigned" || ride.status === "driver_arrived" || ride.status === "in_progress";
  const isDispatched = ride.status === "paid_and_dispatched" || ride.status === "completed";
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

  if (waitingForSeat) {
    return (
      <div className="flex flex-col items-center px-5">
        <div className="flex flex-col items-center justify-center text-center min-h-[38vh]">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-foreground/20" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
              <Navigation className="h-5 w-5" />
            </div>
          </div>
          <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight">Waiting for your friend...</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Share your invite link so your friend can confirm their seat before we dispatch a driver.
          </p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/claim/${ride.id}`);
            toast.success("Invite link copied");
          }}
          className="mt-6 w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-background border border-hairline text-sm font-semibold text-foreground hover:bg-secondary/30 transition-colors"
        >
          <Share2 className="h-4 w-4 text-muted-foreground" /> Invite friends to share fare
        </button>
      </div>
    );
  }

  if (pickingDriver) {
    const isOwner = user?.id === ride.userId;
    const selectedDriver = selectedDriverId ? onlineDrivers.find((d: any) => d.id === selectedDriverId) : null;
    return (
      <div className="flex flex-col px-5 pt-8 animate-fade-up">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Available Drivers</h1>
            <p className="text-sm text-muted-foreground">{onlineDrivers.length} driver{onlineDrivers.length !== 1 ? 's' : ''} online</p>
          </div>
        </div>
        {isOwner ? (
          <div className="mt-6 space-y-3 flex-1">
            {onlineDrivers.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16">
                <CarFront className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-sm font-medium text-foreground">No drivers online</p>
                <p className="text-xs text-muted-foreground mt-1">Please check back or contact support.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {onlineDrivers.map((driver: any) => {
                  const initial = driver.full_name?.charAt(0)?.toUpperCase() || "D";
                  return (
                    <div key={driver.id} className="glass-card rounded-2xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
                          <span className="text-lg font-bold text-primary">{initial}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-foreground">{driver.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driver.vehicle}{driver.plate_number ? ` · ${driver.plate_number}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] flex items-center gap-0.5 text-amber-400">★ 4.8</span>
                            <span className="text-[10px] text-muted-foreground">~5 min away</span>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="rounded-xl shrink-0"
                          onClick={() => setConfirmDriver(driver)}
                        >
                          Request
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center min-h-[40vh]">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-foreground/20" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                <Navigation className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">The ride owner is selecting a driver...</p>
          </div>
        )}

        {/* Confirmation overlay */}
        {confirmDriver && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up">
              <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-hairline sm:hidden" />
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <span className="text-2xl font-bold text-primary">{confirmDriver.full_name?.charAt(0)?.toUpperCase() || "D"}</span>
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold">Confirm Driver</h2>
                <p className="mt-1 text-sm text-muted-foreground">{confirmDriver.full_name}</p>
                <p className="text-xs text-muted-foreground">{confirmDriver.vehicle}{confirmDriver.plate_number ? ` · ${confirmDriver.plate_number}` : ""}</p>
              </div>
              <div className="mt-6 space-y-3">
                <Button
                  size="lg"
                  className="w-full rounded-2xl h-14 text-base font-semibold"
                  onClick={() => { handlePickDriver(confirmDriver.id); setConfirmDriver(null); }}
                  disabled={isPickingDriver}
                >
                  {isPickingDriver ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Send Request
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setConfirmDriver(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isAssigned && !isDispatched && (waitingForDriver || deliveryState === 'submitted' || deliveryState === 'notified' || deliveryState === 'offline' || deliveryState === 'declined' || deliveryState === 'expired')) {
    const selectedDriver = requestedDriver || (selectedDriverId ? onlineDrivers.find((d: any) => d.id === selectedDriverId) : null);
    const initial = selectedDriver?.full_name?.charAt(0)?.toUpperCase() || "D";
    const isUrgent = countdown <= 10;

    // Driver offline error
    if (deliveryState === 'offline') {
      return (
        <div className="flex flex-col items-center px-5 pt-12 animate-fade-up">
          <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Driver Unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {offlineDriverName || "Your selected driver"} is currently unavailable.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please choose another driver.
            </p>
            <Button
              size="lg"
              className="mt-8 w-full rounded-2xl h-14 text-base font-semibold"
              onClick={() => {
                setDeliveryState('idle');
                deliveryStateRef.current = 'idle';
                setSelectedDriverId(null);
              }}
            >
              Choose Another Driver
            </Button>
          </div>
        </div>
      );
    }

    // Declined by driver
    if (deliveryState === 'declined') {
      return (
        <div className="flex flex-col items-center px-5 pt-12 animate-fade-up">
          <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
              <Navigation className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Driver declined</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedDriver?.full_name || "The driver"} declined your request.
            </p>
            <Button
              size="lg"
              className="mt-8 w-full rounded-2xl h-14 text-base font-semibold"
              onClick={() => {
                setDeliveryState('idle');
                deliveryStateRef.current = 'idle';
                setSelectedDriverId(null);
                setShowExpiredMessage(false);
              }}
            >
              Choose Another Driver
            </Button>
          </div>
        </div>
      );
    }

    // Expired / No response
    if (deliveryState === 'expired' || showExpiredMessage) {
      return (
        <div className="flex flex-col items-center px-5 pt-12 animate-fade-up">
          <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <Navigation className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Driver did not respond</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We'll help you find another driver.
            </p>
            <Button
              size="lg"
              className="mt-8 w-full rounded-2xl h-14 text-base font-semibold"
              onClick={() => {
                setDeliveryState('idle');
                deliveryStateRef.current = 'idle';
                setSelectedDriverId(null);
                setShowExpiredMessage(false);
                countdownStartedRef.current = false;
              }}
            >
              Choose Another Driver
            </Button>
          </div>
        </div>
      );
    }

    // Active delivery timeline
    return (
      <div className="flex flex-col items-center px-5 pt-12 animate-fade-up">
        {/* Driver avatar */}
        <div className="relative flex h-24 w-24 items-center justify-center mb-8">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-foreground/20" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
            <span className="text-2xl font-bold text-primary">{initial}</span>
          </div>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {deliveryState === 'submitted' ? 'Contacting driver...' : 'Finding your driver...'}
        </h1>

        {selectedDriver && (
          <div className="mt-4 w-full glass-card rounded-2xl p-4 text-center">
            <p className="text-base font-semibold text-foreground">{selectedDriver.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedDriver.vehicle}{selectedDriver.plate_number ? ` · ${selectedDriver.plate_number}` : ""}
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-8 w-full max-w-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ride Submitted</p>
              <p className="text-[10px] text-muted-foreground">Request sent to driver</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
              deliveryState === 'submitted' ? "bg-muted border border-hairline" : "bg-emerald-500/20"
            )}>
              {deliveryState === 'notified' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Clock className={cn("h-4 w-4", deliveryState === 'submitted' ? "text-muted-foreground" : "text-emerald-400")} />
              )}
            </div>
            <div>
              <p className={cn(
                "text-sm",
                deliveryState === 'submitted' ? "text-muted-foreground" : "font-medium text-foreground"
              )}>Driver Notified</p>
              <p className="text-[10px] text-muted-foreground">
                {deliveryState === 'submitted' ? "Waiting for delivery..." : "Driver received your request"}
              </p>
            </div>
          </div>
          {deliveryState === 'notified' && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Waiting for Response</p>
                  <p className="text-[10px] text-muted-foreground">Driver has 30 seconds to respond</p>
                </div>
              </div>

              <div className={cn(
                "mt-4 flex h-16 w-16 mx-auto flex-col items-center justify-center rounded-2xl border transition-colors duration-300",
                isUrgent ? "border-destructive/50 bg-destructive/10" : "border-hairline bg-secondary"
              )}>
                <span className={cn(
                  "text-3xl font-bold font-display tabular-nums leading-none",
                  isUrgent ? "text-destructive" : "text-foreground"
                )}>
                  {countdown}
                </span>
                <span className="text-[8px] uppercase tracking-widest text-muted-foreground">sec</span>
              </div>
            </>
          )}
        </div>

        {deliveryState === 'notified' && (
          <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs">
            If your driver doesn't respond, we'll help you find another one.
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-6 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleCancelRequest}
        >
          Cancel Ride
        </Button>
      </div>
    );
  }

  // Show payment screen after driver accepts (pay-per-trip only)
  const needsPaymentAfterAccept = (isAssigned || isDispatched) && ride.paymentType === "trip" && ride.paymentStatus !== "paid";
  if (needsPaymentAfterAccept) {
    return (
      <div className="flex flex-col px-5 pt-12 animate-fade-up">
        <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[50vh]">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border-2 border-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Driver Assigned</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ride.driverName} is on the way</p>
          {ride.vehicle && <p className="text-xs text-muted-foreground mt-1">{ride.vehicle}</p>}
        </div>
        <div className="glass-card rounded-2xl p-5 mb-6">
          <p className="text-xs text-muted-foreground mb-1">Trip fare</p>
          <p className="font-display text-3xl font-semibold">{ride.fareAmount ? `${ride.fareAmount} NLe` : `${ride.price} NLe`}</p>
        </div>
        <Button size="lg" className="w-full rounded-2xl h-14 text-base font-semibold" onClick={handlePayForTrip} disabled={paying}>
          {paying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
          Pay Now
        </Button>
      </div>
    );
  }

  if (isAssigned || isDispatched) {
    return (
      <div className="relative h-[100dvh] bg-black overflow-hidden">
        <MapDisplay
          driverLocation={driverLocation}
          isDraggable={false}
          interactive
          pickupLat={pickupCoords?.lat}
          pickupLon={pickupCoords?.lon}
          campusLat={campusCoords?.lat}
          campusLon={campusCoords?.lon}
        />

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
            className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-3xl bg-[#1A1A1A] border-t border-hairline outline-none max-h-[85dvh] overflow-hidden"
            style={{ boxShadow: "0 -8px 30px rgba(0,0,0,0.3)" }}
          >
            {/* Drag handle */}
            <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-border flex-shrink-0" />

            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4 min-h-0">
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
                      {ride.vehicle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ride.vehicle}</p>
                      )}
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
