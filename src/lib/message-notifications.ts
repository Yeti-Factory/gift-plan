export const MESSAGES_CHANGED_EVENT = "gp-messages-changed";

type ReceivedMessage = { id: string; createdAt: string; unread: boolean };
export type MessageNotificationsSnapshot = {
  unread: number;
  direct: (ReceivedMessage & { recipientId: string }) | null;
  group: (ReceivedMessage & { groupId: string }) | null;
};

export function newReceivedMessage(
  previous: MessageNotificationsSnapshot,
  next: MessageNotificationsSnapshot,
) {
  const direct = next.direct;
  const group = next.group;
  const incoming = [
    direct?.unread && BigInt(direct.id) > BigInt(previous.direct?.id ?? "0")
      ? { ...direct, kind: "direct" as const }
      : null,
    group?.unread && BigInt(group.id) > BigInt(previous.group?.id ?? "0")
      ? { ...group, kind: "group" as const }
      : null,
  ].filter((message) => message !== null);
  return incoming.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}
