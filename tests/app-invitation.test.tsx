// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({ options }),
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: { mode?: string };
    children: React.ReactNode;
  }) => <a href={`${to}${search?.mode ? `?mode=${search.mode}` : ""}`}>{children}</a>,
}));
vi.mock("@/components/PublicHeader", () => ({ PublicHeader: () => null }));
vi.mock("@/components/PoweredByYetiLab", () => ({ PoweredByYetiLab: () => null }));

import { InviteAppButton } from "@/components/InviteAppButton";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Route } from "@/routes/invite";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome/145.0");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

function openInvitation() {
  render(<InviteAppButton />);
  fireEvent.click(screen.getByRole("button", { name: "Inviter un proche" }));
}

describe("app invitation", () => {
  it("copies an invitation to the public onboarding page without a private profile token", async () => {
    openInvitation();
    const message = (screen.getByLabelText("Message d’invitation") as HTMLTextAreaElement).value;
    expect(message).toContain(`${window.location.origin}/invite`);
    expect(message).not.toContain("?invite=");
    fireEvent.click(screen.getByRole("button", { name: "Copier l’invitation" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message));
    expect(mocks.success).toHaveBeenCalled();
  });

  it("keeps the message selectable and reports when clipboard access is denied", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    openInvitation();
    fireEvent.click(screen.getByRole("button", { name: "Copier l’invitation" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message d’invitation")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Copier l’invitation" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("uses native sharing and treats cancellation as a normal outcome", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    openInvitation();
    fireEvent.click(screen.getByRole("button", { name: "Partager l’invitation" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Partager l’invitation" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(mocks.error).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("offers account creation, existing-account login and manual installation to recipients", () => {
    const Page = (Route as unknown as { options: { component: React.ComponentType } }).options
      .component;
    render(<Page />);
    expect(screen.getByRole("link", { name: "Créer mon compte" }).getAttribute("href")).toBe(
      "/auth?mode=signup",
    );
    expect(screen.getByRole("link", { name: "J’ai déjà un compte" }).getAttribute("href")).toBe(
      "/auth",
    );
    const request = vi.fn();
    window.addEventListener("gp-install-requested", request);
    fireEvent.click(screen.getByRole("button", { name: "Installer Gift-Plan" }));
    expect(request).toHaveBeenCalledOnce();
    window.removeEventListener("gp-install-requested", request);
  });
});

describe("installation requested from an invitation", () => {
  it("shows iPhone instructions even after the automatic install banner was dismissed", () => {
    localStorage.setItem("gp-install-dismissed-at", String(Date.now()));
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Safari/605.1");
    render(<InstallPrompt />);
    expect(screen.queryByText("Garder Gift-Plan sous la main")).toBeNull();
    fireEvent(window, new Event("gp-install-requested"));
    expect(screen.getByText("Installer sur iPhone / iPad")).toBeTruthy();
  });

  it("retains the native install event after dismissal and consumes it only once", async () => {
    localStorage.setItem("gp-install-dismissed-at", String(Date.now()));
    render(<InstallPrompt />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByText("Garder Gift-Plan sous la main")).toBeNull();
    fireEvent(window, new Event("gp-install-requested"));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    fireEvent(window, new Event("gp-install-requested"));
    expect(screen.getByText("Installer sur ordinateur")).toBeTruthy();
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("shows Android instructions immediately when native installation is unavailable", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android Chrome/145.0");
    render(<InstallPrompt />);
    fireEvent(window, new Event("gp-install-requested"));
    expect(screen.getByText("Installer sur Android")).toBeTruthy();
    expect(screen.getByText(/Dans Chrome, ouvrez le menu/)).toBeTruthy();
  });
});
