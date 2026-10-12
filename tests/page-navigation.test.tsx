// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { PageNavigation } from "../src/components/PageNavigation";

beforeEach(() => vi.stubGlobal("scrollTo", vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function mount(entries: string[]) {
  const root = createRootRoute({
    component: () => (
      <>
        <PageNavigation />
        <Outlet />
      </>
    ),
  });
  const routes = ["/", "/people", "/profile", "/circles", "/reset-password", "/auth"].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => <div>Contenu</div> }),
  );
  const history = createMemoryHistory({ initialEntries: entries });
  const router = createRouter({ routeTree: root.addChildren(routes), history });
  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);
  return { history, user: userEvent.setup() };
}
describe("page navigation", () => {
  it("returns to the previous app page", async () => {
    const { history, user } = await mount(["/circles", "/profile"]);
    await user.click(screen.getByRole("button", { name: "Retour" }));
    await waitFor(() => expect(history.location.pathname).toBe("/circles"));
  });
  it("goes to home when a page was opened directly", async () => {
    const { history, user } = await mount(["/profile"]);
    await user.click(screen.getByRole("button", { name: "Retour" }));
    await waitFor(() => expect(history.location.pathname).toBe("/"));
  });
  it("opens home directly even with several pages in the history", async () => {
    const { history, user } = await mount(["/circles", "/profile", "/people"]);
    await user.click(screen.getByRole("link", { name: "Accueil" }));
    await waitFor(() => expect(history.location.pathname).toBe("/"));
  });
  it("returns a directly opened password reset page to sign in", async () => {
    const { history, user } = await mount(["/reset-password"]);
    await user.click(screen.getByRole("button", { name: "Retour" }));
    await waitFor(() => expect(history.location.pathname).toBe("/auth"));
  });
});
