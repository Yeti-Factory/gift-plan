import { createFileRoute } from "@tanstack/react-router";

import { normalizeDirectoryInput, parseProfileAccessCommand } from "@/lib/self-hosted/profile-api";
import {
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJsonObject,
} from "@/lib/self-hosted/http.server";
import {
  applyProfileAccessCommand,
  listProfileAccessInbox,
  listProfileDirectory,
} from "@/lib/self-hosted/profiles.server";
import { requireUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/community")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await requireUserId(request.headers);
          const input = normalizeDirectoryInput(new URL(request.url).searchParams);
          const [directory, inbox] = await Promise.all([
            listProfileDirectory(userId, input),
            listProfileAccessInbox(userId),
          ]);
          return noStoreJson({ directory, inbox });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const userId = await requireUserId(request.headers);
          const command = parseProfileAccessCommand(await readJsonObject(request));
          if (!command) {
            return noStoreJson({ error: "INVALID_REQUEST" }, { status: 400 });
          }
          await applyProfileAccessCommand(userId, command);
          return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
