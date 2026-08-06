import { describe, expect, it } from "vitest";

import { StandardWebhookError, verifyStandardWebhookRequest } from "@/lib/standard-webhook";

const NOW = 1_786_000_000_000;
const TIMESTAMP = String(Math.floor(NOW / 1000));

async function signedRequest(body: string, options?: { timestamp?: string; sentBody?: string }) {
  const secretBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const secret = `v1,whsec_${Buffer.from(secretBytes).toString("base64")}`;
  const messageId = "msg_signup_123";
  const timestamp = options?.timestamp ?? TIMESTAMP;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${messageId}.${timestamp}.${body}`),
  );

  return {
    request: new Request("https://gift-plan.yeti-lab.fr/lovable/email/auth/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": messageId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${Buffer.from(signature).toString("base64")}`,
      },
      body: options?.sentBody ?? body,
    }),
    secret,
  };
}

describe("Supabase Standard Webhooks verification", () => {
  it("accepts an authentic, recent payload", async () => {
    const body = JSON.stringify({ user: { email: "lilas@example.com" } });
    const { request, secret } = await signedRequest(body);

    await expect(verifyStandardWebhookRequest(request, secret, NOW)).resolves.toEqual({
      messageId: "msg_signup_123",
      payload: { user: { email: "lilas@example.com" } },
    });
  });

  it("rejects a body changed after it was signed", async () => {
    const { request, secret } = await signedRequest(JSON.stringify({ ok: true }), {
      sentBody: JSON.stringify({ ok: false }),
    });

    await expect(verifyStandardWebhookRequest(request, secret, NOW)).rejects.toMatchObject({
      code: "invalid_signature",
    } satisfies Partial<StandardWebhookError>);
  });

  it("rejects replayed payloads outside the five-minute window", async () => {
    const { request, secret } = await signedRequest("{}", {
      timestamp: String(Number(TIMESTAMP) - 301),
    });

    await expect(verifyStandardWebhookRequest(request, secret, NOW)).rejects.toMatchObject({
      code: "stale_timestamp",
    } satisfies Partial<StandardWebhookError>);
  });

  it("rejects requests missing Standard Webhooks headers", async () => {
    const request = new Request("https://gift-plan.yeti-lab.fr/lovable/email/auth/webhook", {
      method: "POST",
      body: "{}",
    });

    await expect(verifyStandardWebhookRequest(request, "v1,whsec_AA==", NOW)).rejects.toMatchObject(
      { code: "missing_headers" } satisfies Partial<StandardWebhookError>,
    );
  });
});
