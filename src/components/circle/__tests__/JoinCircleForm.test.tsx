import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { JoinCircleForm } from "../JoinCircleForm";
import { useRouter } from "next/navigation";
import type { Circle } from "@/types";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock the Freighter wallet hook
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
let mockWalletState = {
  connectionState: "not_installed" as const,
  publicKey: null as string | null,
  error: null as string | null,
  connect: mockConnect,
  disconnect: mockDisconnect,
};

jest.mock("@/hooks/useFreighterWallet", () => ({
  useFreighterWallet: () => mockWalletState,
}));

// Mock ConnectWalletButton
jest.mock("@/components/wallet/ConnectWalletButton", () => ({
  ConnectWalletButton: ({ connectionState, onConnect, onDisconnect, publicKey }: {
    connectionState: string;
    onConnect: () => void;
    onDisconnect: () => void;
    publicKey: string | null;
  }) => {
    if (connectionState === "not_installed") return null;
    if (connectionState === "connected") {
      return (
        <>
          <p role="status">Connected: {publicKey?.slice(0, 8)}…{publicKey?.slice(-4)}</p>
          <button type="button" onClick={onDisconnect}>Disconnect</button>
        </>
      );
    }
    return (
      <button type="button" onClick={onConnect} aria-label="Connect Freighter Wallet">
        Connect Wallet
      </button>
    );
  },
}));

global.fetch = jest.fn();

const mockCircle: Circle = {
  id: "circle-1",
  name: "Test Circle",
  creatorId: "user-creator",
  contributionUsdc: "25.0000000",
  contributionFiat: 10000,
  contributionCurrency: "NGN",
  circleType: "public",
  maxMembers: 5,
  cycleFrequency: "monthly",
  payoutMethod: "fixed",
  gracePeriodHours: 24,
  status: "open",
  currentCycle: 0,
  memberCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("JoinCircleForm — wallet connect flow", () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, refresh: mockRefresh });
    (global.fetch as jest.Mock).mockClear();
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();

    // Default: profile fetch returns no saved key; balance check not needed
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/v1/profile") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { stellarPublicKey: null } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });

    // Reset wallet state
    mockWalletState = {
      connectionState: "not_installed",
      publicKey: null,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
    };
  });

  it("shows install Freighter link when wallet is not installed", async () => {
    render(<JoinCircleForm circle={mockCircle} />);
    expect(await screen.findByText(/install freighter/i)).toBeInTheDocument();
  });

  it("shows Connect Wallet button when Freighter is installed but disconnected", async () => {
    mockWalletState = { ...mockWalletState, connectionState: "disconnected" };
    render(<JoinCircleForm circle={mockCircle} />);
    expect(await screen.findByRole("button", { name: /connect freighter wallet/i })).toBeInTheDocument();
  });

  it("calls connect() when Connect Wallet button is clicked", async () => {
    mockWalletState = { ...mockWalletState, connectionState: "disconnected" };
    render(<JoinCircleForm circle={mockCircle} />);
    const btn = await screen.findByRole("button", { name: /connect freighter wallet/i });
    fireEvent.click(btn);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("populates stellarPublicKey field when wallet connects", async () => {
    const key = "GBSOMEADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAAAAA";
    mockWalletState = { ...mockWalletState, connectionState: "connected", publicKey: key };

    render(<JoinCircleForm circle={mockCircle} />);

    await waitFor(() => {
      const input = screen.getByLabelText(/stellar public key/i) as HTMLInputElement;
      expect(input.value).toBe(key);
    });
  });

  it("auto-saves stellarPublicKey via PATCH /api/v1/profile when wallet connects", async () => {
    const key = "GBSOMEADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAAAAA";
    mockWalletState = { ...mockWalletState, connectionState: "connected", publicKey: key };

    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/v1/profile" && (!opts || opts.method !== "PATCH")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { stellarPublicKey: null } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { updated: true } }) });
    });

    render(<JoinCircleForm circle={mockCircle} />);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const patchCall = calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url === "/api/v1/profile" && opts?.method === "PATCH"
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(patchCall[1].body as string);
      expect(body.stellarPublicKey).toBe(key);
    });
  });

  it("shows connected status message with truncated key when wallet is connected", async () => {
    const key = "GBSOMEADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAAAAA";
    mockWalletState = { ...mockWalletState, connectionState: "connected", publicKey: key };

    render(<JoinCircleForm circle={mockCircle} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      `Connected: ${key.slice(0, 8)}…${key.slice(-4)}`
    );
  });

  it("shows Disconnect button when wallet is connected", async () => {
    const key = "GBSOMEADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAAAAA";
    mockWalletState = { ...mockWalletState, connectionState: "connected", publicKey: key };

    render(<JoinCircleForm circle={mockCircle} />);

    expect(await screen.findByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("calls disconnect() and clears the key when Disconnect is clicked", async () => {
    const key = "GBSOMEADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAAAAAAA";
    mockWalletState = { ...mockWalletState, connectionState: "connected", publicKey: key };

    const { rerender } = render(<JoinCircleForm circle={mockCircle} />);

    const disconnectBtn = await screen.findByRole("button", { name: /disconnect/i });
    fireEvent.click(disconnectBtn);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    // Simulate hook state change after disconnect
    mockWalletState = { ...mockWalletState, connectionState: "disconnected", publicKey: null };
    rerender(<JoinCircleForm circle={mockCircle} />);

    await waitFor(() => {
      const input = screen.getByLabelText(/stellar public key/i) as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  it("displays wallet error with role=alert", async () => {
    mockWalletState = {
      ...mockWalletState,
      connectionState: "disconnected",
      error: "Connection request was rejected. You can enter your Stellar key manually.",
    };

    render(<JoinCircleForm circle={mockCircle} />);

    const alert = await screen.findByRole("alert", {
      name: (_, el) => el.textContent?.includes("Connection request was rejected") ?? false,
    });
    expect(alert).toBeInTheDocument();
  });
});
