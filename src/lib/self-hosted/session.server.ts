import { getAuth } from "./auth.server";
import { ApiError } from "./http.server";

export async function getSession(headers: Headers) {
  return getAuth().api.getSession({ headers });
}

export async function getOptionalUserId(headers: Headers) {
  const session = await getSession(headers);
  return session?.user.id ?? null;
}

export async function requireUserId(headers: Headers) {
  const userId = await getOptionalUserId(headers);
  if (!userId) throw new ApiError(401, "AUTH_REQUIRED");
  return userId;
}
