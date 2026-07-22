import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Phone, Mail, FileQuestion } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const HelpSupport = () => {
  const faqs = [
    {
      question: "How do I request a ride?",
      answer: "Go to the Home tab and tap 'Request Ride'. Enter your pickup and drop-off locations, select your ride type, and confirm.",
    },
    {
      question: "What happens if a driver cancels?",
      answer: "If a driver cancels, we will immediately attempt to match you with another available driver nearby. You will not be charged for the canceled trip.",
    },
    {
      question: "How do subscriptions work?",
      answer: "Subscriptions give you a set number of rides per month at a discounted rate. You can view your current plan usage on the Dashboard tab.",
    },
    {
      question: "How do I update my payment method?",
      answer: "Currently, all payments are handled via Orange Money or cash. You can select your preferred payment method when requesting a ride.",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-up pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2">
        <Link
          to="/account"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold">Help & Support</h1>
          <p className="text-sm text-muted-foreground">We're here to help you.</p>
        </div>
      </div>

      {/* Contact Options */}
      <div className="grid grid-cols-2 gap-4">
        <a href="tel:+23272804884" className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl p-6 transition hover:bg-secondary/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-medium">Call Us</h3>
            <p className="text-xs text-muted-foreground mt-1">+232 72 804 884</p>
          </div>
        </a>
        <a href="mailto:easiride@gmail.com" className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl p-6 transition hover:bg-secondary/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-6 w-6 text-blue-500" />
          </div>
          <div className="text-center">
            <h3 className="font-medium">Email Us</h3>
            <p className="text-xs text-muted-foreground mt-1">easiride@gmail.com</p>
          </div>
        </a>
      </div>

      <div className="glass-card rounded-2xl p-4 transition hover:bg-secondary/30">
        <a href="https://wa.me/23272804884" target="_blank" rel="noreferrer" className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-medium">Live Chat (WhatsApp)</h3>
              <p className="text-xs text-muted-foreground">Fastest response time</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-400">
            Message
          </Button>
        </a>
      </div>

      {/* FAQ Section */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-2">
          <FileQuestion className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Frequently Asked Questions</h2>
        </div>

        <div className="glass-card rounded-2xl p-2 px-4">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-hairline/60">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default HelpSupport;
