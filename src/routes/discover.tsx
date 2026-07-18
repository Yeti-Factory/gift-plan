import { createFileRoute } from "@tanstack/react-router";

import { PeopleSearchPage } from "@/components/PeopleSearchPage";

export const Route = createFileRoute("/discover")({
  component: () => <PeopleSearchPage publicMode />,
});
