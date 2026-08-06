import { createFileRoute } from "@tanstack/react-router";

import { saveUpload } from "@/lib/self-hosted/files.server";
import { apiErrorResponse, assertSameOrigin, noStoreJson } from "@/lib/self-hosted/http.server";
import { requireUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/uploads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 5 * 1024 * 1024 + 64 * 1024) {
            return noStoreJson({ error: "INVALID_REQUEST" }, { status: 413 });
          }
          const userId = await requireUserId(request.headers);
          const form = await request.formData();
          return noStoreJson(await saveUpload(userId, form.get("kind"), form.get("file")));
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
