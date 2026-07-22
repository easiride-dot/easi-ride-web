import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type VerifyState = "checking" | "completed" | "pending" | "failed";

const CheckoutComplete = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [state, setState] = useState<VerifyState>("checking");
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    if (loading) return;

    const orderId = searchParams.get("orderId");
    if (!user || !orderId) {
      setState("failed");
      setMessage(!user ? "Please sign in to confirm your payment." : "Missing payment reference.");
      return;
    }

    const verifyPayment = async () => {
      try {
        setState("checking");
        setMessage("Confirming your payment...");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch("/api/monime-verify-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ orderId }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          setState("failed");
          setMessage(result?.error || "We could not verify your payment.");
          return;
        }

        if (result?.status === "completed") {
          setState("completed");
          if (result.rideId) {
            setMessage("Payment confirmed! Taking you to your ride.");
            setTimeout(() => navigate(`/matching/${result.rideId}`), 1500);
            return;
          }
          setMessage("Payment confirmed. Your weekly subscription is active.");
          return;
        }

        setState("pending");
        setMessage("Your payment is not complete yet. If you already paid, wait a moment and refresh this page.");
      } catch {
        setState("failed");
        setMessage("Something went wrong. Please try again.");
      }
    };

    verifyPayment();
  }, [loading, navigate, searchParams, user]);

  const icon =
    state === "checking" ? (
      <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
    ) : state === "completed" ? (
      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
    ) : (
      <AlertCircle className="h-9 w-9 text-amber-500" />
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-hairline/60 bg-background/80">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <main className="container flex min-h-[calc(100vh-3.5rem)] max-w-md items-center justify-center py-12">
        <div className="glass-card w-full rounded-3xl p-8 text-center shadow-elevated">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/60">
            {icon}
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {state === "completed" ? "Subscription active" : state === "checking" ? "Checking payment" : "Payment status"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>

          <div className="mt-8 flex flex-col gap-3">
            {state === "completed" ? (
              <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
            ) : (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh status
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutComplete;
