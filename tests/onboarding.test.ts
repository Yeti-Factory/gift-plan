import { describe, expect, it } from "vitest";

import { shouldShowOnboarding, ONBOARDING_VERSION } from "../src/components/OnboardingGuide";

describe("shouldShowOnboarding", () => {
  it("shows the guide to a brand-new user", () => {
    expect(
      shouldShowOnboarding({ onboarding_completed_at: null, onboarding_version: 0 }),
    ).toBe(true);
  });

  it("hides the guide once the user has completed it", () => {
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: ONBOARDING_VERSION,
      }),
    ).toBe(false);
  });

  it("hides the guide when the user has skipped it (completed_at set)", () => {
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 0,
      }),
    ).toBe(false);
  });

  it("hides the guide when the stored version already matches the current one", () => {
    expect(
      shouldShowOnboarding({
        onboarding_completed_at: null,
        onboarding_version: ONBOARDING_VERSION,
      }),
    ).toBe(false);
  });
});