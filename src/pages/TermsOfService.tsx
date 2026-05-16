import { LegalPage } from "./PrivacyPolicy";

const sections = [
  {
    title: "Using Easi Ride",
    body: [
      "You must provide accurate account, student, pickup, and contact information.",
      "You are responsible for keeping your account secure and for activity that happens through your account.",
      "You must use the service lawfully and respectfully toward drivers, students, support staff, and other riders.",
    ],
  },
  {
    title: "Student verification",
    body: [
      "Easi Ride may require a valid student ID or other verification before approving an account or ride plan.",
      "We may reject, suspend, or remove accounts that provide false, expired, altered, or misleading verification details.",
    ],
  },
  {
    title: "Bookings, subscriptions, and payments",
    body: [
      "Ride availability, pickup times, routes, and prices may vary based on demand, location, driver availability, and operating conditions.",
      "Subscription plans cover the rides and period shown at checkout or agreed with Easi Ride support.",
      "Payments, refunds, credits, or cancellations may be handled according to the plan terms shown to you and any support agreement made with Easi Ride.",
    ],
  },
  {
    title: "Safety",
    body: [
      "Students and drivers should follow reasonable safety instructions and local transport rules.",
      "You should not request unsafe pickups, carry prohibited items, harass others, or interfere with a driver operating a vehicle.",
      "Easi Ride may cancel rides or restrict accounts where safety, fraud, misuse, or service abuse is suspected.",
    ],
  },
  {
    title: "Service changes",
    body: [
      "We may update, pause, or discontinue parts of the service as the product grows.",
      "We may update these Terms from time to time. Continued use of Easi Ride after updates means you accept the updated Terms.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For questions about these Terms, bookings, subscriptions, or support, contact Easi Ride by WhatsApp at +232 72 804 884.",
    ],
  },
];

const TermsOfService = () => (
  <LegalPage title="Terms of Service" updated="May 16, 2026" intro="These Terms of Service explain the basic rules for using Easi Ride's student ride booking and subscription service.">
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
  </LegalPage>
);

export default TermsOfService;
