import { describe, expect, it } from "vitest";

import {
  directoryProfileName,
  parseProfileAccessInbox,
  parseProfileDirectory,
} from "@/lib/profile-directory";

const profile = {
  id: "profile-1",
  username: "alice",
  display_name: "Alice",
  avatar_url: null,
  bio: null,
  visibility: "private",
  can_view: false,
  is_self: false,
  outgoing_request_id: null,
  outgoing_status: null,
  incoming_request_id: null,
  incoming_status: null,
};

describe("profile directory parsing", () => {
  it("accepts a valid paginated directory response", () => {
    expect(parseProfileDirectory({ profiles: [profile], total: 1 })).toEqual({
      profiles: [profile],
      total: 1,
    });
  });

  it("rejects malformed access states", () => {
    expect(
      parseProfileDirectory({
        profiles: [{ ...profile, outgoing_status: "unknown" }],
        total: 1,
      }),
    ).toEqual({
      profiles: [{ ...profile, outgoing_status: null }],
      total: 1,
    });
    expect(parseProfileDirectory({ profiles: [{ ...profile, can_view: "yes" }], total: 1 })).toBe(
      null,
    );
  });

  it("parses pending and granted inbox entries", () => {
    const entry = {
      request_id: "request-1",
      requester_id: "profile-2",
      username: "bruno",
      display_name: "Bruno",
      avatar_url: null,
    };
    expect(parseProfileAccessInbox({ pending: [entry], granted: [] })).toEqual({
      pending: [{ ...entry, created_at: undefined, responded_at: null }],
      granted: [],
    });
  });

  it("uses the username when the display name is empty", () => {
    expect(directoryProfileName({ display_name: "  ", username: "alice" })).toBe("alice");
  });
});
