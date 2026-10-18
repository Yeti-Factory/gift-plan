import { createFileRoute } from "@tanstack/react-router";
import { GroupMessagingPage } from "@/components/GroupMessagingPage";
export const Route = createFileRoute("/_authenticated/group-messages/$groupId")({
  component: GroupMessages,
});
function GroupMessages() {
  const { groupId } = Route.useParams();
  const { user } = Route.useRouteContext();
  return <GroupMessagingPage conversationId={groupId} userId={user.id} />;
}
