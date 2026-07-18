import { describe, it, expect } from "vitest";
import {
  assertSafeUrl,
  isBlockedHostname,
  isBlockedIp,
  normalizeHostname,
} from "../src/lib/net-guard";

describe("normalizeHostname", () => {
  it("lowercases, strips trailing dot and IPv6 brackets", () => {
    expect(normalizeHostname("Example.COM.")).toBe("example.com");
    expect(normalizeHostname("[::1]")).toBe("::1");
  });
});

describe("isBlockedIp", () => {
  it("blocks IPv4 private/loopback/metadata", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.4",
      "192.168.1.1",
      "169.254.169.254", // AWS/GCP metadata
      "0.0.0.0",
      "100.64.1.1", // CGNAT
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.200.14"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
  it("blocks IPv6 loopback/ULA/link-local/mapped", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it("allows public IPv6", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks internal suffixes and metadata hostnames", () => {
    for (const h of [
      "localhost",
      "foo.local",
      "server.internal",
      "db.lan",
      "metadata.google.internal",
      "svc.corp",
    ]) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });
  it("blocks IP literals as hostnames incl. bracketed IPv6", () => {
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
    expect(isBlockedHostname("[::1]")).toBe(true);
  });
  it("allows public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("google.com")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow("BLOCKED_PROTOCOL");
    await expect(assertSafeUrl("gopher://example.com")).rejects.toThrow("BLOCKED_PROTOCOL");
  });
  it("rejects credentials in URL", async () => {
    await expect(assertSafeUrl("https://user:pw@example.com")).rejects.toThrow(
      "URL_CREDENTIALS_FORBIDDEN",
    );
  });
  it("rejects private literal hosts before DNS", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/x")).rejects.toThrow("BLOCKED_HOST");
    await expect(assertSafeUrl("http://[::1]/x")).rejects.toThrow("BLOCKED_HOST");
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      "BLOCKED_HOST",
    );
  });
  it("rejects internal suffix hostnames", async () => {
    await expect(assertSafeUrl("http://foo.internal/x")).rejects.toThrow("BLOCKED_HOST");
    await expect(assertSafeUrl("http://metadata.google.internal/")).rejects.toThrow(
      "BLOCKED_HOST",
    );
  });
  it("fails closed on DNS lookup failure", async () => {
    // A syntactically valid but non-resolvable TLD.
    await expect(
      assertSafeUrl("http://this-domain-should-not-exist.invalid/"),
    ).rejects.toThrow(/DNS_LOOKUP_FAILED|DNS_LOOKUP_EMPTY|BLOCKED_/);
  });
});