import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Smartphone, Bell, MapPin, Car, 
  CheckCircle2, ArrowRight, PartyPopper
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { subscribeToPushNotifications } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  
  const [checkingPwa, setCheckingPwa] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showSuccessCard, setShowSuccessCard] = useState(false);
  
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    // 1. PWA check
    const checkPwa = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      setPwaInstalled(!!isStandalone);
    };
    checkPwa();

    window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
      setPwaInstalled(evt.matches);
    });

    // 2. Notification check
    if (("Notification" in window) && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const handleCheckPwa = () => {
    setCheckingPwa(true);
    setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      if (isStandalone) {
        setPwaInstalled(true);
        toast.success("App installed successfully!");
      } else {
        toast.error("It looks like you are still in the browser. Please follow the installation instructions.");
      }
      setCheckingPwa(false);
    }, 1000);
  };

  const requestNotifications = async () => {
    if (!user) return;
    if (!("Notification" in window)) {
      toast.error("Notifications are not supported in this browser.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeToPushNotifications(user.id);
        setNotificationsEnabled(true);
        toast.success("Notifications enabled!");
      } else {
        toast.error("You can enable notifications later from your browser settings.");
      }
    } catch (err) {
      toast.error("Failed to request notification permission.");
    }
  };

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationEnabled(true);
        toast.success("Location services enabled!");
      },
      () => {
        toast.error("Please allow location access in your browser settings to easily find nearby rides.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  };

  const handleBookRide = async () => {
    if (!user) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      if (error) throw error;
      
      setShowSuccessCard(true);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setCompleting(false);
    }
  };
  
  const handleContinue = () => {
    navigate("/trip/book", { replace: true });
    window.location.reload(); 
  };

  const steps = [
    { completed: pwaInstalled },
    { completed: notificationsEnabled },
    { completed: locationEnabled },
    { completed: showSuccessCard }, 
  ];
  
  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;

  if (showSuccessCard) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white p-6 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-full max-w-sm glass-card rounded-3xl p-8 border border-white/10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <PartyPopper className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-3">You're Ready!</h2>
            <p className="text-sm text-white/70 mb-8 leading-relaxed">
              You'll now receive ride updates, notifications, and enjoy the full Easi Ride experience.
            </p>
            <button 
              onClick={handleContinue}
              className="w-full py-4 bg-white text-black text-base font-bold rounded-2xl hover:bg-white/90 transition-colors shadow-lg shadow-white/10"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 pb-24 overflow-y-auto animate-fade-in">
      <div className="pt-8 pb-6">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome to Easi Ride</h1>
        <p className="text-muted-foreground text-sm">
          Complete these steps to enjoy the best booking experience.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-white mb-3 tracking-wider uppercase">
          <span>Setup Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: PWA */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-500",
          pwaInstalled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              pwaInstalled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {pwaInstalled ? <CheckCircle2 className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Install Easi Ride</h3>
              <div className={cn("overflow-hidden transition-all duration-500", pwaInstalled ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100")}>
                <p className="text-xs text-white/60 mb-4 leading-relaxed">
                  Install Easi Ride to access rides faster and use the app like a native application.
                </p>
                <div className="space-y-4">
                  <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-xs text-white/80 space-y-2">
                    {isIOS ? (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Tap <b>Share</b> <ArrowRight className="inline h-3 w-3" /></li>
                        <li>Select <b>"Add to Home Screen"</b></li>
                        <li>Tap <b>Add</b></li>
                      </ol>
                    ) : (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Tap the browser menu <b>(⋮)</b></li>
                        <li>Tap <b>"Add to Home screen"</b></li>
                        <li>Tap <b>Install</b></li>
                        <li>Open the app from your home screen</li>
                      </ol>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleCheckPwa}
                    disabled={checkingPwa}
                    className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {checkingPwa ? "Checking..." : "I've Installed It"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Notifications */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-500",
          notificationsEnabled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              notificationsEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {notificationsEnabled ? <CheckCircle2 className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Enable Notifications</h3>
              <div className={cn("overflow-hidden transition-all duration-500", notificationsEnabled ? "max-h-0 opacity-0" : "max-h-[200px] opacity-100")}>
                <p className="text-xs text-white/60 mb-4 leading-relaxed">
                  Receive updates when your ride is accepted, your driver is arriving, and your trip is complete.
                </p>
                <button 
                  onClick={requestNotifications}
                  disabled={!pwaInstalled} 
                  className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:hover:bg-white"
                >
                  Enable Notifications
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Location */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-500",
          locationEnabled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              locationEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {locationEnabled ? <CheckCircle2 className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Enable Location</h3>
              <div className={cn("overflow-hidden transition-all duration-500", locationEnabled ? "max-h-0 opacity-0" : "max-h-[200px] opacity-100")}>
                <p className="text-xs text-white/60 mb-4 leading-relaxed">
                  Easi Ride uses your location to find nearby pickup points and estimate fares.
                </p>
                <button 
                  onClick={requestLocation}
                  disabled={!notificationsEnabled}
                  className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:hover:bg-white"
                >
                  Enable Location
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Step 4: Book Your First Ride */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-500 mt-8",
          (pwaInstalled && notificationsEnabled && locationEnabled)
            ? "bg-foreground border-foreground/30 shadow-lg shadow-foreground/20" 
            : "bg-[#141414] border-white/5 opacity-50"
        )}>
          <div className="flex flex-col items-center text-center">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-colors",
              (pwaInstalled && notificationsEnabled && locationEnabled)
                ? "bg-background text-foreground"
                : "bg-white/5 text-white/40"
            )}>
              <Car className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-display font-bold text-white mb-2">Book Your First Ride</h3>
            <p className={cn(
              "text-xs mb-6",
              (pwaInstalled && notificationsEnabled && locationEnabled) ? "text-white/90" : "text-white/40"
            )}>
              You're all set.
            </p>
            
            <button 
              onClick={handleBookRide}
              disabled={!(pwaInstalled && notificationsEnabled && locationEnabled) || completing}
              className="w-full py-4 bg-background text-foreground text-base font-display font-bold rounded-2xl hover:bg-background/90 transition-all disabled:shadow-none disabled:opacity-0 disabled:pointer-events-none border border-background/20"
            >
              {completing ? "Completing Setup..." : "Book Ride"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
