import { createFileRoute } from "@tanstack/react-router";

import { readUpload } from "@/lib/self-hosted/files.server";
import { apiErrorResponse } from "@/lib/self-hosted/http.server";
import { UUID_PATTERN } from "@/lib/self-hosted/profile-api";
import { getOptionalUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/files/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const relative = decodeURIComponent(url.pathname.slice("/api/v1/files/".length));
          const slash = relative.indexOf("/");
          if (slash < 0) return new Response(null, { status: 404 });
          const share = url.searchParams.get("share");
          if (share && !UUID_PATTERN.test(share)) return new Response(null, { status: 404 });
          return await readUpload(
            relative.slice(0, slash),
            relative.slice(slash + 1),
            await getOptionalUserId(request.headers),
            share,
          );
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
