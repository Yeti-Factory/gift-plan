import { isBirthday } from "../birthday";
import { getAuth } from "./auth.server";
import { getSelfHostedReadiness } from "./config";

export async function handleAuthRequest(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/$/, "");
  if (request.method === "POST" && pathname === "/api/auth/sign-up/email") {
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as { birthday?: unknown } | null;
    if (!isBirthday(body?.birthday))
      return Response.json(
        {
          code: "INVALID_BIRTHDAY",
          message: "Renseignez un jour et un mois d’anniversaire valides.",
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
  }
  const sendsEmail =
    pathname === "/api/auth/request-password-reset" ||
    pathname === "/api/auth/send-verification-email";
  // Report a global configuration outage before any account lookup. The response is
  // identical for every address, so it cannot disclose whether an account exists.
  if (request.method === "POST" && sendsEmail && !getSelfHostedReadiness().checks.email) {
    return Response.json(
      { code: "EMAIL_UNAVAILABLE", message: "Le service email est temporairement indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return getAuth().handler(request);
}
