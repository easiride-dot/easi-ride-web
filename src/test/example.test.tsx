import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Account from "@/pages/Account";
import Checkout from "@/pages/Checkout";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const useAuthMock = vi.mocked(useAuth);
const useProfileMock = vi.mocked(useProfile);
const fromMock = vi.mocked(supabase.from);

describe("rider app fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: {
        id: "user-1",
        email: "student@example.com",
      } as never,
      session: null,
      loading: false,
      signOut: vi.fn(),
    });
  });

  it("shows the real verification badge state on the account page", () => {
    useProfileMock.mockReturnValue({
      profile: {
        full_name: "Aminata Sesay",
        phone: "+23278000000",
        verification_status: "pending",
      } as never,
      loading: false,
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("filters out expired subscriptions in the active plan query", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const gtMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqStatusMock = vi.fn().mockReturnValue({ gt: gtMock });
    const eqUserMock = vi.fn().mockReturnValue({ eq: eqStatusMock });

    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqUserMock }),
    } as never);

    const TestComponent = () => {
      useSubscription();
      return null;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledWith("subscriptions");
    });

    expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqStatusMock).toHaveBeenCalledWith("status", "active");
    expect(gtMock).toHaveBeenCalledWith("end_date", expect.any(String));
  });

  it("blocks checkout until the student ID is approved", () => {
    useProfileMock.mockReturnValue({
      profile: {
        full_name: "Aminata Sesay",
        phone: "+23278000000",
        verification_status: "pending",
      } as never,
      loading: false,
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/checkout/shared"]}>
        <Checkout />
      </MemoryRouter>
    );

    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByText(/must be approved before you can subscribe/i)).toBeInTheDocument();
    expect(screen.queryByText("Pay with Orange Money")).not.toBeInTheDocument();
  });
});
