export const PASSWORD_RECOVERY_FLAG = "gift-plan-password-recovery";

export function hasPasswordRecoveryMarker(url: URL = new URL(window.location.href)) {
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const isResetPasswordRoute = url.pathname === "/reset-password";
  return (
    url.searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    url.searchParams.has("token_hash") ||
    (isResetPasswordRoute && url.searchParams.has("code")) ||
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
  return window.sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === "1" || hasPasswordRecoveryMarker();
}

export function redirectToResetPasswordIfNeeded() {
  if (typeof window === "undefined") return false;
  if (!isPasswordRecoveryInProgress()) return false;

  markPasswordRecovery();
  if (window.location.pathname !== "/reset-password") {
    window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
    return true;
  }

  return false;
}