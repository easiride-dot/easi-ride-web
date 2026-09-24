import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

type LegalBlock =
  | { type: "p"; text: string }
  | { type: "subhead"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export const LegalBlocks = ({ blocks }: { blocks: LegalBlock[] }) => (
  <div className="space-y-4">
    {blocks.map((block, index) => {
      switch (block.type) {
        case "p":
          return (
            <p key={index} className="text-sm leading-6 text-muted-foreground">
              {block.text}
            </p>
          );
        case "subhead":
          return (
            <h3 key={index} className="font-display text-base font-semibold">
              {block.text}
            </h3>
          );
        case "list":
          return (
            <ul key={index} className="space-y-2 text-sm leading-6 text-muted-foreground">
              {block.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
      }
    })}
  </div>
);

const sections: LegalSection[] = [
  {
    title: "Introduction",
    blocks: [
      {
        type: "p",
        text: 'Easi Ride ("Easi Ride," "we," "us," or "our") provides a student ride-booking and subscription service that connects students with reliable drivers. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our mobile application, or utilize our services (collectively, the "Services"). By accessing or using the Services, you agree to the practices described in this Privacy Policy.',
      },
    ],
  },
  {
    title: "Information We Collect",
    blocks: [
      {
        type: "p",
        text: "We collect information that you provide directly to us, information we collect automatically when you use the Services, and information we receive from third parties.",
      },
      {
        type: "subhead",
        text: "Information you provide directly:",
      },
      {
        type: "list",
        items: [
          "Account information, such as your name, email address, phone number, and student status.",
          "Student verification information, including student ID images or other documentation required for account approval.",
          "Payment information, including payment method details provided to our secure payment processors. We do not store your full payment card numbers or banking details.",
          "Ride booking information, such as pickup and drop-off locations, ride preferences, and scheduling details.",
          "Support and communication information, including messages you send to us, feedback, and responses to surveys or promotions.",
        ],
      },
      {
        type: "subhead",
        text: "Information we collect automatically:",
      },
      {
        type: "list",
        items: [
          "Location information, including your approximate or precise location when you are using the Services. We use this information to match you with nearby drivers and provide accurate ride estimates.",
          "Device and usage information, such as device type, operating system, app version, IP address, browser type, pages or screens viewed, and interactions with the Services.",
          "Log data related to your rides, requests, and account activity.",
        ],
      },
      {
        type: "subhead",
        text: "Information we receive from third parties:",
      },
      {
        type: "list",
        items: [
          "Account and verification details from identity or verification providers, such as Google, when you sign in with your Google account.",
          "Payment status and transaction details from our payment processors to confirm your payments, refunds, and subscription status.",
          "Map and routing data from third-party mapping providers to help plan routes and estimate fares.",
        ],
      },
    ],
  },
  {
    title: "How We Use Your Information",
    blocks: [
      {
        type: "p",
        text: "We use the information we collect for the following purposes:",
      },
      {
        type: "list",
        items: [
          "To create and manage your Easi Ride account.",
          "To process and fulfill your ride requests.",
          "To match you with available drivers and improve the reliability and safety of your rides.",
          "To verify your student status and eligibility for the Services.",
          "To process payments, refunds, credits, and subscription plans.",
          "To send you service messages, updates about your rides, and important account notifications.",
          "To provide customer support and respond to your inquiries.",
          "To analyze usage patterns, diagnose technical issues, and improve the quality and functionality of our Services.",
          "To detect, prevent, and address fraud, security, technical, or safety issues.",
          "To comply with legal obligations and enforce our terms and policies.",
        ],
      },
    ],
  },
  {
    title: "Sharing of Information",
    blocks: [
      {
        type: "p",
        text: "We do not sell your personal information. We share information only in the ways described in this Privacy Policy:",
      },
      {
        type: "list",
        items: [
          "With drivers: We share ride details (such as pickup and drop-off locations and ride schedule) with assigned drivers so they can complete your ride.",
          "With service providers: We share limited information with trusted providers who help us operate the Services, including hosting, authentication, analytics, payments, notifications, and customer support. These providers are contractually obligated to protect your information.",
          "With legal authorities: We may disclose information when required by law, regulation, legal process, or governmental request, or when necessary to protect the rights, safety, or property of Easi Ride, our users, or others.",
          "With business partners: In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction.",
        ],
      },
    ],
  },
  {
    title: "Data Storage and Security",
    blocks: [
      {
        type: "p",
        text: "We store information on secure servers and use industry-standard safeguards, including access controls, encryption in transit, and authentication, to protect your information. However, no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee its absolute security. You should take reasonable steps to protect your account, including using a strong password and keeping your login credentials private.",
      },
    ],
  },
  {
    title: "Data Retention",
    blocks: [
      {
        type: "p",
        text: "We retain your information only for as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce our agreements. The retention period may vary depending on the type of information and the purpose for which it was collected. When we no longer need your information, we will delete or anonymize it in accordance with applicable laws.",
      },
    ],
  },
  {
    title: "Your Rights and Choices",
    blocks: [
      {
        type: "p",
        text: "You have the following rights and choices regarding your information:",
      },
      {
        type: "list",
        items: [
          "Access and correction: You may access, update, or correct your account information from your profile where available.",
          "Deletion: You may request deletion of your personal information and account by contacting us (see the Contact Information section below).",
          "Communication preferences: You may opt out of promotional communications at any time by following the instructions in those communications.",
          "Cookies and tracking: You may adjust your browser or device settings to manage cookies and similar technologies.",
          "Account access: You may stop using Google sign-in by removing Easi Ride access from your Google Account settings.",
        ],
      },
    ],
  },
  {
    title: "Children's Privacy",
    blocks: [
      {
        type: "p",
        text: "Our Services are intended for students and individuals who are at least 13 years old. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us immediately, and we will take steps to remove such information.",
      },
    ],
  },
  {
    title: "Third-Party Services",
    blocks: [
      {
        type: "p",
        text: "Our Services may contain links to third-party websites or services, such as payment providers or mapping services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you use.",
      },
    ],
  },
  {
    title: "Cookies and Tracking Technologies",
    blocks: [
      {
        type: "p",
        text: "We may use cookies and similar technologies to improve your experience, analyze usage, and remember your preferences. You can control the use of cookies through your browser settings. Disabling cookies may affect the functionality of certain features of the Services.",
      },
    ],
  },
  {
    title: "International Data Transfers",
    blocks: [
      {
        type: "p",
        text: "We may transfer and process your information in countries other than your own. Where required, we take appropriate measures to ensure that your information receives an adequate level of protection in accordance with applicable data protection laws.",
      },
    ],
  },
  {
    title: "Changes to This Privacy Policy",
    blocks: [
      {
        type: "p",
        text: "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the updated policy within the Services. Your continued use of the Services after the changes take effect constitutes your acceptance of the revised Privacy Policy.",
      },
    ],
  },
  {
    title: "Contact Information",
    blocks: [
      {
        type: "p",
        text: "If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us at:",
      },
      {
        type: "p",
        text: "Easi Ride\nEmail: contact@easiride.app\nWhatsApp: +232 72 804 884",
      },
    ],
  },
];

const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" updated="May 16, 2026" intro="This Privacy Policy explains how Easi Ride collects, uses, discloses, and safeguards your information when you visit our website, use our mobile application, or utilize our services.">
    {sections.map((section) => (
      <section key={section.title} className="space-y-3">
        <h2 className="font-display text-xl font-semibold">{section.title}</h2>
        <LegalBlocks blocks={section.blocks} />
      </section>
    ))}
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