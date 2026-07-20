import { createFileRoute } from "@tanstack/react-router";

import { ProfileDirectoryPage } from "@/components/ProfileDirectoryPage";

export const Route = createFileRoute("/_authenticated/people")({
  component: ProfileDirectoryPage,
});
