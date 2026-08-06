import { describe, expect, it } from "vitest";

import {
  normalizeDirectoryInput,
  parseProfileAccessCommand,
  parseReservationCommand,
} from "../src/lib/self-hosted/profile-api";

const profileId = "19d4fe76-84f9-4a51-93be-b1edac74dc5a";

describe("self-hosted profile API inputs", () => {
  it("normalizes directory pagination and limits the search term", () => {
    const params = new URLSearchParams({ q: `  ${"a".repeat(120)}  `, limit: "999", offset: "-5" });
    expect(normalizeDirectoryInput(params)).toEqual({
      query: "a".repeat(100),
      limit: 100,
      offset: 0,
    });
  });

  it("falls back to safe pagination for non-integer values", () => {
    const params = new URLSearchParams({ limit: "2.5", offset: "invalid" });
    expect(normalizeDirectoryInput(params)).toEqual({ query: "", limit: 50, offset: 0 });
  });

  it("accepts each explicit access command", () => {
    expect(parseProfileAccessCommand({ action: "request", profileId })).toEqual({
      action: "request",
      profileId,
    });
    expect(parseProfileAccessCommand({ action: "cancel", profileId })).toEqual({
      action: "cancel",
      profileId,
    });
    expect(
      parseProfileAccessCommand({ action: "respond", requestId: profileId, accept: true }),
    ).toEqual({ action: "respond", requestId: profileId, accept: true });
    expect(parseProfileAccessCommand({ action: "revoke", requesterId: profileId })).toEqual({
      action: "revoke",
      requesterId: profileId,
    });
  });

  it("rejects malformed UUIDs and incomplete commands", () => {
    expect(parseProfileAccessCommand({ action: "request", profileId: "not-a-uuid" })).toBeNull();
    expect(parseProfileAccessCommand({ action: "respond", requestId: profileId })).toBeNull();
    expect(parseProfileAccessCommand({ action: "unknown", profileId })).toBeNull();
  });

  it("allows only the supported reservation states", () => {
    expect(parseReservationCommand({ giftId: profileId, status: "reserved" })).toEqual({
      giftId: profileId,
      status: "reserved",
    });
    expect(parseReservationCommand({ giftId: profileId, status: null })).toEqual({
      giftId: profileId,
      status: null,
    });
    expect(parseReservationCommand({ giftId: profileId, status: "ordered" })).toBeNull();
  });
});
