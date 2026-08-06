import { createFileRoute } from "@tanstack/react-router";

import { ApiError, apiErrorResponse, noStoreJson } from "@/lib/self-hosted/http.server";
import { USERNAME_PATTERN, UUID_PATTERN } from "@/lib/self-hosted/profile-api";
import { getProfilePage } from "@/lib/self-hosted/profiles.server";
import { getOptionalUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/profiles/$username")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          if (!USERNAME_PATTERN.test(params.username)) {
            throw new ApiError(404, "NOT_FOUND");
          }
          const share = new URL(request.url).searchParams.get("share");
          if (share !== null && !UUID_PATTERN.test(share)) {
            throw new ApiError(400, "INVALID_REQUEST");
          }
          const result = await getProfilePage(
            params.username,
            await getOptionalUserId(request.headers),
            share,
          );
          if ("error" in result) {
            return noStoreJson(result, {
              status: result.error === "PROFILE_NOT_FOUND" ? 404 : 403,
            });
          }
          return noStoreJson(result);
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
