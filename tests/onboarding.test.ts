import { describe, expect, it } from "vitest";

import { shouldShowOnboarding, ONBOARDING_VERSION } from "../src/components/OnboardingGuide";

describe("shouldShowOnboarding (version-first policy)", () => {
  it("shows the guide to a brand-new user", () => {
    expect(
      shouldShowOnboarding({ onboarding_completed_at: null, onboarding_version: 0 }),
    ).toBe(true);
  });

  it("hides the guide once the stored version matches the current one", () => {
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: ONBOARDING_VERSION,
      }),
    ).toBe(false);
  });

  it("hides the guide when skipped at the current version", () => {
    // "Passer le guide" bumps the version — the user has explicitly declined it.
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: null,
        onboarding_version: ONBOARDING_VERSION,
      }),
    ).toBe(false);
  });

  it("re-shows the guide when a NEW major version ships (v1 → v2)", () => {
    // Simulates a future ONBOARDING_VERSION bump: a user who finished v1 must
    // see the newer guide. This is the whole point of storing the version.
    const previouslyCompletedV1 = {
      onboarding_completed_at: new Date().toISOString(),
      onboarding_version: ONBOARDING_VERSION - 1,
    };
    expect(shouldShowOnboarding(previouslyCompletedV1)).toBe(true);
  });

  it("re-shows the guide for legacy users with a null version", () => {
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: null,
        onboarding_version: null,
      }),
    ).toBe(true);
  });
});
