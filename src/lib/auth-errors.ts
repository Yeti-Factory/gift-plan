export const MIN_PASSWORD_LENGTH = 8;

export function isConfirmationEmailDeliveryError(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[_-]+/g, " ");

  return (
    normalized.includes("confirmation email") ||
    normalized.includes("email confirmation") ||
    normalized.includes("send email hook") ||
    normalized.includes("email hook") ||
    normalized.includes("error sending email") ||
    normalized.includes("failed to send email") ||
    normalized.includes("smtp")
  );
}

export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase().replace(/[_-]+/g, " ");

  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return "Email ou mot de passe incorrect.";
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  ) {
    return "Cet email est déjà utilisé.";
  }

  // Authentication providers can reject passwords found in public breach databases. This is
  // different from a password that is merely too short or too easy to guess.
  if (
    normalized.includes("pwned") ||
    (normalized.includes("password") && normalized.includes("known"))
  ) {
    return "Ce mot de passe apparaît dans des fuites de données connues. Choisis-en un autre.";
  }

  if (
    normalized.includes("password") &&
    (normalized.includes("weak") || normalized.includes("easy to guess"))
  ) {
    return "Mot de passe trop faible. Ajoute des lettres, chiffres et symboles.";
  }

  if (
    normalized.includes("password") &&
    (normalized.includes("should be at least") ||
      normalized.includes("too short") ||
      normalized.includes("minimum") ||
      normalized.includes("characters long"))
  ) {
    return `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`;
  }

  if (normalized.includes("email not confirmed") || normalized.includes("email not verified")) {
    return "Confirme d'abord ton adresse email (vérifie ta boîte mail).";
  }

  if (isConfirmationEmailDeliveryError(message)) {
    return "L’email de confirmation n’a pas pu être envoyé. Réessaie dans quelques instants.";
  }

  return message;
}
