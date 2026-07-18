export const PASSWORD_RECOVERY_FLAG = "gift-plan-password-recovery";
const PASSWORD_RESET_ORIGIN = "https://gift-plan.yeti-lab.fr";

export function hasPasswordRecoveryMarker(url: URL = new URL(window.location.href)) {
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const canReceiveRecoveryCode = url.pathname === "/reset-password" || url.pathname === "/auth";
  return (
    url.searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    url.searchParams.has("token_hash") ||
    (canReceiveRecoveryCode && url.searchParams.has("code")) ||
    hashParams.has("access_token")
  );
}

export function markPasswordRecovery() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, "1");
}

export function clearPasswordRecoveryMark() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
}

export function isPasswordRecoveryInProgress() {
  if (typeof window === "undefined") return false;
  return (
    window.sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === "1" || hasPasswordRecoveryMarker()
  );
}

export function redirectToResetPasswordIfNeeded() {
  if (typeof window === "undefined") return false;
  if (!isPasswordRecoveryInProgress()) return false;

  markPasswordRecovery();
  if (window.location.pathname !== "/reset-password") {
    const targetOrigin =
      window.location.origin === PASSWORD_RESET_ORIGIN ? "" : PASSWORD_RESET_ORIGIN;
    window.location.replace(
      `${targetOrigin}/reset-password${window.location.search}${window.location.hash}`,
    );
    return true;
  }

  return false;
}
