import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("../src/lib/net-guard", () => ({ assertSafeUrl: guard.validate }));
import { fetchGiftPage } from "../src/lib/gift-fetch.server";

beforeEach(() => {
  guard.validate.mockReset().mockImplementation(async (raw: string) => {
    const url = new URL(raw);
    if (url.hostname === "127.0.0.1") throw new Error("BLOCKED_HOST");
    return url;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("fetching shared product links", () => {
  it("validates every short-link redirect and retains the final URL for relative images", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "https://www.amazon.fr/dp/2259322840" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/livre/dp/2259322840" } }),
      )
      .mockResolvedValueOnce(
        new Response("<title>Le livre</title>", {
          headers: { "content-type": "text/html; charset=UTF-8" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchGiftPage("https://amzn.eu/d/test", "test")).toEqual({
      html: "<title>Le livre</title>",
      url: "https://www.amazon.fr/livre/dp/2259322840",
    });
    expect(guard.validate.mock.calls.map(([url]) => url)).toEqual([
      "https://amzn.eu/d/test",
      "https://www.amazon.fr/dp/2259322840",
      "https://www.amazon.fr/livre/dp/2259322840",
    ]);
    expect(fetch.mock.calls.every(([, options]) => options.redirect === "manual")).toBe(true);
  });
  it("does not fetch an internal target reached through a redirect", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchGiftPage("https://shop.example/item", "test")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(guard.validate).toHaveBeenLastCalledWith("http://127.0.0.1/private");
  });
  it("caps redirect loops", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(null, { status: 302, headers: { location: "/loop" } }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchGiftPage("https://shop.example/loop", "test")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(7);
  });
  it("rejects downloads and HTTP failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("PDF", { headers: { "content-type": "application/pdf" } }),
      )
      .mockResolvedValueOnce(new Response("blocked", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchGiftPage("https://shop.example/file", "test")).toBeNull();
    expect(await fetchGiftPage("https://shop.example/item", "test")).toBeNull();
  });
  it("keeps useful metadata from a large page while bounding the amount read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<title>Objet utile</title>" + "x".repeat(1100000), {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const result = await fetchGiftPage("https://shop.example/item", "test");
    expect(result?.html.length).toBe(1000000);
    expect(result?.html).toContain("<title>Objet utile</title>");
  });
});
