import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Gift, Users } from "lucide-react";

import { PublicHeader } from "@/components/PublicHeader";
import { PoweredByYetiLab } from "@/components/PoweredByYetiLab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Vous êtes invité sur Gift-Plan" },
      {
        name: "description",
        content:
          "Rejoignez vos proches sur Gift-Plan : installez l’appli et partagez vos envies de cadeaux.",
      },
    ],
  }),
  component: AppInvitationPage,
});

function AppInvitationPage() {
  return (
    <div className="gp-mesh min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:py-12">
        <div className="text-center">
          <Gift className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="font-display text-4xl font-bold">Vous êtes invité sur Gift-Plan</h1>
          <p className="mt-3 text-muted-foreground">
            Partagez vos envies de cadeaux avec vos proches et gardez la surprise intacte.
          </p>
        </div>
        <Card className="space-y-4 rounded-2xl p-6">
          <h2 className="text-xl font-bold">1. Accédez à votre compte</h2>
          <p className="text-sm text-muted-foreground">
            Première visite ? Créez votre compte, puis confirmez votre adresse avec le mail reçu. Si
            vous avez déjà un compte, connectez-vous simplement.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Créer mon compte
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth" search={{}}>
                J’ai déjà un compte
              </Link>
            </Button>
          </div>
        </Card>
        <Card className="space-y-4 rounded-2xl p-6">
          <h2 className="text-xl font-bold">2. Gardez l’appli sous la main</h2>
          <p className="text-sm text-muted-foreground">
            Ajoutez Gift-Plan à votre écran d’accueil pour le retrouver facilement. L’installation
            est facultative : vous pouvez aussi utiliser votre navigateur.
          </p>
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new Event("gp-install-requested"))}
          >
            <Download className="h-4 w-4" /> Installer Gift-Plan
          </Button>
          <p className="text-xs text-muted-foreground">
            Si ce lien s’ouvre dans une messagerie, ouvrez-le dans Safari sur iPhone, ou dans Chrome
            sur Android pour installer l’appli.
          </p>
        </Card>
        <Card className="space-y-3 rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-5 w-5 text-primary" /> 3. Retrouvez vos proches
          </h2>
          <p className="text-sm text-muted-foreground">
            Une fois connecté, ouvrez « Cercles », puis « Rejoindre » avec le code transmis par
            votre proche. Vous pourrez alors consulter les listes partagées dans ce cercle.
          </p>
        </Card>
        <PoweredByYetiLab />
      </main>
    </div>
  );
}
