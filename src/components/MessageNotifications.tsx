import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiQuery } from "@/lib/self-hosted/api-client";
import {
  MESSAGES_CHANGED_EVENT,
  newReceivedMessage,
  type MessageNotificationsSnapshot,
} from "@/lib/message-notifications";

export function MessageNotifications({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true,
      loading = false,
      refreshRequested = false;
    let previous: MessageNotificationsSnapshot | null = null;
    const toastId = `gp-new-message-${userId}`;
    setUnread(0);
    const refresh = async () => {
      if (!active || document.hidden) return;
      if (loading) {
        refreshRequested = true;
        return;
      }
      loading = true;
      try {
        const next = await apiQuery<MessageNotificationsSnapshot>("message-notifications");
        if (!active) return;
        setUnread(next.unread);
        const incoming = previous && newReceivedMessage(previous, next);
        previous = {
          ...next,
          direct:
            !previous?.direct ||
            (next.direct && BigInt(next.direct.id) > BigInt(previous.direct.id))
              ? next.direct
              : previous.direct,
          group:
            !previous?.group || (next.group && BigInt(next.group.id) > BigInt(previous.group.id))
              ? next.group
              : previous.group,
        };
        if (!next.unread) toast.dismiss(toastId);
        else if (incoming)
          toast.message("Nouveau message reçu", {
            id: toastId,
            description: "Un nouveau message vous attend dans Messages.",
            duration: 8000,
            action: {
              label: "Ouvrir",
              onClick: () => {
                if (incoming.kind === "group")
                  void navigate({
                    to: "/group-messages/$groupId",
                    params: { groupId: incoming.groupId },
                  });
                else
                  void navigate({ to: "/messages", search: { recipient: incoming.recipientId } });
              },
            },
          });
      } catch {
        // Keep the last known count during temporary network failures.
      } finally {
        loading = false;
        if (refreshRequested && active) {
          refreshRequested = false;
          void refresh();
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(MESSAGES_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh);
      toast.dismiss(toastId);
    };
  }, [userId, navigate]);
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={unread ? "relative bg-red-50 text-red-700" : "relative"}
    >
      <Link
        to="/messages"
        search={{ recipient: undefined }}
        aria-label={`Messages${unread ? `, ${unread} non lus` : ""}`}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-background"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
