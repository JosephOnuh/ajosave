import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCircleForm } from "../CreateCircleForm";
import { useRouter } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

describe("CreateCircleForm", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (global.fetch as jest.Mock).mockReset();
    
    // Default implementation to handle background FX rate queries smoothly
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/fx/rate")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { rate: 1500, fetchedAt: new Date().toISOString() } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { id: "new-circle-id" } }),
      });
    });

    mockPush.mockClear();
  });

  it("shows validation errors for invalid inputs", async () => {
    render(<CreateCircleForm />);
    
    const submitButton = screen.getByRole("button", { name: /create circle/i });
    fireEvent.click(submitButton);

    // Errors should appear for empty/invalid fields
    expect(await screen.findByText(/circle name must be at least 3 characters/i)).toBeInTheDocument();
  });

  it("calls API with correct payload on valid submission", async () => {
    render(<CreateCircleForm />);

    // Fill the form
    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });
    
    const submitButton = screen.getByRole("button", { name: /create circle/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/circles", expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }));
    });

    // Check payload
    const calls = (global.fetch as jest.Mock).mock.calls;
    const circleCall = calls.find(c => c[0].includes("/api/v1/circles"));
    expect(circleCall).toBeDefined();
    const callBody = JSON.parse(circleCall[1].body);
    expect(callBody.name).toBe("Lagos Monthly");
    
    // Check redirection
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/circles/new-circle-id");
    });
  });

  it("shows loading state during submission", async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/fx/rate")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { rate: 1500, fetchedAt: new Date().toISOString() } }),
        });
      }
      if (url.includes("/circles")) {
        return fetchPromise;
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<CreateCircleForm />);

    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /create circle/i }));

    // Button should be in loading state (disabled and showing loading text)
    const submitButton = screen.getByRole("button", { name: /loading/i });
    expect(submitButton).toBeDisabled();

    // Resolve the promise
    await waitFor(() => {
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, data: { id: "id" } }),
      });
    });
  });

  it("shows error message on API failure", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/fx/rate")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { rate: 1500 } }),
        });
      }
      if (url.includes("/circles")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ success: false, error: "Failed to create circle" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<CreateCircleForm />);

    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /create circle/i }));

    expect(await screen.findByText(/failed to create circle/i)).toBeInTheDocument();
  });
});
