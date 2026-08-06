import { describe, expect, it } from "vitest";

import { isConfirmationEmailDeliveryError, translateAuthError } from "@/lib/auth-errors";

describe("auth error messages", () => {
  it("does not describe a weak password as a short password", () => {
    expect(translateAuthError("Password is too weak and easy to guess")).toBe(
      "Mot de passe trop faible. Ajoute des lettres, chiffres et symboles.",
    );
  });

  it("explains when a password is known from a data breach", () => {
    expect(translateAuthError("Password is known to be pwned")).toBe(
      "Ce mot de passe apparaît dans des fuites de données connues. Choisis-en un autre.",
    );
  });

  it("keeps the minimum-length message for actual length errors", () => {
    expect(translateAuthError("Password should be at least 8 characters long")).toBe(
      "Mot de passe trop court (8 caractères minimum).",
    );
  });

  it("recognizes confirmation email delivery failures", () => {
    expect(isConfirmationEmailDeliveryError("Error sending confirmation email")).toBe(true);
    expect(isConfirmationEmailDeliveryError("Send email hook returned an error")).toBe(true);
    expect(isConfirmationEmailDeliveryError("Invalid login credentials")).toBe(false);
  });

  it("translates Better Auth error codes", () => {
    expect(translateAuthError("INVALID_EMAIL_OR_PASSWORD")).toBe(
      "Email ou mot de passe incorrect.",
    );
    expect(translateAuthError("EMAIL_NOT_VERIFIED")).toContain("Confirme");
  });
});
