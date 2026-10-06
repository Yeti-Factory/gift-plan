import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

function detectDesktopBrowser(): "chrome" | "edge" | "firefox" | "safari" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
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
  const [desktopFallback, setDesktopFallback] = useState<
    null | "chrome" | "edge" | "firefox" | "safari" | "other"
  >(null);
  const [showDesktopSheet, setShowDesktopSheet] = useState(false);
  const [android, setAndroid] = useState(false);
  const promptEvent = useRef<BIPEvent | null>(null);

  const install = useCallback(async () => {
    const event = promptEvent.current;
    if (!event) return;
    promptEvent.current = null;
    setDeferred(null);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
    } catch {
      setDesktopFallback(detectDesktopBrowser());
      setShowDesktopSheet(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReady(true);

    let installed = isStandalone();
    const automaticallyVisible = !installed && !recentlyDismissed();

    const iosDetected = isIOS();
    setIos(iosDetected);
    setAndroid(/Android/i.test(navigator.userAgent));
    if (iosDetected && automaticallyVisible) setVisible(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      promptEvent.current = e as BIPEvent;
      setDeferred(e as BIPEvent);
      if (automaticallyVisible && !recentlyDismissed()) setVisible(true);
      setDesktopFallback(null);
    };
    const onInstalled = () => {
      installed = true;
      setVisible(false);
      setDeferred(null);
      promptEvent.current = null;
      setShowIosSheet(false);
      setShowDesktopSheet(false);
    };
    const onRequest = () => {
      if (installed || isStandalone()) {
        toast.info("Gift-Plan est déjà ouvert comme une appli.");
      } else if (iosDetected) {
        setShowIosSheet(true);
      } else if (promptEvent.current) {
        void install();
      } else {
        setDesktopFallback(detectDesktopBrowser());
        setShowDesktopSheet(true);
      }
    };
    window.addEventListener("gp-install-requested", onRequest);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // Fallback : si beforeinstallprompt ne se déclenche pas (déjà éligible mais
    // événement déjà consommé, ou navigateur qui ne le supporte pas), afficher
    // un bandeau avec les instructions manuelles selon le navigateur.
    const timer = window.setTimeout(() => {
      if (iosDetected || installed || isStandalone() || recentlyDismissed()) return;
      setDesktopFallback((prev) => prev ?? detectDesktopBrowser());
      setVisible(true);
    }, 9000);

    return () => {
      window.removeEventListener("gp-install-requested", onRequest);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, [install]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!ready) return null;

  const showDesktopManual = !ios && !deferred && desktopFallback !== null;

  return (
    <>
      {visible && (
        <div className="fixed bottom-24 left-3 right-3 z-50 pb-[env(safe-area-inset-bottom)] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[22rem]">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/80 bg-card/90 p-2.5 shadow-lg backdrop-blur-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight">Garder Gift-Plan sous la main</p>
              <p className="text-xs text-muted-foreground">
                {ios
                  ? "Ajoutez l'appli à votre écran d'accueil."
                  : showDesktopManual
                    ? "Ajoutez l'appli à votre bureau."
                    : "Accès rapide depuis votre écran d'accueil."}
              </p>
            </div>
            {ios ? (
              <Button size="sm" onClick={() => setShowIosSheet(true)}>
                Voir
              </Button>
            ) : showDesktopManual ? (
              <Button size="sm" onClick={() => setShowDesktopSheet(true)}>
                Comment ?
              </Button>
            ) : (
              <Button size="sm" onClick={install} disabled={!deferred}>
                Installer
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Fermer"
              onClick={dismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
                Touchez <Share className="inline h-4 w-4" /> <strong>Partager</strong> dans la barre
                d'outils.
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

      <Sheet open={showDesktopSheet} onOpenChange={setShowDesktopSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>
              {android ? "Installer sur Android" : "Installer sur ordinateur"}
            </SheetTitle>
            <SheetDescription>
              {desktopFallback === "firefox"
                ? "Si l’option d’installation n’apparaît pas, ouvrez ce lien dans Chrome ou Edge."
                : desktopFallback === "safari"
                  ? "Depuis Safari, ouvrez Fichier > Ajouter au Dock pour installer Gift-Plan."
                  : "Suivez ces étapes dans votre navigateur :"}
            </SheetDescription>
          </SheetHeader>
          {android && (
            <p className="mt-4 text-sm">
              Dans Chrome, ouvrez le menu ⋮, puis choisissez « Ajouter à l’écran d’accueil » ou «
              Installer l’application » et confirmez.
            </p>
          )}
          {!android &&
            (desktopFallback === "chrome" ||
              desktopFallback === "edge" ||
              desktopFallback === "other") && (
              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    1
                  </span>
                  <span>
                    Cherchez l'icône <Download className="inline h-4 w-4" />{" "}
                    <strong>Installer</strong> à droite de la barre d'adresse.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Ou ouvrez le menu <strong>⋮</strong> puis <strong>Installer Gift-Plan…</strong>{" "}
                    (Chrome) / <strong>Applications → Installer ce site</strong> (Edge).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Confirmez avec <strong>Installer</strong>. L'appli s'ouvrira dans sa propre
                    fenêtre.
                  </span>
                </li>
              </ol>
            )}
          <p className="mt-4 text-xs text-muted-foreground">
            Si vous ne voyez pas l'option, rechargez la page ou vérifiez que vous êtes bien en
            HTTPS.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default InstallPrompt;
