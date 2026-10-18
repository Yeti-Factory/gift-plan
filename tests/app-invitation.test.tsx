// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { IOS_GUIDE_SEEN_KEY } from "@/lib/installation-guide";
import { IosInstallGuide } from "@/components/IosInstallGuide";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
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
  vi.useRealTimers();
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
    expect(message).toContain("Sur iPhone / iPad");
    expect(message).toContain("Safari");
    expect(message).toContain("Sur l’écran d’accueil");
    expect(message).toContain("Ouvrir comme app web");
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
    expect(share.mock.calls[0][0].text).toContain("Sur iPhone / iPad");
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
  it("automatically opens the full iPhone guide once and lets users continue without installing", () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Safari/605.1");
    const view = render(<InstallPrompt />);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Installer sur iPhone / iPad")).toBeTruthy();
    expect(localStorage.getItem(IOS_GUIDE_SEEN_KEY)).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Continuer sans installer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    view.unmount();
    render(<InstallPrompt />);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent(window, new Event("gp-install-requested"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("does not show iPhone onboarding in an installed app", () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Safari/605.1");
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<InstallPrompt />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(IOS_GUIDE_SEEN_KEY)).toBeNull();
  });
  it("does not show the iPhone guide automatically on Android", () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android Chrome/145.0");
    render(<InstallPrompt />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not interrupt password recovery with the automatic guide", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/reset-password");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Safari/605.1");
    render(<InstallPrompt />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(IOS_GUIDE_SEEN_KEY)).toBeNull();
    fireEvent(window, new Event("gp-install-requested"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("keeps the Safari link selectable when clipboard access is denied", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    render(<IosInstallGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien pour Safari" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect((screen.getByLabelText("Lien à ouvrir dans Safari") as HTMLInputElement).value).toBe(
      `${window.location.origin}/invite`,
    );
  });
  it("copies a safe public link for moving from a messaging app to Safari", async () => {
    render(<IosInstallGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien pour Safari" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/invite`,
      ),
    );
    expect(mocks.success).toHaveBeenCalled();
  });
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
