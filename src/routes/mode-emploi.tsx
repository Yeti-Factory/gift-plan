import { createFileRoute } from "@tanstack/react-router";
import { UserGuidePage } from "@/components/UserGuidePage";
export const Route = createFileRoute("/mode-emploi")({
  head: () => ({
    meta: [
      { title: "Mode d’emploi — Gift-Plan" },
      {
        name: "description",
        content:
          "Guide détaillé Gift-Plan : installation, profils, listes, cercles, réservations et messagerie privée ou en groupe.",
      },
    ],
  }),
  component: UserGuidePage,
});
