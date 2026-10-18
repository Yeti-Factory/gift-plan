// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagingPage } from "../src/components/MessagingPage";
const api = vi.hoisted(() => ({ query: vi.fn(), action: vi.fn() }));
vi.mock("../src/lib/self-hosted/api-client", () => ({
  apiQuery: api.query,
  apiAction: api.action,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/people">{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const conversation = {
  id: "conversation",
  other_id: "bruno",
  username: "bruno",
  display_name: "Bruno",
  initiated_by: "bruno",
  status: "pending",
  blocked: false,
  blocked_by_me: false,
  unread: 1,
  updated_at: "2026-10-18T12:00:00Z",
};
const message = {
  id: "1",
  sender_id: "bruno",
  body: "<img src=x onerror=alert(1)> Surprise !",
  created_at: "2026-10-18T12:00:00Z",
};
describe("private messaging interface", () => {
  it("opens a new recipient and sends the first message before waiting for acceptance", async () => {
    let created = false;
    const pending = {
      ...conversation,
      other_id: "emilie",
      username: "emilie",
      display_name: "Émilie",
      initiated_by: "alice",
    };
    api.query.mockImplementation(async (view: string) => {
      if (view === "messages")
        return {
          conversations: created ? [pending] : [],
          unread: 0,
          userId: "alice",
          hasMore: false,
        };
      if (view === "message-recipient")
        return { id: "emilie", display_name: "Émilie", username: "emilie", conversation_id: null };
      return {
        conversation: pending,
        messages: [{ ...message, sender_id: "alice", body: "Bonjour Émilie" }],
        hasMore: false,
      };
    });
    api.action.mockImplementation(async () => {
      created = true;
      return { conversationId: "conversation" };
    });
    const user = userEvent.setup();
    render(<MessagingPage userId="alice" recipientId="emilie" />);
    await user.type(await screen.findByLabelText("Votre message"), "Bonjour Émilie");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(
        "message-start",
        expect.objectContaining({ recipientId: "emilie", text: "Bonjour Émilie" }),
      ),
    );
    expect(await screen.findByText(/Demande envoyée\. Vous pourrez/)).toBeTruthy();
    expect(screen.queryByLabelText("Votre message")).toBeNull();
  });
  it("requires acceptance before replying, escapes message text and allows sending and blocking", async () => {
    let state = { ...conversation };
    api.query.mockImplementation(async (view: string) =>
      view === "messages"
        ? { conversations: [state], unread: 1, userId: "alice" }
        : { conversation: state, messages: [message], hasMore: false },
    );
    api.action.mockImplementation(async (action: string) => {
      if (action === "message-accept") state = { ...state, status: "accepted" };
      if (action === "message-block") state = { ...state, blocked: true, blocked_by_me: true };
      return { conversationId: "conversation" };
    });
    const user = userEvent.setup();
    const { container } = render(<MessagingPage userId="alice" />);
    await user.click(await screen.findByRole("button", { name: /Bruno/ }));
    expect(await screen.findByText(message.body)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Accepter" }));
    await user.type(await screen.findByLabelText("Votre message"), "Bonne idée !");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(
        "message-send",
        expect.objectContaining({
          conversationId: "conversation",
          text: "Bonne idée !",
          nonce: expect.any(String),
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Bloquer cette personne" }));
    expect(await screen.findByText(/Échange bloqué :/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();
  });
  it("shows a recoverable load error", async () => {
    api.query.mockRejectedValue(new Error("Offline"));
    render(<MessagingPage userId="alice" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});
