import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Gift,
  MessageCircle,
  Users,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";

export const ONBOARDING_VERSION = 3;
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
    key: "important-update",
    title: "Une mise à jour importante de Gift-Plan",
    description:
      "Merci de bien étudier le nouveau mode d’emploi et d’utiliser le mode d’emploi interactif, car une mise à jour importante vient d’être faite avec de nouvelles fonctionnalités.",
    bullets: [
      "Découvrez les messages privés, les conversations de groupe pour préparer une surprise, les réglages de confidentialité et les nouveautés des cercles.",
      "Suivez ce guide avec Suivant. Vous pouvez aussi ouvrir l’assistant interactif pour poser vos questions et recevoir des explications étape par étape.",
      "Le bouton Mode d’emploi se trouve entre Retour et Accueil. Vos comptes, mots de passe, listes et cadeaux sont conservés.",
    ],
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    key: "welcome",
    title: "Bienvenue dans Gift-Plan 🎁",
    description:
      "Gift-Plan sert à partager vos envies de cadeaux avec vos proches et à organiser ce que chacun offre, sans doublons et sans gâcher la surprise.",
    bullets: [
      "Vous notez ce qui vous ferait plaisir dans vos listes.",
      "Vos proches consultent uniquement ce que vous choisissez de partager.",
      "Chacun peut réserver un cadeau pour éviter que deux personnes l’achètent. Gift-Plan n’effectue aucun achat à votre place.",
    ],
    icon: <Gift className="h-6 w-6" />,
  },
  {
    key: "update",
    title: "La mise à jour : vous gardez le contrôle",
    description:
      "La visibilité de votre profil et celle de chaque liste sont désormais indépendantes.",
    bullets: [
      "Un profil public ne rend pas ses contacts ni les membres de ses cercles publics. Chacun choisit sa propre visibilité.",
      "Une liste privée est visible uniquement par son propriétaire, même si son profil est public.",
      "Les nouvelles listes sont privées par défaut. Les listes existantes conservent leur réglage : vérifiez-les dans Mes listes avec le bouton crayon.",
      "Passer une liste en privé coupe ses anciens accès partagés, y compris les liens de partage.",
    ],
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    key: "lists",
    title: "Créez une liste et choisissez son public",
    description:
      "Dans Mes listes, touchez + Liste, donnez-lui un titre puis réglez Qui peut consulter cette liste ? avant de créer la liste.",
    bullets: [
      "Privée — uniquement moi : personne d’autre ne voit son existence, son contenu ou ses photos.",
      "Un ou plusieurs cercles : seuls les membres des cercles choisis y accèdent, ainsi que les destinataires d’un lien de partage que vous créez.",
      "Publique — tout le monde : elle est consultable par les visiteurs de votre profil, même sans compte.",
      "Le crayon près du titre permet de modifier le titre et la visibilité d’une liste existante.",
    ],
    icon: <ListChecks className="h-6 w-6" />,
  },
  {
    key: "example",
    title: "Pourquoi choisir un profil public ?",
    description:
      "Un profil public avec une liste publique permet à une personne qui vous connaît peu de trouver quoi vous offrir pour votre anniversaire ou une fête, sans rejoindre vos cercles ni demander l’accès.",
    bullets: [
      "Anniversaire en Publique : vos visiteurs trouvent vos idées via votre profil ou son lien, même sans compte. Pour réserver un cadeau, ils devront se connecter.",
      "Noël en Cercles : seuls les cercles sélectionnés et vos liens de partage y donnent accès.",
      "Mes idées personnelles en Privée : vous seul savez qu’elle existe.",
      "Profil public ne signifie pas tout montrer : seules les listes que vous rendez publiques sont visibles par tous. Si toutes vos listes sont privées, les visiteurs n’ont pas d’idées à consulter.",
      "Un profil privé reste utile avec vos proches autorisés ou vos liens de partage. Autoriser votre profil ne donne pas accès à vos listes personnelles ni aux listes d’autres cercles.",
    ],
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    key: "gifts",
    title: "Ajoutez un cadeau, avec ou sans lien",
    description:
      "Dans une liste, touchez le bouton + pour ajouter un cadeau. Choisissez une catégorie, un nom, puis complétez si besoin la description, le prix, la priorité et la photo.",
    bullets: [
      "Pour un produit en ligne : collez son lien puis touchez Récupérer.",
      "Vérifiez les informations : certains sites bloquent l’import ou ne donnent pas de prix. Vous pouvez toujours les saisir vous-même.",
      "Sur Amazon, choisissez la bonne couleur et la taille si plusieurs variantes sont proposées.",
      "Changer de lien retire les anciennes valeurs importées ; vos modifications manuelles sont conservées. Pensez à enregistrer le cadeau.",
    ],
    icon: <Gift className="h-6 w-6" />,
  },
  {
    key: "circles",
    title: "Réunissez vos proches dans des cercles",
    description:
      "Un cercle est un groupe privé, par exemple Famille ou Amis. Dans Cercles, créez un groupe ou choisissez Rejoindre avec le code reçu.",
    bullets: [
      "Seuls les membres peuvent voir les membres et le contenu partagé avec ce cercle.",
      "Un administrateur peut transmettre le code, gérer les membres et renouveler un code expiré.",
      "Vous pouvez appartenir à plusieurs cercles et choisir précisément lesquels voient chaque liste.",
      "Voir les cadeaux ouvre les listes du membre auxquelles vous avez accès. Le compteur inclut ses listes publiques et celles partagées avec vos cercles, sans compter deux fois la même liste. Vos propres listes personnelles ne sont comptées que pour vous.",
      "Un cercle commun permet de consulter le profil de ses membres, mais pas leurs listes personnelles ni celles réservées à d’autres cercles.",
    ],
    icon: <Users className="h-6 w-6" />,
  },
  {
    key: "community",
    title: "Retrouvez vos proches dans Communauté",
    description:
      "Recherchez une personne par son nom, une partie de son nom ou son identifiant, puis ouvrez sa fiche pour consulter les cadeaux accessibles ou lui écrire.",
    bullets: [
      "Une fiche privée reste verrouillée jusqu’à l’autorisation de son propriétaire ou un cercle commun. Envoyez une demande d’accès si nécessaire.",
      "Le propriétaire peut accepter ou refuser les demandes. Autoriser un profil ne rend pas ses listes personnelles accessibles.",
      "L’annuaire ne dévoile pas les contacts ni les relations entre les personnes.",
      "Pour écrire, utilisez la bulle sur la fiche ou le bouton Écrire sur le profil.",
    ],
    icon: <Users className="h-6 w-6" />,
  },
  {
    key: "private-messages",
    title: "Échangez des messages privés",
    description:
      "Touchez la bulle d’une fiche dans Communauté ou Écrire sur un profil. La bulle Messages en haut de l’écran rassemble vos conversations et indique les messages non lus.",
    bullets: [
      "Avec un membre d’un cercle commun, vous pouvez échanger directement.",
      "Hors cercle commun, envoyez un premier message de présentation. Le destinataire doit accepter la demande avant toute réponse ou tout nouvel envoi. Il peut aussi la refuser.",
      "Vous pouvez bloquer une personne pour arrêter les nouveaux messages dans les deux sens. L’historique reste disponible ; débloquer permet de reprendre si aucun autre blocage ne subsiste.",
      "Signaler transmet uniquement le message reçu concerné et votre motif à l’administration. La conversation entière n’est pas transmise.",
      "Les échanges ne donnent aucun accès supplémentaire aux profils ou aux listes. Les compteurs de nouveaux messages se consultent dans l’application.",
    ],
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    key: "group-messages",
    title: "Préparez une surprise en groupe",
    description:
      "Dans un cercle, touchez Écrire au cercle, donnez un nom à la conversation puis choisissez les participants, par exemple en excluant la personne à qui vous préparez un cadeau.",
    bullets: [
      "Décochez les personnes à exclure. Vous restez inclus ; le groupe doit réunir entre 2 et 50 participants.",
      "Touchez Vérifier avant de créer, relisez Participants et Personnes exclues, puis confirmez avec Créer avec ces participants. La création n’envoie pas de premier message.",
      "Seuls les participants choisis voient le titre et les messages. Les personnes exclues ne voient pas l’échange et ne reçoivent pas de notification pour celui-ci.",
      "Retrouvez l’échange dans Messages → Groupes et surprises. Vérifiez les participants affichés avant d’envoyer un message.",
      "Les participants sont fixés à la création. Créez un autre groupe pour changer la sélection ; un nouveau membre du cercle n’est pas ajouté automatiquement.",
      "Quitter la conversation ou le cercle retire l’accès à l’historique du groupe. Revenir dans le cercle ne rétablit pas cet accès. Blocage et signalement restent disponibles.",
    ],
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    key: "reservations",
    title: "Offrez un cadeau en gardant la surprise",
    description:
      "Ouvrez la liste accessible d’un proche et réservez le cadeau que vous souhaitez offrir. Le propriétaire ne voit ni la réservation ni l’identité de la personne qui offre.",
    bullets: [
      "Les autres visiteurs autorisés voient qu’un cadeau est déjà réservé pour éviter les doublons.",
      "Dans J’offre, retrouvez vos réservations, indiquez qu’un cadeau est acheté ou annulez votre réservation.",
      "Vous ne pouvez pas réserver votre propre cadeau.",
      "Le prix importé est indicatif : vérifiez le produit, sa variante et son prix chez le vendeur avant d’acheter.",
    ],
    icon: <Gift className="h-6 w-6" />,
  },
  {
    key: "invite",
    title: "Invitez et installez l’appli facilement",
    description:
      "Inviter un proche prépare un message à copier ou partager. Le message contient le lien et le mode d’emploi d’installation iPhone et Android.",
    bullets: [
      "Pour rejoindre votre cercle, envoyez aussi son code d’invitation. Une invitation à l’application ne rejoint pas automatiquement un cercle.",
      "Sur iPhone : ouvrez le lien dans Safari, puis Partager → Sur l’écran d’accueil → Ajouter. Gardez Ouvrir comme app web activé si proposé.",
      "Si le lien est ouvert dans une messagerie, copiez-le et collez-le dans Safari. Le guide d’installation détaille chaque étape.",
      "Sur Android : ouvrez le lien dans Chrome puis le menu ⋮ et choisissez Installer l’application. L’installation reste facultative.",
    ],
    icon: <Users className="h-6 w-6" />,
  },
  {
    key: "navigation",
    title: "Retrouvez-vous et gérez votre profil",
    description:
      "Les boutons Retour, Mode d’emploi et Accueil restent en haut des pages. Les onglets du bas donnent accès à Communauté, Mes listes, J’offre, Cercles et Mon profil.",
    bullets: [
      "Dans Mon profil, choisissez si votre profil est public ou privé ; cela ne change pas les réglages de vos listes ni ceux de vos contacts.",
      "Dans Mon profil, ajoutez votre anniversaire (jour et mois) pour aider vos proches à préparer leurs cadeaux. Il est affiché aux personnes autorisées à consulter votre profil.",
      "Les photos de profil gardent leurs proportions et sont recadrées dans le cercle.",
      "Dans Mon compte, utilisez Revoir le guide de démarrage pour relire ces explications à tout moment.",
      "Ce guide est proposé à chaque nouvelle connexion, pas à chaque page. Si vous l’avez fermé, vous pouvez toujours le rouvrir depuis Mon compte.",
    ],
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    key: "interactive-help",
    title: "Posez vos questions au mode d’emploi interactif",
    description:
      "Le bouton Mode d’emploi, entre Retour et Accueil, ouvre un assistant interactif accessible à tout moment, même sans être connecté.",
    bullets: [
      "Écrivez une question ou choisissez un sujet parmi les 15 rubriques : installation, compte, profils, listes, cadeaux, cercles, réservations et messageries.",
      "Avancez avec Étape suivante ou écrivez suivant pour continuer sur le même sujet.",
      "Utilisez Voir toute l’explication pour lire les étapes et les précisions de confidentialité ensemble.",
      "Tous les sujets permet de choisir une autre rubrique. Recommencer permet de repartir du début.",
    ],
    icon: <BookOpen className="h-6 w-6" />,
  },
  {
    key: "ready",
    title: "Commencez par vérifier vos listes",
    description:
      "Ouvrez Mes listes et vérifiez la visibilité de chacune. Vos comptes, vos mots de passe et vos cadeaux sont conservés : la reconnexion sert à vous présenter la mise à jour.",
    bullets: [
      "Gardez vos idées personnelles en Privée — uniquement moi.",
      "Choisissez ensuite les listes à rendre publiques ou à partager avec vos cercles.",
      "Vous pouvez passer le guide maintenant et le retrouver dans Mon compte.",
    ],
    icon: <ListChecks className="h-6 w-6" />,
  },
];

function sessionGuideKey(userId: string, sessionId: string) {
  return `gp-guide-v${ONBOARDING_VERSION}:${userId}:${sessionId}`;
}

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
  // A completed older guide must still surface when the version changes.
  // "Passer" and "Terminer" both persist the current version, so once a user
  // has seen the current version they won't see it again automatically.
  return (profile.onboarding_version ?? 0) < ONBOARDING_VERSION;
}

export function OnboardingGuide({ user, sessionId }: { user: { id: string }; sessionId?: string }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  // Track how the guide was opened. Manual reopens (from the account page)
  // must not overwrite `onboarding_completed_at`; auto-opens must persist it
  // on any exit (Skip, Finish, close via X/Esc/outside click).
  const manualRef = useRef(false);
  const promptedSession = useRef<string | null>(null);

  // Auto-open once per authenticated session; legacy callers use profile version.
  useEffect(() => {
    let cancelled = false;
    if (isTechnicalRoute(pathname)) return;
    if (sessionId) {
      const key = sessionGuideKey(user.id, sessionId);
      if (promptedSession.current === key) return;
      try {
        if (localStorage.getItem(key)) return;
      } catch {
        /* storage is optional */
      }
      promptedSession.current = key;
      manualRef.current = false;
      setStep(0);
      setOpen(true);
      return;
    }
    (async () => {
      const data = await apiQuery<{
        onboarding_completed_at: string | null;
        onboarding_version: number | null;
      }>("session").catch(() => null);
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
  }, [user.id, sessionId, pathname]);

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
      const error = await apiAction("onboarding", {
        version: ONBOARDING_VERSION,
        markCompleted,
      }).then(
        () => null,
        (cause: unknown) => cause,
      );
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
      if (sessionId && !manualRef.current) {
        try {
          localStorage.setItem(sessionGuideKey(user.id, sessionId), "1");
        } catch {
          /* storage is optional */
        }
      }
      return true;
    },
    [user.id, sessionId],
  );

  async function handleSkip() {
    // Manual reopen: don't overwrite the original completion date; just bump
    // the version so a future auto-open respects the user's prior choice.
    const ok = await persist({ markCompleted: !manualRef.current });
    if (ok) setOpen(false);
  }

  async function handleFinish(
    target?: "circles-create" | "circles-join" | "my-lists" | "mode-emploi",
  ) {
    const ok = await persist({ markCompleted: !manualRef.current });
    if (!ok) return;
    setOpen(false);
    if (target === "mode-emploi") {
      navigate({ to: "/mode-emploi" });
      return;
    }
    if (target === "my-lists") {
      navigate({ to: "/my-lists" });
      return;
    }
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
          <Button
            variant="outline"
            className="mt-4 h-auto w-full whitespace-normal"
            onClick={() => handleFinish("mode-emploi")}
            disabled={saving}
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            Ouvrir le mode d’emploi interactif
          </Button>
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
                <Button onClick={() => handleFinish("my-lists")} disabled={saving}>
                  Aller à mes listes
                </Button>
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
