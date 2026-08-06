const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export type StandardWebhookErrorCode =
  | "missing_headers"
  | "invalid_timestamp"
  | "stale_timestamp"
  | "invalid_secret"
  | "invalid_signature"
  | "invalid_payload";

export class StandardWebhookError extends Error {
  constructor(public readonly code: StandardWebhookErrorCode) {
    super(code);
    this.name = "StandardWebhookError";
  }
}

function decodeBase64(value: string, errorCode: StandardWebhookErrorCode): Uint8Array<ArrayBuffer> {
  try {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new StandardWebhookError(errorCode);
  }
}

function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const encoded = secret
    .trim()
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
  if (!encoded) throw new StandardWebhookError("invalid_secret");
  return decodeBase64(encoded, "invalid_secret");
}

function signatureCandidates(header: string): Uint8Array<ArrayBuffer>[] {
  const candidates = header
    .trim()
    .split(/\s+/)
    .map((value) => value.split(",", 2))
    .filter(([version, signature]) => version === "v1" && Boolean(signature))
    .map(([, signature]) => decodeBase64(signature, "invalid_signature"));

  if (candidates.length === 0) throw new StandardWebhookError("invalid_signature");
  return candidates;
}

export async function verifyStandardWebhookRequest(
  request: Request,
  secret: string,
  now = Date.now(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): Promise<{ messageId: string; payload: unknown }> {
  const messageId = request.headers.get("webhook-id");
  const timestampHeader = request.headers.get("webhook-timestamp");
  const signatureHeader = request.headers.get("webhook-signature");

  if (!messageId || !timestampHeader || !signatureHeader) {
    throw new StandardWebhookError("missing_headers");
  }

  if (!/^\d+$/.test(timestampHeader)) {
    throw new StandardWebhookError("invalid_timestamp");
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp)) {
    throw new StandardWebhookError("invalid_timestamp");
  }

  const nowSeconds = Math.floor(now / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new StandardWebhookError("stale_timestamp");
  }

  const body = await request.text();
  const signedContent = new TextEncoder().encode(`${messageId}.${timestampHeader}.${body}`);
  const key = await crypto.subtle.importKey(
    "raw",
    decodeSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  let verified = false;
  for (const signature of signatureCandidates(signatureHeader)) {
    if (await crypto.subtle.verify("HMAC", key, signature, signedContent)) {
      verified = true;
      break;
    }
  }

  if (!verified) throw new StandardWebhookError("invalid_signature");

  try {
    return { messageId, payload: JSON.parse(body) as unknown };
  } catch {
    throw new StandardWebhookError("invalid_payload");
  }
}
