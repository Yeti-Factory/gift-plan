import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/90 backdrop-blur px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gift className="h-4 w-4" />
          </div>
          Gift-Plan
        </Link>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <BackButton fallback="/" />
          <article className="mt-4 space-y-4 prose prose-sm max-w-none dark:prose-invert">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">Dernière mise à jour : {updated}</p>
            {children}
          </article>

          <nav className="mt-10 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
            <Link to="/legal/mentions-legales" className="hover:text-primary">Mentions légales</Link>
            <Link to="/legal/confidentialite" className="hover:text-primary">Confidentialité</Link>
            <Link to="/legal/cgu" className="hover:text-primary">CGU</Link>
          </nav>
        </div>
      </main>
    </div>
  );
}