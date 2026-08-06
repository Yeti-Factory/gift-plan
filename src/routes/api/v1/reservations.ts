import { createFileRoute } from "@tanstack/react-router";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readJsonObject,
} from "@/lib/self-hosted/http.server";
import { parseReservationCommand } from "@/lib/self-hosted/profile-api";
import { setGiftReservation } from "@/lib/self-hosted/profiles.server";
import { requireUserId } from "@/lib/self-hosted/session.server";

export const Route = createFileRoute("/api/v1/reservations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const userId = await requireUserId(request.headers);
          const input = parseReservationCommand(await readJsonObject(request));
          if (!input) throw new ApiError(400, "INVALID_REQUEST");
          await setGiftReservation(userId, input.giftId, input.status);
          return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
