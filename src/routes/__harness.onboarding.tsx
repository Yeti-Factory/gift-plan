// Temporary DEV-only harness to capture the onboarding dialog in real styles.
// Not registered on production: the loader throws notFound() unless import.meta.env.DEV.
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { OnboardingGuide, openOnboardingGuide } from "@/components/OnboardingGuide";

export const Route = createFileRoute("/__harness/onboarding")({
  ssr: false,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: HarnessOnboarding,
});

function HarnessOnboarding() {
  useEffect(() => {
    // Trigger the guide in "manual reopen" mode so no Supabase profile row is
    // required to auto-open. A tiny delay ensures the event listener is bound.
    const t = setTimeout(() => openOnboardingGuide(), 50);
    return () => clearTimeout(t);
  }, []);

  const fakeUser = { id: "harness-user", email: "harness@test.local" } as unknown as User;
  return (
    <div className="min-h-screen bg-background p-6">
      <p className="text-sm text-muted-foreground">Onboarding harness (DEV only)</p>
      <OnboardingGuide user={fakeUser} />
    </div>
  );
}