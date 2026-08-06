import { getSelfHostedConfig } from "./config";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "PROFILE_PRIVATE"
  | "ALREADY_RESERVED"
  | "CONFLICT"
  | "NOT_ADMIN"
  | "NOT_MEMBER"
  | "FORBIDDEN_CREATOR"
  | "RATE_LIMITED"
  | "CODE_INVALID"
  | "BANNED";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function assertSameOrigin(request: Request, expectedOrigin = getSelfHostedConfig().appUrl) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin) {
    throw new ApiError(403, "FORBIDDEN", "Cross-origin mutation rejected");
  }
}

export async function readJsonObject(request: Request, maxBytes = 16_384) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new ApiError(413, "INVALID_REQUEST");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  return body as Record<string, unknown>;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export function noStoreJson(value: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return Response.json(value, { ...init, headers });
}
