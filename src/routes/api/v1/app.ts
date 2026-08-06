import { createFileRoute } from "@tanstack/react-router";

import {
  getAccountData,
  getAdminStatus,
  getAppStatus,
  getCircleDetail,
  getCircleMember,
  getCircles,
  getMyLists,
  getMyProfile,
  getOffers,
  getSessionView,
  requiredUuid,
  searchPublicProfiles,
} from "@/lib/self-hosted/app.server";
import { runAppAction } from "@/lib/self-hosted/actions.server";
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJsonObject,
} from "@/lib/self-hosted/http.server";
import { getOptionalUserId, requireUserId } from "@/lib/self-hosted/session.server";
import { normalizeDirectoryInput, parseProfileAccessCommand } from "@/lib/self-hosted/profile-api";
import {
  applyProfileAccessCommand,
  listProfileAccessInbox,
  listProfileDirectory,
} from "@/lib/self-hosted/profiles.server";

async function readView(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view === "status") return getAppStatus(await getOptionalUserId(request.headers));
  if (view === "search") return searchPublicProfiles(url.searchParams.get("q") ?? "");

  const userId = await requireUserId(request.headers);
  switch (view) {
    case "session":
      return getSessionView(userId);
    case "community": {
      const input = normalizeDirectoryInput(url.searchParams);
      const [directory, inbox] = await Promise.all([
        listProfileDirectory(userId, input),
        listProfileAccessInbox(userId),
      ]);
      return { directory, inbox };
    }
    case "my-lists":
      return getMyLists(userId);
    case "circles":
      return getCircles(userId);
    case "circle":
      return getCircleDetail(userId, requiredUuid(url.searchParams.get("circleId")));
    case "circle-member":
      return getCircleMember(
        userId,
        requiredUuid(url.searchParams.get("circleId")),
        requiredUuid(url.searchParams.get("userId")),
      );
    case "offers":
      return getOffers(userId);
    case "profile":
      return getMyProfile(userId);
    case "account":
      return getAccountData(userId);
    case "admin":
      return getAdminStatus(userId);
    default:
      throw new ApiError(400, "INVALID_REQUEST");
  }
}

export const Route = createFileRoute("/api/v1/app")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return noStoreJson(await readView(request));
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request);
          const userId = await requireUserId(request.headers);
          const body = await readJsonObject(request);
          const profileCommand = parseProfileAccessCommand(body);
          const result = profileCommand
            ? await applyProfileAccessCommand(userId, profileCommand)
            : await runAppAction(userId, body);
          return result === undefined
            ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
            : noStoreJson(result);
        } catch (error) {
          return apiErrorResponse(error);
        }
      },
    },
  },
});
