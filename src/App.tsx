import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/checkout/:plan" element={<Checkout />} />
                <Route path="/request" element={<Request />} />
                <Route path="/matching/:id" element={<Matching />} />
                <Route path="/account" element={<Account />} />
                {/* Admin panel has been moved to a separate project */}
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
