import { Link } from "react-router-dom";
import {
  ArrowDown,
  CarFront,
  Users,
  Flag,
  ShieldCheck,
  Tag,
  CalendarClock,
  Phone,
  Mail,
  ChevronRight,
  Route as RouteIcon,
  Wallet,
  Navigation,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const WHATSAPP_URL = "https://wa.me/23272804884";
const CONTACT_EMAIL = "contact@easiride.app";

const steps = [
  {
    icon: RouteIcon,
    title: "Request",
    desc: "Enter your pickup and destination.",
  },
  {
    icon: Users,
    title: "Get Matched",
    desc: "Easi Ride connects you with an available verified driver and vehicle.",
  },
  {
    icon: Flag,
    title: "Ride",
    desc: "Your driver arrives, you ride, and the trip is completed.",
  },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: "Verified Drivers",
    desc: "Drivers are screened and verified before operating through Easi Ride.",
  },
  {
    icon: CarFront,
    title: "Verified Vehicles",
    desc: "Vehicles are checked and approved before joining the Easi Ride network.",
  },
  {
    icon: Tag,
    title: "Simple Pricing",
    desc: "Base fare of NLe10 + NLe7 per kilometre.",
  },
  {
    icon: CalendarClock,
    title: "Flexible Access",
    desc: "Request a ride when you need one instead of depending on a dedicated vehicle or driver.",
  },
];

const ownerFlow = [
  { icon: CarFront, label: "Your Vehicle" },
  { icon: Users, label: "Easi Ride" },
  { icon: BadgeCheck, label: "Verified Driver" },
  { icon: Wallet, label: "Customers" },
  { icon: ArrowDown, label: "Ride Revenue" },
];

const driverFlow = [
  { icon: Users, label: "Driver" },
  { icon: CarFront, label: "Verified Vehicle" },
  { icon: Navigation, label: "Ride Requests" },
  { icon: Wallet, label: "Earn 20%" },
];

const plans = [
  {
    range: "1–5 km",
    price: "NLe150",
    period: "/week",
  },
  {
    range: "5–10 km",
    price: "NLe220",
    period: "/week",
  },
  {
    range: "10–15 km",
    price: "NLe300",
    period: "/week",
  },
];

const pricingExamples = [
  { distance: "2 km", price: "NLe24" },
  { distance: "5 km", price: "NLe45" },
  { distance: "10 km", price: "NLe80" },
  { distance: "15 km", price: "NLe115" },
];

const ComingSoon = () => (
  <span className="ml-1.5 rounded-full bg-[#FAFAFA]/10 border border-[#2A2A2A] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#9A9A9A]">
    Coming soon
  </span>
);

const SectionEyebrow = ({ children }: { children: string }) => (
  <p className="text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">{children}</p>
);

const Index = () => {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#2A2A2A]/60 bg-[#0B0B0B]/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 text-sm text-[#9A9A9A] md:flex">
              <a href="#riders" className="transition-colors hover:text-[#FAFAFA]">
                For Riders
              </a>
              <a href="#owners" className="transition-colors hover:text-[#FAFAFA]">
                For Vehicle Owners
              </a>
              <a href="#drivers" className="transition-colors hover:text-[#FAFAFA]">
                Become a Driver
              </a>
            </nav>
            <Button asChild size="sm">
              <a href="#riders">Request a Ride</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="riders" className="relative scroll-mt-20 overflow-hidden bg-[#0B0B0B]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#1A1A1A]/80 blur-sm"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-28 h-80 w-80 rounded-full bg-[#1E1E1E]/50 blur-sm"
        />

        <div className="container relative py-20 md:py-28">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2E2E2E] bg-[#1A1A1A] px-3 py-1 text-xs text-[#9A9A9A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA]" />
              Transportation, on demand
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Your ride. Made Easi.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#9A9A9A] md:text-lg">
              Book a ride with a verified driver in a verified vehicle, whenever you need to go.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="lg">
                <a href="#cta">Request a Ride</a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#owners">
                  Become a Vehicle Owner <span className="text-[#7A7A7A]">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </a>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-[#7A7A7A]">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Convenient rides
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Verified drivers
              </div>
              <div className="flex items-center gap-2">
                <CarFront className="h-4 w-4" /> Verified vehicles
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" /> Simple pricing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Easi Ride Works */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Request, get matched, ride.
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

      {/* Why Easi Ride */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <SectionEyebrow>Why Easi Ride</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Built on verification and simple pricing.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6 transition-all hover:border-[#383838]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] border border-[#2A2A2A]">
                  <b.icon className="h-5 w-5 text-[#FAFAFA]" strokeWidth={2} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9A9A9A]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Vehicle Owners */}
      <section id="owners" className="scroll-mt-20 border-t border-[#2A2A2A]/60 py-20">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionEyebrow>For Vehicle Owners</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Turn your vehicle into an income-generating asset.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[#9A9A9A]">
              Put an eligible vehicle onto the Easi Ride network. We handle customer demand, ride
              coordination, drivers, technology and fuel — while your vehicle earns on every ride.
            </p>
            <div className="mt-8 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6">
              <p className="font-display text-xl font-semibold">
                Vehicle owners receive <span className="text-[#FAFAFA]">40%</span> of the revenue
                generated by their vehicle.
              </p>
            </div>
            <div className="mt-8">
              <Button asChild className="bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="lg">
                <a href="#cta">
                  Register Your Vehicle <ComingSoon />
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2A2A2A] bg-[#111111] p-8">
            <div className="flex flex-col items-stretch gap-3">
              {ownerFlow.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                    <f.icon className="h-5 w-5 text-[#FAFAFA]" strokeWidth={2} />
                    <span className="text-sm font-medium">{f.label}</span>
                    {i === 0 && <span className="ml-auto text-[10px] uppercase tracking-wider text-[#7A7A7A]">You provide</span>}
                  </div>
                  {i < ownerFlow.length - 1 && (
                    <ArrowDown className="mx-auto my-1.5 h-4 w-4 text-[#7A7A7A]" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-[#7A7A7A]">
              Not car rental — you supply the vehicle to the Easi Ride network.
            </p>
          </div>
        </div>
      </section>

      {/* For Drivers */}
      <section id="drivers" className="scroll-mt-20 border-t border-[#2A2A2A]/60 py-20">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="flex flex-col items-stretch gap-3">
              <div className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                  <Users className="h-4 w-4 text-[#FAFAFA]" />
                </span>
                <span className="text-sm font-medium">Driver</span>
              </div>
              <ArrowDown className="mx-auto h-4 w-4 text-[#7A7A7A]" />
              <div className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                  <CarFront className="h-4 w-4 text-[#FAFAFA]" />
                </span>
                <span className="text-sm font-medium">Verified Vehicle</span>
              </div>
              <ArrowDown className="mx-auto h-4 w-4 text-[#7A7A7A]" />
              <div className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                  <Navigation className="h-4 w-4 text-[#FAFAFA]" />
                </span>
                <span className="text-sm font-medium">Ride Requests</span>
              </div>
              <ArrowDown className="mx-auto h-4 w-4 text-[#7A7A7A]" />
              <div className="flex items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] border border-[#2A2A2A]">
                  <Wallet className="h-4 w-4 text-[#FAFAFA]" />
                </span>
                <span className="text-sm font-medium">Earn 20%</span>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <SectionEyebrow>For Drivers</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Drive with Easi Ride.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[#9A9A9A]">
              Operate an approved Easi Ride vehicle and earn from completed rides.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Verified vehicles before you hit the road",
                "Identity, licence and background verification through Easi Ride",
                "Ride requests come through the platform",
                "Easi Ride handles fuel in the MVP",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FAFAFA]" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild variant="outline" size="lg">
                <a href="#cta">
                  Become a Driver <ComingSoon />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Student Weekly Plans */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <SectionEyebrow>Students</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Your week, covered.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#9A9A9A]">
              Choose the plan that matches your usual distance between home and college. Request a
              ride whenever you need one. You are matched with an available Easi Ride driver — no
              dedicated driver required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.range}
                className="flex flex-col rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-8 transition-all hover:border-[#383838]"
              >
                <span className="rounded-full border border-[#2A2A2A] bg-[#FAFAFA]/10 px-2.5 py-1 self-start text-[10px] uppercase tracking-wider text-[#9A9A9A]">
                  {p.range}
                </span>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-[#7A7A7A]">{p.period}</span>
                </div>
                <p className="mt-3 text-sm text-[#7A7A7A]">Up to 12 rides</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild variant="outline" size="lg">
              <a href="#cta">
                View Student Plans <ComingSoon />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Simple pricing.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6">
                <span className="font-display text-4xl font-semibold tracking-tight">NLe10</span>
                <span className="text-sm text-[#7A7A7A]">Base fare</span>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6">
                <span className="font-display text-4xl font-semibold tracking-tight">NLe7</span>
                <span className="text-sm text-[#7A7A7A]">Per kilometre</span>
              </div>
              <p className="rounded-2xl border border-[#2A2A2A] bg-[#111111] p-6 text-sm leading-relaxed text-[#9A9A9A]">
                Ride price = NLe10 + (NLe7 × distance)
              </p>
            </div>

            <div className="rounded-2xl border border-[#2A2A2A] bg-[#111111] p-6">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">
                <span>Example rides</span>
                <span>Distance → Price</span>
              </div>
              <div className="divide-y divide-[#2A2A2A]/60">
                {pricingExamples.map((e) => (
                  <div key={e.distance} className="flex items-center justify-between py-3">
                    <span className="text-sm text-[#9A9A9A]">{e.distance}</span>
                    <span className="font-display text-lg font-semibold">{e.price}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#7A7A7A]">
                Examples based on the current pricing formula.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="scroll-mt-20 border-t border-[#2A2A2A]/60 py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#111111] p-10 text-center md:p-16">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-5xl text-balance">
              Ready to ride Easi?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[#9A9A9A]">
              Request your next ride through Easi Ride.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-[#FAFAFA] text-[#0B0B0B] hover:bg-[#FAFAFA]/90" size="xl">
                <a href="#riders">Request a Ride</a>
              </Button>
              <Button asChild variant="outline" size="xl">
                <a href="#owners">Become a Vehicle Owner</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#2A2A2A]/60 py-12">
        <div className="container">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-[#7A7A7A]">
                Easi Ride connects customers to verified drivers and vehicles — and gives vehicle
                owners a way to put their cars to work.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">Company</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#riders" className="hover:text-[#FAFAFA]">Riders</a>
                  </li>
                  <li>
                    <a href="#owners" className="hover:text-[#FAFAFA]">Vehicle Owners</a>
                  </li>
                  <li>
                    <a href="#drivers" className="hover:text-[#FAFAFA]">Drivers</a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">Legal</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/privacy-policy" className="hover:text-[#FAFAFA]">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link to="/terms-of-service" className="hover:text-[#FAFAFA]">Terms of Service</Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#7A7A7A]">Contact</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-[#FAFAFA]">
                      <Mail className="h-4 w-4" /> Email
                    </a>
                  </li>
                  <li>
                    <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#FAFAFA]">
                      <Phone className="h-4 w-4" /> WhatsApp
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-10 border-t border-[#2A2A2A]/60 pt-6 text-center text-sm text-[#7A7A7A]">
            © {new Date().getFullYear()} Easi Ride. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;