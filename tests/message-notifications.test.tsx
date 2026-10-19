// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageNotifications } from "../src/components/MessageNotifications";
import { GroupInboxSection } from "../src/components/GroupInboxSection";
import {
  MESSAGES_CHANGED_EVENT,
  newReceivedMessage,
  type MessageNotificationsSnapshot,
} from "../src/lib/message-notifications";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  navigate: vi.fn(),
  message: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("../src/lib/self-hosted/api-client", () => ({ apiQuery: mocks.query }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({
    children,
    to,
    search: _search,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { message: mocks.message, dismiss: mocks.dismiss } }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

const initial: MessageNotificationsSnapshot = {
  unread: 2,
  direct: {
    id: "9007199254740993",
    recipientId: "bruno",
    unread: true,
    createdAt: "2026-10-18T12:00:00Z",
  },
  group: null,
};
describe("received message indicators", () => {
  it("distinguishes unread group conversations and removes the styling after reading", async () => {
    vi.useFakeTimers();
    let unread = 2;
    mocks.query.mockImplementation(async () => ({
      groups: [{ id: "surprise", title: "Cadeau commun", unread, participant_count: 3 }],
      hasMore: false,
    }));
    await act(async () => {
      render(<GroupInboxSection />);
    });
    expect(screen.getByText("Cadeau commun").className).toContain("font-bold");
    expect(screen.getByLabelText("2 messages non lus")).toBeTruthy();
    unread = 0;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByText("Cadeau commun").className).toContain("font-normal");
    expect(screen.queryByLabelText("2 messages non lus")).toBeNull();
  });
  it("badges existing unread messages, notifies new direct and group messages, and clears after reading", async () => {
    vi.useFakeTimers();
    let snapshot = initial;
    mocks.query.mockImplementation(async () => snapshot);
    await act(async () => {
      render(<MessageNotifications userId="alice" />);
    });
    expect(screen.getByRole("link", { name: "Messages, 2 non lus" })).toBeTruthy();
    expect(mocks.message).not.toHaveBeenCalled();
    // A read elsewhere can offset an arrival: the unread total alone is insufficient.
    snapshot = { ...initial, direct: { ...initial.direct!, id: "9007199254740994" } };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(mocks.message).toHaveBeenCalledTimes(1);
    expect(mocks.message.mock.calls[0][0]).toBe("Nouveau message reçu");
    mocks.message.mock.calls[0][1].action.onClick();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/messages",
      search: { recipient: "bruno" },
    });
    snapshot = {
      ...snapshot,
      unread: 3,
      group: { id: "1", groupId: "surprise", unread: true, createdAt: "2026-10-18T12:01:00Z" },
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(mocks.message).toHaveBeenCalledTimes(2);
    mocks.message.mock.calls[1][1].action.onClick();
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/group-messages/$groupId",
      params: { groupId: "surprise" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(mocks.message).toHaveBeenCalledTimes(2);
    snapshot = {
      ...snapshot,
      unread: 0,
      direct: { ...snapshot.direct!, unread: false },
      group: { ...snapshot.group!, unread: false },
    };
    await act(async () => {
      window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
    });
    expect(screen.getByRole("link", { name: "Messages" })).toBeTruthy();
    expect(screen.queryByText("3")).toBeNull();
    expect(mocks.dismiss).toHaveBeenCalledWith("gp-new-message-alice");
  });
  it("keeps counts on network errors, caps the badge and cleans up polling", async () => {
    vi.useFakeTimers();
    mocks.query
      .mockResolvedValueOnce({ ...initial, unread: 123 })
      .mockRejectedValue(new Error("Offline"));
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<MessageNotifications userId="alice" />));
    });
    expect(screen.getByText("99+")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByRole("link", { name: "Messages, 123 non lus" })).toBeTruthy();
    unmount();
    const count = mocks.query.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
      window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
    });
    expect(mocks.query).toHaveBeenCalledTimes(count);
  });
  it("does not alert for already read messages or regressing cursors", () => {
    expect(newReceivedMessage(initial, initial)).toBeUndefined();
    expect(
      newReceivedMessage(initial, { ...initial, direct: { ...initial.direct!, id: "1" } }),
    ).toBeUndefined();
    expect(
      newReceivedMessage(initial, {
        ...initial,
        direct: { ...initial.direct!, id: "9007199254740994", unread: false },
      }),
    ).toBeUndefined();
  });
});
