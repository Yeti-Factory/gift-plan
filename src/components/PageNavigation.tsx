import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, House } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";

export function PageNavigation() {
  const pathname = useLocation({ select: (location) => location.pathname });
  if (pathname === "/") return null;
  return (
    <nav
      aria-label="Navigation de la page"
      className="sticky top-0 z-50 h-14 border-b bg-background/95 px-2 backdrop-blur-xl sm:px-4"
    >
      <div className="mx-auto grid h-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1">
        <div className="justify-self-start">
          <BackButton fallback={pathname === "/reset-password" ? "/auth" : "/"} />
        </div>
        <Button asChild variant="ghost" className="h-11 px-2 text-xs sm:px-3 sm:text-sm">
          <Link
            to="/mode-emploi"
            aria-label="Mode d’emploi"
            aria-current={pathname === "/mode-emploi" ? "page" : undefined}
          >
            <BookOpen className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            Mode d’emploi
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-11 justify-self-end px-2 sm:px-3">
          <Link to="/" aria-label="Accueil">
            <House className="h-4 w-4" aria-hidden="true" />
            Accueil
          </Link>
        </Button>
      </div>
    </nav>
  );
}
