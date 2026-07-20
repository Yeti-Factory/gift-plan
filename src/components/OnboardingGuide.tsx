import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { Gift, Users, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const ONBOARDING_VERSION = 1;
const OPEN_EVENT = "gp:open-onboarding";

/** Fire from anywhere (e.g. the account page) to reopen the guide manually. */
export function openOnboardingGuide() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

type Step = {
  key: string;
  title: string;
  description: string;
  bullets?: string[];
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "Bienvenue dans Gift-Plan 🎁",
    description:
      "Gift-Plan vous permet de partager des idées de cadeaux avec votre famille ou vos amis, tout en préservant l'effet de surprise.",
    icon: <Gift className="h-6 w-6" />,
  },
  {
    key: "circles",
    title: "Réunissez vos proches",
    description:
      "Un cercle est un espace privé réservé à un groupe de proches. Vous pouvez créer votre propre cercle ou en rejoindre un grâce à un code d'invitation.",
    bullets: [
      "Seuls les membres du cercle peuvent voir son contenu.",
      "Un administrateur peut inviter ou retirer des membres.",
      "Un même utilisateur peut appartenir à plusieurs cercles.",
    ],
    icon: <Users className="h-6 w-6" />,
  },
  {
    key: "lists",
    title: "Ajoutez vos idées de cadeaux",
    description:
      "Créez une liste dans un cercle, puis ajoutez les cadeaux qui vous feraient plaisir. Vous pouvez renseigner un titre, un lien, une image, un prix, une priorité et quelques notes.",
    bullets: [
      "Vous pouvez modifier ou supprimer vos propres listes et cadeaux tant que vous appartenez au cercle.",
    ],
    icon: <ListChecks className="h-6 w-6" />,
  },
  {
    key: "reservations",
    title: "Organisez les cadeaux sans gâcher la surprise",
    description:
      "Les autres membres peuvent réserver un cadeau pour indiquer qu'ils souhaitent l'offrir. Le propriétaire du cadeau ne voit pas qui l'a réservé.",
    bullets: [
      "L'identité de la personne qui a réservé n'est jamais montrée au propriétaire.",
      "Les autres membres voient qu'un cadeau est déjà réservé pour éviter les doublons.",
      "Une réservation peut être annulée par la personne qui l'a créée.",
    ],
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    key: "ready",
    title: "À vous de jouer !",
    description:
      "Créez votre premier cercle ou rejoignez celui de vos proches avec un code d'invitation.",
    icon: <Sparkles className="h-6 w-6" />,
  },
];

const TECHNICAL_ROUTES = ["/auth", "/reset-password", "/auth/callback"];

function isTechnicalRoute(pathname: string) {
  return TECHNICAL_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * Determine whether a user should see the onboarding guide automatically.
 * Exported for unit tests.
 */
export function shouldShowOnboarding(profile: {
  onboarding_completed_at: string | null;
  onboarding_version: number | null;
}) {
  // Version-first: a completed guide from v1 must still surface when v2 ships.
  // "Passer" and "Terminer" both persist the current version, so once a user
  // has seen the current version they won't see it again automatically.
  return (profile.onboarding_version ?? 0) < ONBOARDING_VERSION;
}

export function OnboardingGuide({ user }: { user: User }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  // Track how the guide was opened. Manual reopens (from the account page)
  // must not overwrite `onboarding_completed_at`; auto-opens must persist it
  // on any exit (Skip, Finish, close via X/Esc/outside click).
  const manualRef = useRef(false);

  // Auto-open once per user based on profile state.
  useEffect(() => {
    let cancelled = false;
    if (isTechnicalRoute(pathname)) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at, onboarding_version")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      if (shouldShowOnboarding(data)) {
        manualRef.current = false;
        setStep(0);
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, pathname]);

  // Allow manual reopening from anywhere in the app.
  useEffect(() => {
    const onOpen = () => {
      manualRef.current = true;
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const persist = useCallback(
    async ({ markCompleted }: { markCompleted: boolean }) => {
      setSaving(true);
      const payload: {
        onboarding_version: number;
        onboarding_completed_at?: string;
      } = { onboarding_version: ONBOARDING_VERSION };
      if (markCompleted) payload.onboarding_completed_at = new Date().toISOString();
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      setSaving(false);
      if (error) {
        toast.error("Impossible d'enregistrer votre progression. Réessayer ?", {
          action: {
            label: "Réessayer",
            onClick: () => persist({ markCompleted }),
          },
        });
        return false;
      }
      return true;
    },
    [user.id],
  );

  async function handleSkip() {
    // Manual reopen: don't overwrite the original completion date; just bump
    // the version so a future v2 auto-open respects the user's prior choice.
    const ok = await persist({ markCompleted: !manualRef.current });
    if (ok) setOpen(false);
  }

  async function handleFinish(target?: "circles-create" | "circles-join") {
    const ok = await persist({ markCompleted: !manualRef.current });
    if (!ok) return;
    setOpen(false);
    if (target) {
      // Route search params work even when /circles is already mounted:
      // the search change re-renders the page and triggers its effect.
      const action = target === "circles-create" ? "create" : "join";
      navigate({ to: "/circles", search: { onboarding: action } });
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    // Close via X, Esc, or outside click: same contract as "Passer le guide".
    if (!manualRef.current) void persist({ markCompleted: true });
    setOpen(false);
  }

  const current = STEPS[step];
  const total = STEPS.length;
  const progress = ((step + 1) / total) * 100;
  const isLast = step === total - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg gap-0 p-0 max-h-[90dvh] overflow-y-auto">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              {current.icon}
            </div>
            <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
              Étape {step + 1} sur {total}
            </span>
          </div>
          <Progress
            value={progress}
            className="mt-3 h-1.5"
            aria-label={`Étape ${step + 1} sur ${total}`}
          />
          <DialogHeader className="mt-4 text-left space-y-2">
            <DialogTitle className="text-xl">{current.title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {current.description}
            </DialogDescription>
          </DialogHeader>
          {current.bullets && (
            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              {current.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={saving}
            className="justify-self-start"
          >
            Passer le guide
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={saving}
              >
                Précédent
              </Button>
            )}
            {!isLast && (
              <Button onClick={() => setStep((s) => Math.min(total - 1, s + 1))} disabled={saving}>
                Suivant
              </Button>
            )}
            {isLast && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleFinish("circles-join")}
                  disabled={saving}
                >
                  Rejoindre avec un code
                </Button>
                <Button onClick={() => handleFinish("circles-create")} disabled={saving}>
                  Créer un cercle
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
