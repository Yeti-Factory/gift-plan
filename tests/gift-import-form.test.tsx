// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scrape: vi.fn(),
  query: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  message: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => ({ options }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.scrape }));
vi.mock("@/lib/gift-scrape.functions", () => ({ scrapeGiftUrl: vi.fn() }));
vi.mock("@/lib/self-hosted/api-client", () => ({ apiQuery: mocks.query, apiAction: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: mocks.error, success: mocks.success, message: mocks.message },
}));
vi.mock("@/lib/gift-image", () => ({
  useGiftImageUrls: () => ({ data: {} }),
  uploadGiftImageChecked: vi.fn(),
  removeUncommittedGiftImage: vi.fn(),
}));
import { Route } from "../src/routes/_authenticated/my-lists";
const Page = (Route as unknown as { options: { component: React.ComponentType } }).options
  .component;
const metadata = {
  ok: true as const,
  title: "Dictionnaire amoureux des chiens",
  description: "Un livre illustré",
  imageUrl: "https://shop.example/cover.jpg",
  price: 27,
  currency: "EUR",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({
    userId: "owner",
    circles: [],
    gifts: [],
    lists: [
      {
        id: "list",
        title: "Anniversaire",
        occasion: null,
        circle_id: null,
        visibility: "public",
        circle_ids: [],
      },
    ],
  });
  mocks.scrape.mockResolvedValue(metadata);
});
afterEach(cleanup);
async function openForm() {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(await screen.findByRole("button", { name: "Ajouter un cadeau" }));
  await user.type(screen.getByPlaceholderText("https://…"), "https://amzn.eu/d/test");
  return user;
}
function input(placeholder: string) {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}
function pendingResult() {
  let resolve!: (value: typeof metadata) => void;
  const promise = new Promise<typeof metadata>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("gift URL import form", () => {
  it("labels the Fnac fallback as a provisional title and never invents photo or price", async () => {
    mocks.scrape.mockResolvedValue({
      ok: true,
      source: "url",
      title: "Dictionnaire amoureux des chiens",
      description: null,
      imageUrl: null,
      price: null,
      currency: null,
    });
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await waitFor(() =>
      expect(input("Livre, jeu, écharpe…").value).toBe("Dictionnaire amoureux des chiens"),
    );
    expect(input("29.90").value).toBe("");
    expect(screen.getByRole("dialog").querySelector("img")).toBeNull();
    expect(mocks.message).toHaveBeenCalledWith(
      expect.stringContaining("titre provisoire"),
      expect.anything(),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("fills the product name, description, picture and euro price", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await waitFor(() => expect(input("Livre, jeu, écharpe…").value).toBe(metadata.title));
    expect(input("Taille, couleur, référence…").value).toBe(metadata.description);
    expect(input("29.90").value).toBe("27");
    expect(screen.getByRole("dialog").querySelector("img")?.getAttribute("src")).toBe(
      metadata.imageUrl,
    );
  });
  it("preserves fields typed while the import request is pending", async () => {
    const pending = pendingResult();
    mocks.scrape.mockReturnValue(pending.promise);
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await user.type(input("Livre, jeu, écharpe…"), "Mon livre");
    await user.type(input("Taille, couleur, référence…"), "Édition souhaitée");
    await user.type(input("29.90"), "22");
    await act(async () => pending.resolve(metadata));
    expect(input("Livre, jeu, écharpe…").value).toBe("Mon livre");
    expect(input("Taille, couleur, référence…").value).toBe("Édition souhaitée");
    expect(input("29.90").value).toBe("22");
  });
  it("ignores a completed import when its URL has changed", async () => {
    const pending = pendingResult();
    mocks.scrape.mockReturnValue(pending.promise);
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await user.clear(input("https://…"));
    await user.type(input("https://…"), "https://shop.example/other");
    await act(async () => pending.resolve(metadata));
    expect(input("Livre, jeu, écharpe…").value).toBe("");
    expect(input("29.90").value).toBe("");
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("does not import a foreign price into a euro field", async () => {
    mocks.scrape.mockResolvedValue({ ...metadata, currency: "USD" });
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await waitFor(() => expect(input("Livre, jeu, écharpe…").value).toBe(metadata.title));
    expect(input("29.90").value).toBe("");
    expect(mocks.message).toHaveBeenCalledWith(expect.stringContaining("devise"));
  });
  it("does not alter existing fields when the merchant rejects the request", async () => {
    mocks.scrape.mockResolvedValue({ ok: false, reason: "unavailable" });
    const user = await openForm();
    await user.type(input("Livre, jeu, écharpe…"), "Mon cadeau");
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(input("Livre, jeu, écharpe…").value).toBe("Mon cadeau");
    expect(input("29.90").value).toBe("");
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("ignores results after the gift dialog is closed", async () => {
    const pending = pendingResult();
    mocks.scrape.mockReturnValue(pending.promise);
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => pending.resolve(metadata));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
