import { Link } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Clock,
  ShieldCheck,
  Sparkles,
  Phone,
  Wallet,
  CreditCard,
  ChevronRight,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const steps = [
  { icon: MapPin, title: "Enter your location", desc: "Tell us where to pick you up — home, hostel or hangout." },
  { icon: Sparkles, title: "Choose your ride", desc: "Shared with classmates or solo. You decide the vibe." },
  { icon: ShieldCheck, title: "Confirm & relax", desc: "We match a verified driver. You get on with your day." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#2A2A2A]/60 bg-[#0B0B0B]/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden text-sm text-[#9A9A9A] hover:text-[#FAFAFA] sm:block">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link to="/request">Request a ride</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — mirrors the passenger app front page */}
      <section className="relative overflow-hidden bg-[#0B0B0B]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#1A1A1A]/80 blur-sm"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-28 h-80 w-80 rounded-full bg-[#1E1E1E]/50 blur-sm"
        />

        <div className="container relative grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-20">
          <div className="animate-fade-up space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2E2E2E] bg-[#1A1A1A] px-3 py-1 text-xs text-[#9A9A9A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA]" />
              Wherever you're going, go Easi.
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Where to?
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-[#9A9A9A] md:text-lg">
              Easi Ride is a weekly ride subscription for students. Tap, ride, get to class — no haggling, no waiting in the rain.
            </p>

            {/* Destination pill */}
            <Link
              to="/request"
              className="group flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 transition-colors hover:border-[#383838]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A]">
                <MapPin className="h-5 w-5 text-[#9A9A9A]" />
              </span>
              <span className="flex-1 text-base text-[#9A9A9A]">Enter your destination</span>
              <ArrowRight className="h-5 w-5 text-[#9A9A9A] transition-transform group-hover:translate-x-0.5" />
            </Link>

            <div className="flex items-center gap-6 pt-2 text-xs text-[#7A7A7A]">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> 5 min average pickup
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Verified drivers
              </div>
            </div>
          </div>

          {/* Wallet / Credits cards — mirror the app home */}
          <div className="animate-fade-up space-y-4 [animation-delay:120ms]">
            <Link
              to="/checkout/weekly"
              className="group flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 transition-colors hover:border-[#383838]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                <CreditCard className="h-5 w-5 text-[#FAFAFA]" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#FAFAFA]">Weekly ride plan</span>
                <span className="mt-0.5 block text-xs text-[#7A7A7A]">Pay once, ride all week</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#7A7A7A]" />
            </Link>

            <Link
              to="/trip/book"
              className="group flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 transition-colors hover:border-[#383838]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                <Wallet className="h-5 w-5 text-[#FAFAFA]" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#FAFAFA]">Pay per trip</span>
                <span className="mt-0.5 block text-xs text-[#7A7A7A]">One trip, one payment</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#7A7A7A]" />
            </Link>

            <Link
              to="/request"
              className="group flex items-center gap-4 rounded-2xl border border-[#22C55E]/60 bg-[#22C55E]/10 p-5 transition-colors hover:border-[#22C55E]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22C55E]/25">
                <Navigation className="h-5 w-5 text-[#22C55E]" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#FAFAFA]">Book a ride now</span>
                <span className="mt-0.5 block text-xs text-[#9A9A9A]">Verified driver, up to 5 min</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#9A9A9A]" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Three taps. One ride. Zero stress.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6 transition-all hover:border-[#383838]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] border border-[#2A2A2A]">
                    <s.icon className="h-5 w-5 text-[#FAFAFA]" strokeWidth={2} />
                  </div>
                  <span className="font-display text-2xl text-[#7A7A7A]">0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9A9A9A]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">How to ride</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Two ways to ride with Easi Ride.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly Plan */}
            <div className="flex flex-col rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-8">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold">Weekly Plan</h3>
                <span className="rounded-full bg-[#FAFAFA]/10 border border-[#2A2A2A] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#9A9A9A]">
                  7 days
                </span>
              </div>
              <p className="mb-6 text-sm text-[#9A9A9A]">Priced to your route. Pay once, ride all week.</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tracking-tight">Route-based</span>
              </div>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                {["14 rides included (2 per day)", "Price calculated from your route", "Verified driver for every trip", "Fixed weekly rate — no surprises"].map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FAFAFA]" />
                    {p}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="lg">
                <Link to="/checkout/weekly">See my weekly price</Link>
              </Button>
            </div>

            {/* Pay Per Trip */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl bg-[#1A1A1A] p-8 text-[#FAFAFA] shadow-elevated border border-[#2A2A2A]">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold">Pay Per Trip</h3>
                <span className="rounded-full bg-[#FAFAFA]/10 px-2.5 py-1 text-[10px] uppercase tracking-wider">
                  No subscription
                </span>
              </div>
              <p className="mb-6 text-sm text-[#9A9A9A]">One trip, one payment. Perfect for occasional rides.</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tracking-tight">Route-based</span>
              </div>
              <p className="mb-6 text-xs text-[#7A7A7A]">Minimum 25 NLe · Calculated by distance</p>
              <ul className="mb-8 flex-1 space-y-3 text-sm">
                {["Book any single trip", "Price shown before you pay", "No commitment, no recurring fee", "Same verified drivers"].map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FAFAFA]" />
                    {p}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="lg">
                <Link to="/trip/book">Book a trip</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#111111] p-10 text-center md:p-16">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-5xl text-balance">
              Your morning starts smoother with Easi Ride.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[#9A9A9A]">
              Skip the bargaining. Skip the waiting. Just go.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="xl">
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

      <footer className="border-t border-[#2A2A2A]/60 py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-[#7A7A7A] sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Easi Ride. Built for Sierra Leone students.</p>
        </div>
        <div className="container mt-4 flex justify-center gap-4 text-sm text-[#7A7A7A]">
          <Link to="/privacy-policy" className="hover:text-[#FAFAFA]">
            Privacy Policy
          </Link>
          <Link to="/terms-of-service" className="hover:text-[#FAFAFA]">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;