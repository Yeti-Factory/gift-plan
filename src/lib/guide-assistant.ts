import { USER_GUIDE, guideSearchText, type GuideChapter } from "@/lib/user-guide";
export type GuideAnswer = { text: string; chapter?: GuideChapter; choices?: GuideChapter[] };
const chapters = (ids: string[]) =>
  ids.map((id) => USER_GUIDE.find((chapter) => chapter.id === id)!).filter(Boolean);
export function answerGuideQuestion(question: string): GuideAnswer {
  const q = guideSearchText(question).replace(/[’']/g, " ");
  const answer = (id: string): GuideAnswer => ({
    text: "Voici comment faire dans Gift-Plan.",
    chapter: chapters([id])[0],
  });
  if (!q) return { text: "Choisissez un sujet ou écrivez ce que vous souhaitez faire." };
  if (/^(bonjour|bonsoir|salut|hello|coucou)[ !?.]*$/.test(q))
    return { text: "Bonjour ! Que souhaitez-vous faire dans Gift-Plan ?" };
  if (/^(merci|super|parfait|ok|merci beaucoup)[ !?.]*$/.test(q))
    return {
      text: "Avec plaisir ! Vous pouvez choisir un autre sujet ou poser une nouvelle question.",
    };
  if (/iphone|ipad|\bios\b|safari|app store/.test(q)) return answer("installation-iphone");
  if (/android|chrome|play store/.test(q)) return answer("installation-android");
  if (/install|ecran d accueil|sur mon tel/.test(q))
    return {
      text: "Sur quel appareil souhaitez-vous installer Gift-Plan ?",
      choices: chapters(["installation-iphone", "installation-android"]),
    };
  if (
    /mot de passe|\bmdp\b|reinitialis|email|\bmail\b|inscri|creer (mon|un) compte|connecter|connexion (au|a mon) compte/.test(
      q,
    )
  )
    return answer("compte");
  if (/bloqu|signal|harcel|export|supprim.*(compte|profil)|donnees/.test(q))
    return answer("securite");
  if (/quitt.*(groupe|conversation)/.test(q))
    return {
      text: "Dans la conversation de groupe, touchez Quitter la conversation, puis Confirmer mon départ. Vous perdrez l’accès à l’historique et ne recevrez plus ses messages. Revenir dans le cercle ne rétablit pas cet accès.",
      choices: chapters(["groupes-surprises", "messages-prives"]),
    };
  if (
    /exclu|decoch|surprise|conversation de groupe|participants|a plusieurs|cadeau commun|messages? (au|a un|a tout le|a tout un|a tout mon|dans le) cercle|ecrire (au|a un|a mon|a tout le|a tout mon) cercle/.test(
      q,
    )
  )
    return answer("groupes-surprises");
  if (/reser|doublon|achete|acheter|j offre|offrir|deja pris/.test(q)) return answer("offrir");
  if (
    /amazon|fnac|produit|recuper|import|variante|couleur|taille|prix|cadeau.*ajout|ajout.*cadeau/.test(
      q,
    )
  )
    return answer("cadeaux");
  if (/anniversaire|profil.*(public|prive|visible|photo)|photo.*profil|contacts.*public/.test(q))
    return answer("profil");
  if (/liste/.test(q)) return answer("listes");
  if (
    /(ecrire|message|discut|conversation).*(personne|quelqu|ami|profil)|\becrire a\b|message prive/.test(
      q,
    )
  )
    return answer("messages-prives");
  if (/ecrire|message|messagerie|conversation|discut/.test(q))
    return {
      text: "Souhaitez-vous écrire à une personne ou préparer un échange à plusieurs ?",
      choices: chapters(["messages-prives", "groupes-surprises"]),
    };
  if (/cercle|inviter|invitation|code/.test(q)) return answer("cercles");
  if (
    /communaute|annuaire|retrouver.*(personne|profil|compte)|recherch.*(personne|profil|compte)|demande.*acces|connexion.*profil/.test(
      q,
    )
  )
    return answer("communaute");
  if (/public|prive|confidential|visibil/.test(q))
    return {
      text: "Voulez-vous régler la visibilité de votre profil ou celle d’une liste ?",
      choices: chapters(["profil", "listes"]),
    };
  if (/accueil|retour|menu|navigation|mode d emploi/.test(q)) return answer("navigation");
  if (/erreur|probleme|impossible|ne (marche|fonctionne)|manque|n arrive/.test(q))
    return answer("depannage");
  if (/but|a quoi|sert|commencer|debut|comment utiliser|fonctionne gift/.test(q))
    return answer("demarrer");
  const stop = new Set([
    "comment",
    "pour",
    "avec",
    "dans",
    "faire",
    "peux",
    "peut",
    "suis",
    "vous",
    "mon",
    "mes",
    "une",
    "des",
    "les",
    "est",
    "pas",
    "que",
    "qui",
    "sur",
    "gift",
    "plan",
    "veux",
    "voudrais",
  ]);
  const words = q.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stop.has(word));
  const ranked = USER_GUIDE.map((chapter) => ({
    chapter,
    score: words.reduce(
      (score, word) =>
        score +
        (guideSearchText(chapter.title).includes(word)
          ? 3
          : guideSearchText(
                [chapter.intro, ...chapter.steps, ...(chapter.notes ?? [])].join(" "),
              ).includes(word)
            ? 1
            : 0),
      0,
    ),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 3 && ranked[0].score > (ranked[1]?.score ?? 0) + 1)
    return { text: "Cette rubrique devrait vous aider.", chapter: ranked[0].chapter };
  if (ranked[0]?.score >= 2)
    return {
      text: "Quel sujet correspond le mieux à votre question ?",
      choices: ranked.slice(0, 3).map((item) => item.chapter),
    };
  return {
    text: "Je n’ai pas trouvé de réponse précise dans le mode d’emploi. Essayez avec le nom de la fonction, ou choisissez un sujet ci-dessous.",
    choices: chapters(["demarrer", "listes", "messages-prives", "groupes-surprises", "depannage"]),
  };
}
