import { Link, useLocation } from "@tanstack/react-router";
import { House } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";

export function PageNavigation() {
  const pathname = useLocation({ select: (location) => location.pathname });
  if (pathname === "/") return null;
  return (
    <nav
      aria-label="Navigation de la page"
      className="sticky top-0 z-50 h-14 border-b bg-background/95 px-4 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3">
        <BackButton fallback={pathname === "/reset-password" ? "/auth" : "/"} />
        <Button asChild variant="ghost" className="h-11 px-3">
          <Link to="/" aria-label="Accueil">
            <House className="h-4 w-4" aria-hidden="true" />
            Accueil
          </Link>
        </Button>
      </div>
    </nav>
  );
}
