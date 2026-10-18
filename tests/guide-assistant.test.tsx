// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { answerGuideQuestion } from "../src/lib/guide-assistant";
import { UserGuidePage } from "../src/components/UserGuidePage";
afterEach(() => cleanup());
describe("interactive Gift-Plan manual", () => {
  it("understands a typed follow-up within the current topic", async () => {
    const user = userEvent.setup();
    render(<UserGuidePage />);
    await user.type(screen.getByLabelText("Votre question sur Gift-Plan"), "Installer sur iPhone");
    await user.click(screen.getByRole("button", { name: "Poser ma question" }));
    await user.type(screen.getByLabelText("Votre question sur Gift-Plan"), "suivant");
    await user.click(screen.getByRole("button", { name: "Poser ma question" }));
    expect(screen.getByText("Étape 2 sur 6")).toBeTruthy();
    expect(screen.getByText("Passons à la suite.")).toBeTruthy();
  });
  it.each([
    ["Comment installer sur IPHONE ?", "installation-iphone"],
    ["Je veux utiliser Android", "installation-android"],
    ["J’ai oublié mon mot de passe", "compte"],
    ["Comment écrire à Émilie ?", "messages-prives"],
    ["Écrire à un cercle en excluant quelqu’un", "groupes-surprises"],
    ["Mon profil est privé", "profil"],
    ["Comment rendre une liste publique ?", "listes"],
    ["Le lien Amazon ne récupère pas la bonne couleur", "cadeaux"],
    ["Comment réserver sans doublons ?", "offrir"],
    ["Je veux bloquer quelqu’un dans une conversation de groupe", "securite"],
  ])("routes a question to documented help: %s", (question, id) => {
    expect(answerGuideQuestion(question).chapter?.id).toBe(id);
  });
  it("clarifies ambiguous installation and conversation requests", () => {
    expect(answerGuideQuestion("Comment installer ?").choices?.map((c) => c.id)).toEqual([
      "installation-iphone",
      "installation-android",
    ]);
    expect(answerGuideQuestion("Comment envoyer un message ?").choices?.map((c) => c.id)).toEqual([
      "messages-prives",
      "groupes-surprises",
    ]);
    expect(answerGuideQuestion("zxywqv").chapter).toBeUndefined();
    expect(answerGuideQuestion("zxywqv").text).toContain("Je n’ai pas trouvé");
  });
  it("guides a typed question one step at a time and reveals the privacy notes", async () => {
    const user = userEvent.setup();
    render(<UserGuidePage />);
    await user.type(
      screen.getByLabelText("Votre question sur Gift-Plan"),
      "Comment préparer une surprise sans prévenir quelqu’un ?",
    );
    await user.click(screen.getByRole("button", { name: "Poser ma question" }));
    expect(screen.getByText("Étape 1 sur 7")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Étape suivante" }));
    expect(screen.getByText("Étape 2 sur 7")).toBeTruthy();
    expect(screen.getByText(/Décochez la ou les personnes/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Voir toute l’explication" }));
    expect(screen.getByText(/Les personnes décochées ne voient ni la conversation/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(screen.queryByText(/Les personnes décochées ne voient ni la conversation/)).toBeNull();
  });
  it("offers every topic and asks which device the reader uses", async () => {
    const user = userEvent.setup();
    render(<UserGuidePage />);
    await user.click(screen.getByRole("button", { name: "Tous les sujets" }));
    const topics = screen.getByRole("navigation", { name: "Sujets du mode d’emploi" });
    expect(within(topics).getAllByRole("button")).toHaveLength(15);
    await user.type(screen.getByLabelText("Votre question sur Gift-Plan"), "Comment installer ?");
    await user.click(screen.getByRole("button", { name: "Poser ma question" }));
    expect(screen.getByText("Sur quel appareil souhaitez-vous installer Gift-Plan ?")).toBeTruthy();
    const options = screen.getAllByRole("button", { name: "Installer sur iPhone ou iPad" });
    await user.click(options.at(-1)!);
    expect(screen.getByText(/Étape 1 sur/)).toBeTruthy();
  });
});
