import { LegalPage, LegalBlocks } from "./PrivacyPolicy";
import type { LegalSection } from "./PrivacyPolicy";

const sections: LegalSection[] = [
  {
    title: "Introduction",
    blocks: [
      {
        type: "p",
        text: 'These Terms of Service ("Terms") govern your access to and use of the Easi Ride student ride-booking and subscription service, including our website and mobile application (collectively, the "Services"). By creating an account, booking a ride, or using the Services in any way, you agree to be bound by these Terms.',
      },
    ],
  },
  {
    title: "Eligibility",
    blocks: [
      {
        type: "p",
        text: "You must be at least 13 years old and a currently enrolled student or an individual approved by Easi Ride to use the Services. By using the Services, you represent and warrant that you meet these eligibility requirements.",
      },
    ],
  },
  {
    title: "Your Easi Ride Account",
    blocks: [
      {
        type: "list",
        items: [
          "You must provide accurate and complete information when creating your account.",
          "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.",
          "You must notify us immediately if you suspect any unauthorized use of your account.",
          "We may refuse, suspend, or cancel your account at any time if we believe you have violated these Terms or for any lawful reason.",
        ],
      },
    ],
  },
  {
    title: "Booking a Ride",
    blocks: [
      {
        type: "list",
        items: [
          "You may request a ride through the Services, subject to driver availability and operating conditions.",
          "Your requested pickup and drop-off locations must be accurate and safe.",
          "You acknowledge that estimated pickup times and fares are estimates and may vary based on demand, location, traffic, weather, and other operating conditions.",
          "You agree to be ready and present at the pickup location at the scheduled time, and to have your account verified and your subscription or payment method available.",
        ],
      },
    ],
  },
  {
    title: "Ride Etiquette and Responsibilities",
    blocks: [
      {
        type: "list",
        items: [
          "Treat drivers and other riders with respect and courtesy.",
          "Follow reasonable instructions from your driver, including those related to safety and pickups.",
          "Do not damage the vehicle, leave litter, or interfere with the driver operating the vehicle.",
          "Do not bring prohibited items or anything that could compromise the safety of the ride.",
        ],
      },
    ],
  },
  {
    title: "Subscriptions and Payments",
    blocks: [
      {
        type: "list",
        items: [
          "Subscription plans cover the rides and period shown at checkout or agreed with Easi Ride support.",
          "You agree to pay all charges associated with your account, including subscription fees, ride charges, and applicable taxes.",
          "Payments are processed through secure third-party providers, and we may update pricing or plan details as shown in the Services.",
          "You are responsible for keeping your payment details accurate and current.",
        ],
      },
    ],
  },
  {
    title: "Refunds, Cancellations, and Credits",
    blocks: [
      {
        type: "list",
        items: [
          "Cancellations may be subject to the terms of your plan or applicable law.",
          "Refunds, credits, or adjustments are handled according to the plan terms shown to you and any support agreement made with Easi Ride.",
          "Unused subscription rides or credits may be forfeited or expire according to your plan terms.",
        ],
      },
    ],
  },
  {
    title: "Driver Services and Independent Contractors",
    blocks: [
      {
        type: "p",
        text: "Easi Ride connects students with independent drivers. Participating drivers are independent contractors and not employees or agents of Easi Ride. Easi Ride is not responsible for the acts or omissions of drivers, except as required by law.",
      },
    ],
  },
  {
    title: "Safety and Conduct",
    blocks: [
      {
        type: "list",
        items: [
          "Always wear your seatbelt where available and follow applicable road and safety rules.",
          "Do not distract the driver, and report any safety concerns to Easi Ride support.",
          "Easi Ride may cancel rides or restrict accounts where safety, fraud, misuse, or service abuse is suspected.",
        ],
      },
    ],
  },
  {
    title: "Prohibited Activities",
    blocks: [
      {
        type: "p",
        text: "You agree not to use the Services to:",
      },
      {
        type: "list",
        items: [
          "Violate any law, regulation, or these Terms.",
          "Misrepresent your identity, student status, or eligibility.",
          "Harass, threaten, or discriminate against drivers, other riders, or Easi Ride staff.",
          "Carry prohibited, dangerous, or illegal items.",
          "Attempt to harm, interfere with, or gain unauthorized access to the Services or related systems.",
        ],
      },
    ],
  },
  {
    title: "Intellectual Property",
    blocks: [
      {
        type: "p",
        text: "The Easi Ride name, logo, and all content, software, and materials in the Services are owned by Easi Ride or its licensors and are protected by intellectual property laws. You may not use them without prior written permission.",
      },
    ],
  },
  {
    title: "Privacy",
    blocks: [
      {
        type: "p",
        text: "Your use of the Services is governed by our Privacy Policy, which explains how we collect, use, share, and protect your information. By using the Services, you agree to the practices described in the Privacy Policy.",
      },
    ],
  },
  {
    title: "Changes to the Service",
    blocks: [
      {
        type: "p",
        text: "We may update, suspend, or discontinue parts of the Services, in whole or in part, as the product grows. We may add, change, or remove features with or without notice.",
      },
    ],
  },
  {
    title: "Changes to These Terms",
    blocks: [
      {
        type: "p",
        text: "We may update these Terms from time to time. Continued use of Easi Ride after an update means you accept the updated Terms.",
      },
    ],
  },
  {
    title: "Limitation of Liability",
    blocks: [
      {
        type: "p",
        text: "To the fullest extent permitted by law, Easi Ride, its officers, employees, and agents are not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill, arising out of or in connection with your use of the Services, except as required by law.",
      },
    ],
  },
  {
    title: "Dispute Resolution",
    blocks: [
      {
        type: "p",
        text: "Any dispute arising from these Terms or the Services will be resolved through good-faith negotiation with Easi Ride support before any formal action, and otherwise in accordance with applicable law.",
      },
    ],
  },
  {
    title: "Termination",
    blocks: [
      {
        type: "p",
        text: "We may suspend or terminate your access to the Services if you breach these Terms or for any other lawful reason, with or without notice. You may stop using the Services at any time. Provisions that by their nature should survive termination will continue to apply.",
      },
    ],
  },
  {
    title: "Entire Agreement",
    blocks: [
      {
        type: "p",
        text: "These Terms, together with our Privacy Policy and any other policies we publish, constitute the entire agreement between you and Easi Ride regarding your use of the Services.",
      },
    ],
  },
  {
    title: "Severability",
    blocks: [
      {
        type: "p",
        text: "If any part of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.",
      },
    ],
  },
  {
    title: "Contact",
    blocks: [
      {
        type: "p",
        text: "For questions about these Terms, bookings, subscriptions, or support, contact Easi Ride by WhatsApp at +232 72 804 884.",
      },
    ],
  },
];

const TermsOfService = () => (
  <LegalPage title="Terms of Service" updated="May 16, 2026" intro="These Terms of Service explain the rules for using Easi Ride's student ride booking and subscription service.">
    {sections.map((section) => (
      <section key={section.title} className="space-y-3">
        <h2 className="font-display text-xl font-semibold">{section.title}</h2>
        <LegalBlocks blocks={section.blocks} />
      </section>
    ))}
  </LegalPage>
);

export default TermsOfService;