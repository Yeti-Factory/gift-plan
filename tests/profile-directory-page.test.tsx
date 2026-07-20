// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
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
  rpcMock.mockImplementation((name: string) => {
    if (name === "list_profile_directory") {
      return Promise.resolve({
        data: { profiles: [publicProfile, privateProfile], total: 2 },
        error: null,
      });
    }
    if (name === "list_profile_access_inbox") {
      return Promise.resolve({ data: inbox, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

beforeEach(() => {
  rpcMock.mockReset();
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
    expect(screen.getAllByText("Public")).toHaveLength(1);
    expect(screen.getAllByText("Privé")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Voir les listes/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Se connecter/i })).toBeTruthy();
  });

  it("sends a connection request for a private profile", async () => {
    mockDirectory();
    const user = userEvent.setup();
    render(<ProfileDirectoryPage />);
    await screen.findByText("Bruno");

    await user.click(screen.getByRole("button", { name: /Se connecter/i }));

    expect(rpcMock).toHaveBeenCalledWith("request_profile_access", {
      _profile_id: "private-1",
    });
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
      expect(rpcMock).toHaveBeenCalledWith("respond_profile_access", {
        _request_id: "request-1",
        _accept: true,
      });
    });
  });
});
