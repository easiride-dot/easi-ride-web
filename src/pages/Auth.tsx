import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadStudentId } from "@/lib/studentIdUpload";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Tell us your name").max(80),
});

const SIGNUP_RETRY_DELAY_MS = 60_000;

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const from = location.state?.from?.pathname || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupRetryAt, setSignupRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  useEffect(() => {
    if (!signupRetryAt) return;

    const intervalId = window.setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= signupRetryAt) {
        setSignupRetryAt(null);
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [signupRetryAt]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setStudentIdFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (busy) return;

    if (mode === "signup" && !studentIdFile) {
      toast.error("Please upload your student ID card");
      return;
    }

    if (mode === "signup" && signupRetryAt && signupRetryAt > Date.now()) {
      toast.error(`Too many signup attempts. Please wait ${getRemainingSeconds(signupRetryAt)}s and try again.`);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${from}`,
            data: { full_name: parsed.data.fullName },
          },
        });

        if (authError) {
          if (isRateLimitError(authError)) {
            const retryAt = Date.now() + SIGNUP_RETRY_DELAY_MS;
            setSignupRetryAt(retryAt);
            setNow(Date.now());
            toast.error("Too many signup attempts right now. Please wait about a minute, then try again.");
            return;
          }

          toast.error(
            authError.message.includes("already")
              ? "That email is already registered"
              : authError.message
          );
          return;
        }

        if (authData.user && studentIdFile && authData.session) {
          try {
            const { publicUrl } = await uploadStudentId(authData.user.id, studentIdFile);

            await supabase
              .from("profiles")
              .update({ student_id_url: publicUrl, verification_status: "pending" })
              .eq("id", authData.user.id);
          } catch (uploadError) {
            console.error("Upload error:", uploadError);
            toast.error("Account created, but ID upload failed. Please update in profile.");
          }
        }

        if (!authData.session) {
          toast.success("Account created. Check your email to confirm it, then sign in to finish uploading your ID.");
          setMode("signin");
          setStudentIdFile(null);
          return;
        }

        toast.success("Welcome to Easi Ride. Your ID is pending approval.");
        navigate(from, { replace: true });
        return;
      }

      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        toast.error(error.message.includes("Invalid") ? "Invalid email or password" : error.message);
        return;
      }

      toast.success("Welcome back");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${from}` },
    });

    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <header className="container flex h-16 items-center justify-between">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </header>
      <main className="container flex flex-1 items-center justify-center py-10">
        <div className="glass-card animate-fade-up w-full max-w-md rounded-3xl p-8 shadow-elevated">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to book and manage your campus rides."
              : "Join Easi Ride and book your first campus trip."}
          </p>
          {mode === "signup" && signupRetryAt && signupRetryAt > now && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              Signup is temporarily rate-limited. Try again in {getRemainingSeconds(signupRetryAt, now)}s.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-6 w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aminata Sesay"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Student ID Card</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative cursor-pointer group overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                      studentIdFile
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-hairline hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                      {studentIdFile ? (
                        <>
                          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                          <p className="max-w-full truncate px-4 text-xs font-medium text-emerald-500">
                            {studentIdFile.name}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Click to change</p>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-transform group-hover:scale-110">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-wider">Upload ID Photo</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">JPEG or PNG, Max 5MB</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="........"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={72}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={busy || (mode === "signup" && !!signupRetryAt && signupRetryAt > now)}
            >
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms & Privacy.
          </p>
        </div>
      </main>
    </div>
  );
};

const isRateLimitError = (error: { status?: number; code?: string; message?: string }) =>
  error.status === 429 ||
  error.code === "over_email_send_rate_limit" ||
  error.message?.toLowerCase().includes("too many requests");

const getRemainingSeconds = (retryAt: number, currentTime = Date.now()) =>
  Math.max(1, Math.ceil((retryAt - currentTime) / 1000));

export default Auth;
