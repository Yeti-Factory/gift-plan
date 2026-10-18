// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateCircleConversation } from "../src/components/CreateCircleConversation";
import { GroupMessagingPage } from "../src/components/GroupMessagingPage";
const api = vi.hoisted(() => ({ query: vi.fn(), action: vi.fn(), navigate: vi.fn() }));
vi.mock("../src/lib/self-hosted/api-client", () => ({
  apiQuery: api.query,
  apiAction: api.action,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => api.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/messages">{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const members = [
  { user_id: "a", profile: { display_name: "Alice", username: "alice" } },
  { user_id: "b", profile: { display_name: "Bruno", username: "bruno" } },
  { user_id: "c", profile: { display_name: "Émilie", username: "emilie" } },
];
describe("circle surprise conversations", () => {
  it("excludes a chosen person and requires an explicit recap confirmation before creation", async () => {
    api.action.mockResolvedValue({ conversationId: "group" });
    const user = userEvent.setup();
    render(<CreateCircleConversation circleId="circle" members={members} userId="a" />);
    await user.click(screen.getByRole("button", { name: "Écrire au cercle" }));
    await user.type(screen.getByLabelText("Nom de la conversation"), "Surprise pour Émilie");
    await user.click(screen.getByRole("checkbox", { name: "Émilie" }));
    await user.click(screen.getByRole("button", { name: "Vérifier avant de créer" }));
    expect(api.action).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Participants (2)" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Personnes exclues" }).nextElementSibling?.textContent,
    ).toBe("Émilie");
    await user.click(screen.getByRole("button", { name: "Créer avec ces participants" }));
    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(
        "group-message-create",
        expect.objectContaining({
          participantIds: ["a", "b"],
          circleId: "circle",
          title: "Surprise pour Émilie",
        }),
      ),
    );
    expect(api.navigate).toHaveBeenCalledWith({
      to: "/group-messages/$groupId",
      params: { groupId: "group" },
    });
  });
  it("lets the sender review and change a selection without creating anything", async () => {
    const user = userEvent.setup();
    render(<CreateCircleConversation circleId="circle" members={members} userId="a" />);
    await user.click(screen.getByRole("button", { name: "Écrire au cercle" }));
    await user.type(screen.getByLabelText("Nom de la conversation"), "Surprise");
    await user.click(screen.getByRole("button", { name: "Vérifier avant de créer" }));
    await user.click(screen.getByRole("button", { name: "Modifier la sélection" }));
    await user.click(screen.getByRole("checkbox", { name: "Bruno" }));
    await user.click(screen.getByRole("checkbox", { name: "Émilie" }));
    expect(
      (screen.getByRole("button", { name: "Vérifier avant de créer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(api.action).not.toHaveBeenCalled();
  });
  it("shows the actual participants, escapes content and sends only to the selected group", async () => {
    const thread = {
      conversation: { id: "group", title: "Surprise" },
      participants: [
        { id: "a", username: "alice", display_name: "Alice" },
        { id: "b", username: "bruno", display_name: "Bruno" },
      ],
      messages: [
        {
          id: "1",
          sender_id: "b",
          sender_name: "Bruno",
          body: "<img src=x> Orange !",
          created_at: "2026-10-18T12:00:00Z",
        },
      ],
      hasMore: false,
      canSend: true,
    };
    api.query.mockResolvedValue(thread);
    api.action.mockResolvedValue({ conversationId: "group" });
    const user = userEvent.setup();
    const { container } = render(<GroupMessagingPage userId="a" conversationId="group" />);
    const participants = await screen.findByRole("region", { name: "Participants" });
    expect(within(participants).queryByText("Émilie")).toBeNull();
    expect(await screen.findByText("<img src=x> Orange !")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    await user.type(screen.getByLabelText("Votre message au groupe"), "D’accord");
    await user.click(screen.getByRole("button", { name: "Envoyer au groupe" }));
    await waitFor(() =>
      expect(api.action).toHaveBeenCalledWith(
        "group-message-send",
        expect.objectContaining({
          conversationId: "group",
          text: "D’accord",
          nonce: expect.any(String),
        }),
      ),
    );
  });
});
