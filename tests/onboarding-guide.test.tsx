// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Mocks ---------------------------------------------------------------

const navigateMock = vi.fn();
let mockPathname = "/people";

vi.mock("@tanstack/react-router", () => ({
  useLocation: (opts?: { select?: (l: { pathname: string }) => unknown }) =>
    opts?.select ? opts.select({ pathname: mockPathname }) : { pathname: mockPathname },
  useNavigate: () => navigateMock,
}));

const { updateMock, maybeSingleMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/self-hosted/api-client", () => ({
  apiQuery: maybeSingleMock,
  apiAction: (action: string, payload: Record<string, unknown>) => {
    updateMock(action, payload);
    return Promise.resolve();
  },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Radix Dialog uses PointerEvent APIs jsdom doesn't fully implement.
type PointerEventCtor = typeof PointerEvent;
const globalWithPointer = globalThis as typeof globalThis & {
  PointerEvent?: PointerEventCtor;
};
if (!globalWithPointer.PointerEvent) {
  globalWithPointer.PointerEvent =
    class PointerEvent extends Event {} as unknown as PointerEventCtor;
}
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
const htmlProto = HTMLElement.prototype as HTMLElement & { scrollIntoView?: () => void };
if (!htmlProto.scrollIntoView) {
  htmlProto.scrollIntoView = () => {};
}

// --- Import under test (after mocks) --------------------------------------

import {
  OnboardingGuide,
  openOnboardingGuide,
  ONBOARDING_VERSION,
} from "@/components/OnboardingGuide";

const user = { id: "user-1", email: "u@example.com" };

beforeEach(() => {
  navigateMock.mockClear();
  updateMock.mockClear();
  maybeSingleMock.mockReset();
  mockPathname = "/people";
});

afterEach(() => cleanup());

async function renderAutoOpen() {
  maybeSingleMock.mockResolvedValueOnce({ onboarding_completed_at: null, onboarding_version: 0 });
  render(<OnboardingGuide user={user} />);
  await screen.findByText(/Bienvenue dans Gift-Plan/i);
}

describe("<OnboardingGuide />", () => {
  it("does not auto-open on technical routes", async () => {
    mockPathname = "/auth";
    maybeSingleMock.mockResolvedValueOnce({
      onboarding_completed_at: null,
      onboarding_version: 0,
    });
    render(<OnboardingGuide user={user} />);
    // Give the effect a tick — it should bail out on technical routes.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Bienvenue dans Gift-Plan/i)).toBeNull();
  });

  it("does not auto-open for a user who already completed the current version", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_version: ONBOARDING_VERSION,
    });
    render(<OnboardingGuide user={user} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Bienvenue dans Gift-Plan/i)).toBeNull();
  });

  it("navigates Précédent / Suivant through all 5 steps", async () => {
    await renderAutoOpen();
    const u = userEvent.setup();

    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /Suivant/i }));
    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /Suivant/i }));
    await u.click(screen.getByRole("button", { name: /Suivant/i }));
    await u.click(screen.getByRole("button", { name: /Suivant/i }));
    expect(screen.getByText(/Étape 5 sur 5/)).toBeTruthy();

    // Final step swaps Suivant for two CTAs.
    expect(screen.queryByRole("button", { name: /^Suivant$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Créer un cercle/i })).toBeTruthy();

    await u.click(screen.getByRole("button", { name: /Précédent/i }));
    expect(screen.getByText(/Étape 4 sur 5/)).toBeTruthy();
  });

  it("persists version + completed_at when the user clicks Passer", async () => {
    await renderAutoOpen();
    await userEvent.setup().click(screen.getByRole("button", { name: /Passer le guide/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1];
    expect(payload.version).toBe(ONBOARDING_VERSION);
    expect(payload.markCompleted).toBe(true);
  });

  it("Terminer + CTA navigates to /circles with a validated search param", async () => {
    await renderAutoOpen();
    const u = userEvent.setup();
    for (let i = 0; i < 4; i++) {
      await u.click(screen.getByRole("button", { name: /Suivant/i }));
    }
    await u.click(screen.getByRole("button", { name: /Créer un cercle/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/circles",
        search: { onboarding: "create" },
      }),
    );
  });

  it("closing via Escape persists progress (behaves like Passer)", async () => {
    await renderAutoOpen();
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = updateMock.mock.calls[0][1];
    expect(payload.version).toBe(ONBOARDING_VERSION);
    expect(payload.markCompleted).toBe(true);
  });

  it("manual reopen never overwrites onboarding_completed_at", async () => {
    // User already finished the guide previously.
    maybeSingleMock.mockResolvedValueOnce({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_version: ONBOARDING_VERSION,
    });
    render(<OnboardingGuide user={user} />);
    await new Promise((r) => setTimeout(r, 20));

    // Now reopen from the account page.
    openOnboardingGuide();
    await screen.findByText(/Bienvenue dans Gift-Plan/i);

    await userEvent.setup().click(screen.getByRole("button", { name: /Passer le guide/i }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = updateMock.mock.calls[0][1];
    expect(payload.version).toBe(ONBOARDING_VERSION);
    expect(payload.markCompleted).toBe(false);
  });
});
