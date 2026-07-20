export const PROFILE_DIRECTORY_PAGE_SIZE = 50;
export const PROFILE_ACCESS_CHANGED_EVENT = "gp:profile-access-changed";

export type ProfileAccessStatus = "pending" | "accepted" | "declined";

export type DirectoryProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  visibility: "public" | "private";
  can_view: boolean;
  is_self: boolean;
  outgoing_request_id: string | null;
  outgoing_status: ProfileAccessStatus | null;
  incoming_request_id: string | null;
  incoming_status: ProfileAccessStatus | null;
};

export type ProfileAccessInboxEntry = {
  request_id: string;
  requester_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at?: string;
  responded_at?: string | null;
};

export type ProfileAccessInbox = {
  pending: ProfileAccessInboxEntry[];
  granted: ProfileAccessInboxEntry[];
};

export type ProfileDirectoryResult = {
  profiles: DirectoryProfile[];
  total: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function accessStatus(value: unknown): ProfileAccessStatus | null {
  return value === "pending" || value === "accepted" || value === "declined" ? value : null;
}

function parseDirectoryProfile(value: unknown): DirectoryProfile | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    (value.visibility !== "public" && value.visibility !== "private") ||
    typeof value.can_view !== "boolean" ||
    typeof value.is_self !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    username: value.username,
    display_name: optionalString(value.display_name),
    avatar_url: optionalString(value.avatar_url),
    bio: optionalString(value.bio),
    visibility: value.visibility,
    can_view: value.can_view,
    is_self: value.is_self,
    outgoing_request_id: optionalString(value.outgoing_request_id),
    outgoing_status: accessStatus(value.outgoing_status),
    incoming_request_id: optionalString(value.incoming_request_id),
    incoming_status: accessStatus(value.incoming_status),
  };
}

function parseInboxEntry(value: unknown): ProfileAccessInboxEntry | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.request_id !== "string" ||
    typeof value.requester_id !== "string" ||
    typeof value.username !== "string"
  ) {
    return null;
  }

  return {
    request_id: value.request_id,
    requester_id: value.requester_id,
    username: value.username,
    display_name: optionalString(value.display_name),
    avatar_url: optionalString(value.avatar_url),
    created_at: typeof value.created_at === "string" ? value.created_at : undefined,
    responded_at: optionalString(value.responded_at),
  };
}

export function parseProfileDirectory(value: unknown): ProfileDirectoryResult | null {
  if (!isRecord(value) || !Array.isArray(value.profiles) || typeof value.total !== "number") {
    return null;
  }
  const profiles = value.profiles.map(parseDirectoryProfile);
  if (profiles.some((profile) => profile === null)) return null;
  return { profiles: profiles as DirectoryProfile[], total: value.total };
}

export function parseProfileAccessInbox(value: unknown): ProfileAccessInbox | null {
  if (!isRecord(value) || !Array.isArray(value.pending) || !Array.isArray(value.granted)) {
    return null;
  }
  const pending = value.pending.map(parseInboxEntry);
  const granted = value.granted.map(parseInboxEntry);
  if (pending.some((entry) => entry === null) || granted.some((entry) => entry === null)) {
    return null;
  }
  return {
    pending: pending as ProfileAccessInboxEntry[],
    granted: granted as ProfileAccessInboxEntry[],
  };
}

export function directoryProfileName(
  profile: Pick<DirectoryProfile, "display_name" | "username">,
): string {
  return profile.display_name?.trim() || profile.username;
}
