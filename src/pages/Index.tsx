import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Clock, ShieldCheck, Sparkles, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import heroImage from "@/assets/hero-keke.jpg";

const steps = [
  { icon: MapPin, title: "Enter your location", desc: "Tell us where to pick you up — home, hostel or hangout." },
  { icon: Sparkles, title: "Choose your ride", desc: "Shared with classmates or solo. You decide the vibe." },
  { icon: ShieldCheck, title: "Confirm & relax", desc: "We match a verified driver. You get on with your day." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-hairline/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link to="/request">Request a ride</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container relative grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24 lg:py-32">
          <div className="animate-fade-up space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              Built for students. By students.
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Move to campus <span className="text-muted-foreground">without the usual</span> transport stress.
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Easi Ride is a weekly ride subscription for students. Tap, ride, get to class — no haggling, no waiting in the rain.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                <Link to="/request">
                  Request a ride <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/auth">Create account</Link>
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> 5 min average pickup
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Verified drivers
              </div>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="glass-card relative overflow-hidden rounded-3xl shadow-elevated">
              <img
                src={heroImage}
                alt="A keke tricycle waiting on a quiet street at night"
                width={1600}
                height={1200}
                className="aspect-[4/5] w-full object-cover opacity-90 md:aspect-[5/6]"
              />
              {/* <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-hairline bg-background/80 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-muted-foreground">Next ride to</p>
                    <p className="font-medium">Fourah Bay College</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Departs</p>
                    <p className="font-medium">07:00</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-foreground/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
                  </span>
                  <span className="text-xs text-muted-foreground">3 students confirmed</span>
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-hairline/50 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Three taps. One ride. Zero stress.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="glass-card group rounded-2xl p-6 transition-all hover:shadow-elevated">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary border border-hairline">
                    <s.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="font-display text-2xl text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-hairline/50 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Weekly plans</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Pay once a week. Ride every day.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PriceCard
              title="Shared"
              price={100}
              tagline="Roll with classmates."
              perks={["Daily rides to & from campus", "Up to 3 students per keke", "Priority morning slots"]}
            />
            <PriceCard
              title="Solo"
              price={150}
              featured
              tagline="The whole keke. All you."
              perks={["Daily rides to & from campus", "Private trips, no detours", "Pick your favourite driver"]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-hairline/50 py-20">
        <div className="container">
          <div className="glass-card relative overflow-hidden rounded-3xl p-10 md:p-16 text-center">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-5xl text-balance">
              Your morning starts smoother with Easi Ride.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Skip the bargaining. Skip the waiting. Just go.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                <Link to="/request">Request your first ride</Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <a href="https://wa.me/23272804884" target="_blank" rel="noreferrer">
                  <Phone className="h-4 w-4" /> Chat on WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline/50 py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Easi Ride. Built for Sierra Leone students.</p>
        </div>
        <div className="container mt-4 flex justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms-of-service" className="hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
};

const PriceCard = ({
  title,
  price,
  perks,
  tagline,
  featured,
}: {
  title: string;
  price: number;
  perks: string[];
  tagline: string;
  featured?: boolean;
}) => (
  <div
    className={`group relative overflow-hidden rounded-2xl p-8 transition-all ${featured ? "bg-foreground text-background shadow-elevated" : "glass-card"
      }`}
  >
    <div className="flex items-center justify-between">
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      {featured && (
        <span className="rounded-full bg-background/10 px-2.5 py-1 text-[10px] uppercase tracking-wider">
          Most picked
        </span>
      )}
    </div>
    <p className={`mt-1 text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>{tagline}</p>
    <div className="mt-6 flex items-baseline gap-1">
      <span className="font-display text-5xl font-semibold tracking-tight">{price}</span>
      <span className={`text-sm ${featured ? "text-background/70" : "text-muted-foreground"}`}>NLe / week</span>
    </div>
    <ul className="mt-6 space-y-3 text-sm">
      {perks.map((p) => (
        <li key={p} className="flex items-start gap-2.5">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${featured ? "bg-background" : "bg-foreground"
              }`}
          />
          {p}
        </li>
      ))}
    </ul>
    <Button
      asChild
      className="mt-8 w-full"
      variant={featured ? "secondary" : "default"}
      size="lg"
    >
      <Link to={`/checkout/${title.toLowerCase()}`}>Choose {title.toLowerCase()}</Link>
    </Button>
  </div>
);

export default Index;
