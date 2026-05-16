import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShieldAlert } from "lucide-react";

const Checkout = () => {
  const { plan } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [busy, setBusy] = useState(false);

  const isShared = plan === "shared";
  const price = isShared ? 100 : 150;
  const title = isShared ? "Shared Plan" : "Solo Plan";
  const isVerified = profile?.verification_status === "approved";

  const handlePay = async () => {
    if (!user) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }

    if (!isVerified) {
      toast.error("Your student ID must be approved before you can subscribe.");
      navigate("/dashboard");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/monime-create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: isShared ? "shared" : "solo" }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.redirectUrl) {
        toast.error(result?.error || "Unable to start payment");
        setBusy(false);
        return;
      }

      window.location.href = result.redirectUrl;
    } catch (error) {
      toast.error("Unable to start payment");
      console.error(error);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </div>
      </header>

      <main className="container max-w-md py-12 animate-fade-up">
        <div className="glass-card rounded-3xl p-8 shadow-elevated">
          {profileLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : !isVerified ? (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Approval required</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Your student ID must be approved before you can subscribe to the {title.toLowerCase()}.
              </p>
              <Button className="mt-8 w-full" variant="outline" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-center mb-6">Complete your subscription</h1>
              
              <div className="bg-secondary/30 rounded-2xl p-5 mb-8 border border-hairline">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Plan</span>
                  <span className="font-semibold">{title} (Weekly)</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Rides Included</span>
                  <span className="font-semibold">14 rides</span>
                </div>
                <div className="border-t border-hairline/60 my-4"></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total Due</span>
                  <span className="font-display text-2xl font-semibold">{price} NLe</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground text-center mb-4">Payment</p>
                <Button 
                  variant="outline" 
                  className="w-full h-14 justify-start px-6"
                  disabled={busy}
                  onClick={handlePay}
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-left font-medium">
                    {busy ? "Opening secure checkout..." : "Pay with Monime"}
                  </span>
                </Button>
              </div>
              
              <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mobile money, bank transfer, and cards via Monime
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Checkout;
