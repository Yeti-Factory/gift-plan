import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readiness: vi.fn(), ping: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/self-hosted/config", () => ({
  getSelfHostedReadiness: mocks.readiness,
}));
vi.mock("@/lib/self-hosted/database.server", () => ({
  pingDatabase: mocks.ping,
}));
import { Route } from "../src/routes/api/public/health";

const get = (
  Route as unknown as {
    options: { server: { handlers: { GET: () => Promise<Response> } } };
  }
).options.server.handlers.GET;

describe("health during service outages", () => {
  it("reports missing email without taking a working application offline", async () => {
    mocks.readiness.mockReturnValue({
      ready: false,
      checks: {
        appUrl: true,
        authSecret: true,
        database: true,
        email: false,
        uploads: true,
        google: true,
      },
    });
    mocks.ping.mockResolvedValue(1);
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "degraded", checks: { email: "fail" } });
  });

  it("still reports a database outage as unhealthy", async () => {
    mocks.readiness.mockReturnValue({
      ready: true,
      checks: {
        appUrl: true,
        authSecret: true,
        database: true,
        email: true,
        uploads: true,
        google: true,
      },
    });
    mocks.ping.mockRejectedValue(new Error("test database unavailable"));
    expect((await get()).status).toBe(503);
  });
});
