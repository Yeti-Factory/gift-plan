import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/circles/$circleId")({
  component: CircleLayout,
});

function CircleLayout() {
  return <Outlet />;
}