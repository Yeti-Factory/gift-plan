import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { apiQuery } from "@/lib/self-hosted/api-client";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Gift-Plan — Listes de cadeaux partagées" },
      {
        name: "description",
        content:
          "Créez et partagez vos listes de cadeaux avec vos proches. Réservez sans gâcher la surprise.",
      },
      { name: "theme-color", content: "#ef5a6f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Gift-Plan" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Gift-Plan — Listes de cadeaux partagées" },
      {
        property: "og:description",
        content:
          "Créez et partagez vos listes de cadeaux avec vos proches. Réservez sans gâcher la surprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gift-Plan — Listes de cadeaux partagées" },
      {
        name: "twitter:description",
        content:
          "Créez et partagez vos listes de cadeaux avec vos proches. Réservez sans gâcher la surprise.",
      },
      {
        property: "og:image",
        content: "/icon-512.png",
      },
      {
        name: "twitter:image",
        content: "/icon-512.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [appStatus, setAppStatus] = useState<{
    maintenance: boolean;
    message: string;
    is_superadmin: boolean;
  } | null>(null);

  const loadAppStatus = useCallback(async () => {
    const data = await apiQuery<unknown>("status").catch(() => null);
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const status = data as Record<string, unknown>;
    setAppStatus({
      maintenance: status.maintenance === true,
      message:
        typeof status.message === "string"
          ? status.message
          : "Gift-Plan revient dans quelques instants.",
      is_superadmin: status.is_superadmin === true,
    });
  }, []);

  useEffect(() => {
    loadAppStatus();
    const interval = window.setInterval(loadAppStatus, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadAppStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadAppStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!import.meta.env.PROD) return;
    if (window.top !== window.self) return; // iframe preview
    if (new URL(window.location.href).searchParams.get("sw") === "off") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => {
            if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
          });
        })
        .catch(() => undefined);
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  const authAllowedDuringMaintenance =
    pathname === "/auth" || pathname === "/reset-password" || pathname.startsWith("/legal/");

  if (appStatus?.maintenance && !appStatus.is_superadmin && !authAllowedDuringMaintenance) {
    return <MaintenanceScreen message={appStatus.message} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <InstallPrompt />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
