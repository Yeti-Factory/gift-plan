import { ArrowRight, Sparkles, Wrench } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function MaintenanceScreen({ message }: { message: string }) {
  async function openAdminLogin() {
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <main className="gp-mesh relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="gp-dots absolute inset-0 opacity-60" />
      <div className="absolute left-[8%] top-[12%] h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute bottom-[10%] right-[8%] h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
      <section className="gp-glass gp-fade-up relative z-10 w-full max-w-xl rounded-[2rem] p-7 text-center sm:p-12">
        <BrandMark className="justify-center" />
        <div className="mx-auto mt-9 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-secondary text-primary shadow-inner">
          <Wrench className="h-9 w-9" />
          <Sparkles className="-mr-3 -mt-10 h-5 w-5" />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Petite pause enchantée
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
          On prépare quelque chose de beau.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          {message}
        </p>
        <Button variant="ghost" className="mt-8 rounded-full" onClick={openAdminLogin}>
          Accès concepteur <ArrowRight className="h-4 w-4" />
        </Button>
      </section>
    </main>
  );
}
