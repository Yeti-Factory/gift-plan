// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ExpandableGiftList, ExpandableGiftRow } from "@/components/ExpandableGiftList";

afterEach(cleanup);

describe("expandable gift list", () => {
  it("keeps details hidden until the gift row is expanded", async () => {
    const user = userEvent.setup();
    render(
      <ExpandableGiftList label="Cadeaux de Noël">
        <ExpandableGiftRow
          title="Casque audio"
          category="musique"
          description="Modèle sans fil noir"
          url="https://example.com/casque"
          price={129}
          priority="j_adorerais"
          actions={<button type="button">Modifier</button>}
        />
      </ExpandableGiftList>,
    );

    expect(screen.getByRole("list", { name: "Cadeaux de Noël" })).toBeTruthy();
    expect(screen.queryByText("Modèle sans fil noir")).toBeNull();
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Afficher les détails de Casque audio" }));

    expect(screen.getByText("Modèle sans fil noir")).toBeTruthy();
    expect(screen.getByText("Musique")).toBeTruthy();
    expect(screen.getByText("J'adorerais")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Voir le cadeau/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Masquer les détails de Casque audio" }),
    ).toBeTruthy();
  });
});
