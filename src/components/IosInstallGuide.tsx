import { Compass, Share, SquarePlus, House, Copy } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IOS_INSTALL_STEPS } from "@/lib/installation-guide";

const icons = [Compass, Share, SquarePlus, House];

export function IosInstallGuide() {
  const linkId = useId();
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite`);
      toast.success("Lien copié. Ouvrez Safari et collez-le dans la barre d’adresse.");
    } catch {
      toast.error("Copie indisponible : sélectionnez le lien affiché et copiez-le.");
    }
  }
  return (
    <div className="space-y-4 text-sm">
      <ol className="space-y-4">
        {IOS_INSTALL_STEPS.map((step, index) => {
          const Icon = icons[index];
          return (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <Icon aria-hidden="true" className="mr-1.5 inline h-4 w-4 text-primary" />
                  {step.title}
                </p>
                <p className="mt-1 text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="rounded-xl border bg-muted/40 p-3">
        <label htmlFor={linkId} className="mb-2 block font-medium">
          Lien à ouvrir dans Safari
        </label>
        <input
          id={linkId}
          readOnly
          value={
            typeof window === "undefined"
              ? "https://gift-plan.yeti-lab.fr/invite"
              : `${window.location.origin}/invite`
          }
          onFocus={(event) => event.currentTarget.select()}
          className="mb-2 w-full rounded-lg border bg-background p-2 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          onClick={() => void copyLink()}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          Copier le lien pour Safari
        </Button>
      </div>
      <details className="rounded-xl border p-3 text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Je ne trouve pas Sur l’écran d’accueil
        </summary>
        <p className="mt-2">
          Dans Safari, ouvrez Partager, descendez tout en bas et choisissez Modifier les actions
          pour ajouter Sur l’écran d’accueil. Revenez ensuite au menu de partage.
        </p>
      </details>
      <p className="text-muted-foreground">
        Aucun passage par l’App Store. Après l’installation, ouvrez la nouvelle icône Gift-Plan pour
        créer votre compte ou vous connecter.
      </p>
    </div>
  );
}
