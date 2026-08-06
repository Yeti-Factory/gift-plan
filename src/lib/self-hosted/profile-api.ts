import type {
  DirectoryProfile,
  ProfileAccessInbox,
  ProfileAccessStatus,
  ProfileDirectoryResult,
} from "@/lib/profile-directory";
import type { ProfilePageResult } from "@/lib/profile-page";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/i;

export type ProfileAccessCommand =
  | { action: "request"; profileId: string }
  | { action: "cancel"; profileId: string }
  | { action: "respond"; requestId: string; accept: boolean }
  | { action: "revoke"; requesterId: string };

export type ReservationCommand = {
  giftId: string;
  status: "reserved" | "purchased" | null;
};

function uuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function normalizeDirectoryInput(searchParams: URLSearchParams) {
  const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const requestedLimit = Number(searchParams.get("limit") ?? 50);
  const requestedOffset = Number(searchParams.get("offset") ?? 0);
  return {
    query,
    limit: Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 50,
    offset: Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0,
  };
}

export function parseProfileAccessCommand(
  body: Record<string, unknown>,
): ProfileAccessCommand | null {
  if (body.action === "request" || body.action === "cancel") {
    const profileId = uuid(body.profileId);
    return profileId ? { action: body.action, profileId } : null;
  }
  if (body.action === "respond") {
    const requestId = uuid(body.requestId);
    return requestId && typeof body.accept === "boolean"
      ? { action: "respond", requestId, accept: body.accept }
      : null;
  }
  if (body.action === "revoke") {
    const requesterId = uuid(body.requesterId);
    return requesterId ? { action: "revoke", requesterId } : null;
  }
  return null;
}

export function parseReservationCommand(body: Record<string, unknown>): ReservationCommand | null {
  const giftId = uuid(body.giftId);
  if (!giftId) return null;
  if (body.status !== null && body.status !== "reserved" && body.status !== "purchased") {
    return null;
  }
  return { giftId, status: body.status };
}

export type { DirectoryProfile, ProfileAccessInbox, ProfileAccessStatus, ProfileDirectoryResult };
export type { ProfilePageResult };
