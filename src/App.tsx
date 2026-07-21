import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RideProvider } from "@/context/RideContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Request from "./pages/Request.tsx";
import Matching from "./pages/Matching.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Account from "./pages/Account.tsx";
import NotFound from "./pages/NotFound.tsx";
import Checkout from "./pages/Checkout.tsx";
import CheckoutComplete from "./pages/CheckoutComplete.tsx";
import Notifications from "./pages/Notifications.tsx";
import PrivacySecurity from "./pages/PrivacySecurity.tsx";
import HelpSupport from "./pages/HelpSupport.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import TripBooking from "./pages/TripBooking.tsx";
import ClaimSeat from "./pages/ClaimSeat.tsx";

import Onboarding from "./pages/Onboarding.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <RideProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/claim/:id" element={<ClaimSeat />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/checkout/complete" element={<CheckoutComplete />} />
                <Route path="/trip/complete" element={<CheckoutComplete />} />
                <Route path="/request" element={<Request />} />
                <Route path="/account" element={<Account />} />
                <Route path="/account/notifications" element={<Notifications />} />
                <Route path="/account/privacy" element={<PrivacySecurity />} />
                <Route path="/account/help" element={<HelpSupport />} />
              </Route>

              {/* Subpages that should not have the main persistent headers or bottom tabs */}
              <Route
                element={
                  <ProtectedRoute>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/matching/:id" element={<Matching />} />
                <Route path="/checkout/weekly" element={<Checkout />} />
                <Route path="/trip/book" element={<TripBooking />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </RideProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
