import { createFileRoute } from "@tanstack/react-router";
import { MessagingPage } from "@/components/MessagingPage";
import { UUID_PATTERN } from "@/lib/self-hosted/profile-api";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    recipient:
      typeof search.recipient === "string" && UUID_PATTERN.test(search.recipient)
        ? search.recipient
        : undefined,
  }),
  component: Messages,
});
function Messages() {
  const { recipient } = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <MessagingPage userId={user.id} recipientId={recipient} />;
}
