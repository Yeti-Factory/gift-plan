import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

export function PublicHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link to="/discover" aria-label="Accueil Gift-Plan">
        <BrandMark />
      </Link>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/discover">Trouver un profil</Link>
        </Button>
        <Button asChild className="rounded-full px-4 shadow-md">
          <Link to={signedIn ? "/people" : "/auth"}>
            {signedIn ? "Mon espace" : "Se connecter"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
