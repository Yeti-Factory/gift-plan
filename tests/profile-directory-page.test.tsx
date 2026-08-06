// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiQueryMock, apiActionMock } = vi.hoisted(() => ({
  apiQueryMock: vi.fn(),
  apiActionMock: vi.fn(),
}));

vi.mock("@/lib/self-hosted/api-client", () => ({
  apiQuery: apiQueryMock,
  apiAction: apiActionMock,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    to: string;
    "aria-label"?: string;
  }) => (
    <a href={to} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProfileDirectoryPage } from "@/components/ProfileDirectoryPage";

const publicProfile = {
  id: "public-1",
  username: "alice",
  display_name: "Alice",
  avatar_url: null,
  bio: "Profil public",
  visibility: "public",
  can_view: true,
  is_self: false,
  outgoing_request_id: null,
  outgoing_status: null,
  incoming_request_id: null,
  incoming_status: null,
};

const privateProfile = {
  id: "private-1",
  username: "bruno",
  display_name: "Bruno",
  avatar_url: null,
  bio: null,
  visibility: "private",
  can_view: false,
  is_self: false,
  outgoing_request_id: null,
  outgoing_status: null,
  incoming_request_id: null,
  incoming_status: null,
};

function mockDirectory(inbox = { pending: [], granted: [] }) {
  apiQueryMock.mockResolvedValue({
    directory: { profiles: [publicProfile, privateProfile], total: 2 },
    inbox,
  });
  apiActionMock.mockResolvedValue(undefined);
}

beforeEach(() => {
  apiQueryMock.mockReset();
  apiActionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("profile directory page", () => {
  it("shows public and private profiles with the correct actions", async () => {
    mockDirectory();
    render(<ProfileDirectoryPage />);

    expect(await screen.findByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Liste des profils" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Public")).toHaveLength(1);
    expect(screen.getAllByText("Privé")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Voir les listes/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Se connecter/i })).toBeTruthy();
    expect(screen.queryByText("Profil public")).toBeNull();
    expect(screen.queryByText("Ses listes publiques sont accessibles.")).toBeNull();
  });

  it("sends a connection request for a private profile", async () => {
    mockDirectory();
    const user = userEvent.setup();
    render(<ProfileDirectoryPage />);
    await screen.findByText("Bruno");

    await user.click(screen.getByRole("button", { name: /Se connecter/i }));

    expect(apiActionMock).toHaveBeenCalledWith("request", { profileId: "private-1" });
  });

  it("lets the owner accept an incoming request", async () => {
    mockDirectory({
      pending: [
        {
          request_id: "request-1",
          requester_id: "private-1",
          username: "bruno",
          display_name: "Bruno",
          avatar_url: null,
          created_at: "2026-07-20T18:00:00Z",
        },
      ],
      granted: [],
    });
    const user = userEvent.setup();
    render(<ProfileDirectoryPage />);

    await user.click(await screen.findByRole("button", { name: "Accepter" }));

    await waitFor(() => {
      expect(apiActionMock).toHaveBeenCalledWith("respond", {
        requestId: "request-1",
        accept: true,
      });
    });
  });
});
