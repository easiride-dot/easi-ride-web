import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

const sections = [
  {
    title: "Information we collect",
    body: [
      "Account details such as your name, email address, and student status.",
      "Ride details such as pickup and drop-off locations, ride requests, subscription plan, and trip history.",
      "Verification details such as the student ID image you upload during signup.",
      "Payment and support information needed to manage subscriptions, receipts, refunds, and customer service.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To create and secure your account.",
      "To match students with available drivers and manage ride requests.",
      "To verify student eligibility and protect the Easi Ride community.",
      "To send service messages, account updates, and support replies.",
      "To improve reliability, safety, and the overall student ride experience.",
    ],
  },
  {
    title: "How we share information",
    body: [
      "We share only the information needed to operate the service, such as ride details with assigned drivers.",
      "We may use trusted service providers for authentication, hosting, storage, analytics, payments, and support.",
      "We do not sell student personal information.",
      "We may disclose information when required by law or to protect users, drivers, Easi Ride, or the public.",
    ],
  },
  {
    title: "Security and retention",
    body: [
      "We use access controls, authentication, and secure service providers to help protect account and ride data.",
      "We keep information only as long as needed for service operation, legal, safety, accounting, or dispute purposes.",
      "No online service is perfectly secure, so users should keep their login details private and report suspicious activity.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You may update account information from your profile where available.",
      "You may contact us to request help with account access, data correction, or account deletion.",
      "You can stop using Google sign-in by removing Easi Ride access from your Google Account settings.",
    ],
  },
];

const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" updated="May 16, 2026" intro="This Privacy Policy explains how Easi Ride collects, uses, shares, and protects information when students use our ride booking and subscription service.">
    {sections.map((section) => (
      <section key={section.title} className="space-y-3">
        <h2 className="font-display text-xl font-semibold">{section.title}</h2>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {section.body.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    ))}

    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Contact us</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        For privacy questions or requests, contact Easi Ride support by WhatsApp at{" "}
        <a className="text-foreground underline-offset-4 hover:underline" href="https://wa.me/23272804884" target="_blank" rel="noreferrer">
          +232 72 804 884
        </a>
        .
      </p>
    </section>
  </LegalPage>
);

export const LegalPage = ({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-hairline/50">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>
    </header>

    <main className="container max-w-3xl py-12 md:py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Easi Ride</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
      <p className="mt-6 text-base leading-7 text-muted-foreground">{intro}</p>
      <div className="mt-10 space-y-9">{children}</div>
    </main>
  </div>
);

export default PrivacyPolicy;
