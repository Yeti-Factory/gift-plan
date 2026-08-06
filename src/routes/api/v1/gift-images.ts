import { createFileRoute } from "@tanstack/react-router";

import { getGiftImageUrls } from "@/lib/self-hosted/files.server";
import { apiErrorResponse, noStoreJson } from "@/lib/self-hosted/http.server";
import { UUID_PATTERN } from "@/lib/self-hosted/profile-api";
import { getOptionalUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/gift-images")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
          const share = url.searchParams.get("share");
          if (ids.length > 100 || ids.some((id) => !UUID_PATTERN.test(id))) {
            return noStoreJson({ error: "INVALID_REQUEST" }, { status: 400 });
          }
          if (share && !UUID_PATTERN.test(share)) {
            return noStoreJson({ error: "INVALID_REQUEST" }, { status: 400 });
          }
          return noStoreJson(
            await getGiftImageUrls(ids, await getOptionalUserId(request.headers), share),
          );
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
