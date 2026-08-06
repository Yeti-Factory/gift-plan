import { describe, expect, it, vi } from "vitest";

import {
  getProfilePage,
  listProfileAccessInbox,
  listProfileDirectory,
  setGiftReservation,
} from "../src/lib/self-hosted/profiles.server";

const viewerId = "19d4fe76-84f9-4a51-93be-b1edac74dc5a";
const ownerId = "e4b68108-3575-4aa3-b8bf-3ba3b3ee0a5c";
const listId = "bfe444c0-7420-494c-b024-e002cac2a2d5";

describe("self-hosted profile queries", () => {
  it("keeps the directory total when an offset returns an empty page", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ profiles: [], total_count: 4 }] });
    const result = await listProfileDirectory(viewerId, { query: "", limit: 50, offset: 100 }, {
      query,
    } as never);

    expect(result).toEqual({ profiles: [], total: 4 });
    expect(query.mock.calls[0]?.[0]).toContain('account."emailVerified" = true');
  });

  it("serializes PostgreSQL timestamps in the access inbox", async () => {
    const createdAt = new Date("2026-08-06T10:00:00.000Z");
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          request_id: listId,
          requester_id: viewerId,
          username: "profil-test",
          display_name: null,
          avatar_url: null,
          status: "pending",
          created_at: createdAt,
          responded_at: null,
        },
      ],
    });

    const inbox = await listProfileAccessInbox(ownerId, { query } as never);
    expect(inbox.pending[0]?.created_at).toBe(createdAt.toISOString());
    expect(inbox.granted).toEqual([]);
  });

  it("shows public lists of a private profile without exposing its bio", async () => {
    const giftId = "45842bb4-b773-4101-9370-6528a5561f44";
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: ownerId,
            username: "profil-prive",
            display_name: "Profil privé",
            avatar_url: null,
            bio: "Information privée",
            visibility: "private",
            is_owner: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ can_view: false }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: listId,
            title: "Liste publique",
            occasion: null,
            event_date: null,
            visibility: "public",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: giftId,
            list_id: listId,
            category: "culture",
            title: "Un livre",
            description: null,
            url: null,
            image_url: null,
            image_path: null,
            price: "19.90",
            currency: "EUR",
            priority: "me_plairait",
            reservation_status: null,
            reservation_buyer_id: null,
          },
        ],
      });

    const result = await getProfilePage("profil-prive", viewerId, null, { query } as never);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.profile.bio).toBeNull();
    expect(result.lists[0]?.gifts[0]?.price).toBe(19.9);
  });

  it("never lets an owner reserve their own gift", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ owner_id: viewerId, list_id: listId }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(
      setGiftReservation(viewerId, ownerId, "reserved", null, database as never),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "BEGIN",
      "SELECT owner_id, list_id FROM gifts WHERE id = $1::uuid FOR UPDATE",
      "ROLLBACK",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });
});
