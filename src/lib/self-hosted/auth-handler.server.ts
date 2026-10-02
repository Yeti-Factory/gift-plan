import { getAuth } from "./auth.server";
import { getSelfHostedReadiness } from "./config";

export async function handleAuthRequest(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/$/, "");
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
