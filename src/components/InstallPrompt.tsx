import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const DISMISS_KEY = "gp-install-dismissed-at";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSClassic = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se présente comme Mac ; détecter via touch
  const iPadOS =
    ua.includes("Macintosh") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return iOSClassic || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean })
    .standalone;
  return Boolean(mm || iosStandalone);
}

function recentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReady(true);

    if (isStandalone() || recentlyDismissed()) return;

    const iosDetected = isIOS();
    setIos(iosDetected);

    if (iosDetected) {
      setVisible(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
    }
  };

  if (!ready || !visible) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto mb-3 flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur mx-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              Installer Gift-Plan
            </p>
            <p className="text-xs text-muted-foreground">
              {ios
                ? "Ajoutez l'appli à votre écran d'accueil."
                : "Accès rapide depuis votre écran d'accueil."}
            </p>
          </div>
          {ios ? (
            <Button size="sm" onClick={() => setShowIosSheet(true)}>
              Voir
            </Button>
          ) : (
            <Button size="sm" onClick={install} disabled={!deferred}>
              Installer
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fermer"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={showIosSheet} onOpenChange={setShowIosSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Installer sur iPhone / iPad</SheetTitle>
            <SheetDescription>
              Depuis <strong>Safari</strong>, suivez ces étapes :
            </SheetDescription>
          </SheetHeader>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <span className="flex items-center gap-2">
                Touchez <Share className="inline h-4 w-4" />{" "}
                <strong>Partager</strong> dans la barre d'outils.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <span className="flex items-center gap-2">
                Choisissez <Plus className="inline h-4 w-4" />{" "}
                <strong>Sur l'écran d'accueil</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </span>
              <span>
                Validez avec <strong>Ajouter</strong> en haut à droite.
              </span>
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            L'appli s'ouvrira ensuite en plein écran depuis votre écran d'accueil.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default InstallPrompt;