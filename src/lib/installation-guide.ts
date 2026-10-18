export const IOS_GUIDE_SEEN_KEY = "gp-ios-install-guide-v1-seen";

export const IOS_INSTALL_STEPS = [
  {
    title: "Ouvrez le lien dans Safari",
    detail:
      "Depuis une messagerie, copiez le lien ci-dessous, ouvrez Safari (l’icône boussole) et collez-le dans la barre d’adresse.",
  },
  {
    title: "Touchez Partager",
    detail:
      "Repérez le carré avec une flèche vers le haut. S’il est masqué, ouvrez le menu de la page (⋯), puis Partager.",
  },
  {
    title: "Choisissez Sur l’écran d’accueil",
    detail: "Faites défiler les actions du menu de partage pour trouver cette option.",
  },
  {
    title: "Confirmez avec Ajouter",
    detail:
      "Si l’option Ouvrir comme app web apparaît, laissez-la activée. Retrouvez ensuite l’icône Gift-Plan sur l’écran d’accueil.",
  },
] as const;

export function buildAppInvitation(url: string) {
  return `Rejoins-moi sur Gift-Plan pour partager nos envies de cadeaux !\n${url}\n\nSur iPhone / iPad :\n1. Ouvre ce lien dans Safari (icône boussole). Depuis une messagerie, copie le lien et colle-le dans Safari.\n2. Touche Partager (carré avec flèche vers le haut), directement ou dans le menu de la page (⋯).\n3. Fais défiler puis choisis Sur l’écran d’accueil.\n4. Garde Ouvrir comme app web activé si proposé, puis touche Ajouter.\n5. Ouvre Gift-Plan depuis sa nouvelle icône, puis crée ton compte ou connecte-toi.\n\nSur Android : ouvre le lien dans Chrome puis le menu ⋮ > Installer l’application ou Ajouter à l’écran d’accueil.\n\nLe guide est aussi disponible sur le lien ci-dessus. L’installation reste facultative.`;
}
