import { IOS_INSTALL_STEPS } from "@/lib/installation-guide";
export type GuideChapter = {
  id: string;
  title: string;
  intro: string;
  steps: string[];
  notes?: string[];
};
export const USER_GUIDE: GuideChapter[] = [
  {
    id: "demarrer",
    title: "1. À quoi sert Gift-Plan ?",
    intro:
      "Gift-Plan rassemble vos envies de cadeaux et aide vos proches à choisir quoi vous offrir. Les réservations évitent les doublons, tout en gardant la surprise.",
    steps: [
      "Créez votre compte et complétez votre profil.",
      "Créez une liste, choisissez qui pourra la voir, puis ajoutez vos idées de cadeaux.",
      "Retrouvez vos proches dans Communauté ou rejoignez un cercle avec leur code.",
      "Consultez les listes auxquelles vous avez accès et réservez les cadeaux que vous comptez offrir.",
      "Utilisez les messages privés ou une conversation de groupe pour organiser une surprise.",
    ],
    notes: [
      "Gift-Plan n’achète rien à votre place. Les liens des cadeaux conduisent aux sites des vendeurs.",
      "Ce mode d’emploi reste accessible par le bouton au milieu de la barre Retour / Accueil, même sans être connecté.",
    ],
  },
  {
    id: "installation-iphone",
    title: "2. Installer sur iPhone ou iPad",
    intro:
      "L’installation ajoute une icône Gift-Plan sur votre écran d’accueil. Vous pouvez aussi utiliser l’application directement dans le navigateur.",
    steps: [
      "Ouvrez le lien Gift-Plan reçu dans l’invitation. S’il s’affiche dans une messagerie, copiez le lien pour l’ouvrir dans Safari.",
      ...IOS_INSTALL_STEPS.map((step) => `${step.title} : ${step.detail}`),
      "Touchez ensuite l’icône Gift-Plan sur l’écran d’accueil et connectez-vous, ou créez votre compte.",
    ],
    notes: [
      "Vous n’avez pas besoin de chercher Gift-Plan dans l’App Store pour suivre cette installation.",
      "Si vous ne trouvez pas l’action Sur l’écran d’accueil, vérifiez que le lien est ouvert dans Safari, puis faites défiler les actions du menu Partager.",
    ],
  },
  {
    id: "installation-android",
    title: "3. Installer sur Android",
    intro: "L’application peut être ajoutée à l’écran d’accueil depuis Chrome.",
    steps: [
      "Ouvrez le lien Gift-Plan dans Chrome. Si le lien est dans une messagerie, copiez-le dans le navigateur.",
      "Ouvrez le menu ⋮ de Chrome, puis choisissez Installer l’application ou Ajouter à l’écran d’accueil, selon l’option proposée.",
      "Confirmez l’ajout, puis lancez Gift-Plan depuis sa nouvelle icône.",
      "Connectez-vous avec votre compte habituel. Installer l’application ne crée pas un autre compte.",
    ],
  },
  {
    id: "compte",
    title: "4. Créer un compte, se connecter ou retrouver son accès",
    intro:
      "Utilisez la même adresse email pour retrouver vos listes et vos cercles sur vos différents appareils.",
    steps: [
      "Depuis Se connecter, choisissez Créer un compte. Renseignez votre nom, votre adresse email, un mot de passe d’au moins 8 caractères et votre anniversaire (jour et mois).",
      "Confirmez votre adresse avec le lien reçu par email. Vérifiez aussi les courriers indésirables si vous ne trouvez pas le message.",
      "Pour revenir, utilisez Se connecter avec votre email et votre mot de passe habituels.",
      "Si vous avez oublié votre mot de passe, choisissez Mot de passe oublié, indiquez l’email du compte, puis ouvrez le lien de réinitialisation reçu et choisissez un nouveau mot de passe.",
      "Si une mise à jour vous demande de vous reconnecter, reconnectez-vous normalement : vos listes et vos comptes ne sont pas recréés.",
    ],
    notes: [
      "La demande de réinitialisation ne révèle pas si une adresse correspond à un compte. Si aucun email n’arrive, vérifiez l’adresse saisie, les indésirables et utilisez le lien le plus récent.",
      "Le jour et le mois d’anniversaire sont affichés aux personnes autorisées à consulter votre profil ; aucune année de naissance n’est demandée.",
    ],
  },
  {
    id: "navigation",
    title: "5. Se repérer dans les menus",
    intro: "Les boutons du haut vous aident à revenir et à retrouver ce guide à tout moment.",
    steps: [
      "Retour revient à la page précédente. Si la page a été ouverte directement, il ramène à l’accueil.",
      "Mode d’emploi, entre Retour et Accueil, ouvre ce guide. Utilisez son sommaire ou la recherche pour trouver un sujet.",
      "Accueil ramène à l’écran principal : Communauté lorsque vous êtes connecté.",
      "Les onglets du bas ouvrent Communauté, Mes listes, J’offre, Cercles et Mon profil.",
      "La bulle Messages en haut de votre espace ouvre vos conversations. Son compteur indique les messages non lus.",
      "Mon compte permet notamment de gérer vos accès, de revoir le guide de démarrage et de télécharger vos données.",
    ],
  },
  {
    id: "profil",
    title: "6. Profil public ou privé : ce que les autres voient",
    intro: "La visibilité du profil et celle de chaque liste sont deux réglages distincts.",
    steps: [
      "Dans Mon profil, renseignez votre nom, votre photo, votre présentation et votre anniversaire, puis enregistrez.",
      "Choisissez un profil public pour permettre à une personne qui vous connaît peu de découvrir vos idées publiques, par exemple pour un anniversaire ou une fête.",
      "Pour cela, rendez aussi au moins une liste publique. Un profil public avec uniquement des listes privées ne fournit pas d’idées consultables aux visiteurs.",
      "Gardez un profil privé si vous préférez autoriser les personnes qui le consultent. Un cercle commun permet aussi d’accéder au profil, en respectant les réglages propres à chaque liste.",
    ],
    notes: [
      "Rendre votre profil public ne rend pas vos contacts ni vos cercles publics. Chaque personne décide de sa propre visibilité.",
      "Les comptes confirmés sont trouvables dans Communauté, même si leur profil est privé. Une fiche privée verrouillée ne donne pas accès à son contenu.",
    ],
  },
  {
    id: "communaute",
    title: "7. Retrouver quelqu’un dans Communauté",
    intro: "L’annuaire sert à retrouver les comptes et à demander l’accès à un profil privé.",
    steps: [
      "Ouvrez Communauté, puis recherchez un nom, une partie du nom ou un identifiant, avec ou sans @.",
      "Touchez une fiche accessible pour ouvrir le profil et ses listes visibles pour vous.",
      "Pour un profil privé verrouillé, utilisez Connexion pour demander l’accès. La personne peut accepter ou refuser depuis ses demandes reçues.",
      "Pour écrire, touchez la bulle sur la fiche, ou le bouton Écrire à côté de Partager sur le profil.",
    ],
    notes: [
      "Être connecté au profil d’une personne ne dévoile pas ses relations. Cela n’ouvre pas ses listes personnelles ni celles réservées à d’autres cercles.",
      "Une demande d’accès au profil et une demande de conversation sont deux choses différentes : autoriser l’une n’autorise pas automatiquement l’autre.",
    ],
  },
  {
    id: "listes",
    title: "8. Créer des listes et choisir leur confidentialité",
    intro:
      "Une liste peut être publique, réservée à des cercles ou personnelle, même lorsque votre profil est public.",
    steps: [
      "Ouvrez Mes listes et créez une liste. Donnez-lui un titre et complétez l’occasion ou la date si nécessaire.",
      "Choisissez Privée — uniquement moi pour vos idées personnelles : les autres ne voient ni cette liste ni son contenu.",
      "Choisissez Cercles, puis sélectionnez précisément les cercles autorisés à voir cette liste.",
      "Choisissez Publique pour permettre la consultation par tous. Les visiteurs doivent se connecter pour réserver un cadeau.",
      "Enregistrez, puis vérifiez le réglage de chacune de vos listes. Les nouvelles listes sont personnelles par défaut.",
    ],
    notes: [
      "Exemple : Anniversaire en Publique, Noël en Cercles pour la famille, Mes idées personnelles en Privée.",
      "Un lien de partage valide peut ouvrir les listes sélectionnées pour ce lien. Une liste Privée — uniquement moi reste inaccessible aux autres, même avec un ancien lien.",
      "Passer une liste en Privée retire ses accès par cercle et ses sélections de partage. Pour la repartager ensuite, vérifiez de nouveau ses réglages.",
    ],
  },
  {
    id: "cadeaux",
    title: "9. Ajouter un cadeau ou importer un lien produit",
    intro:
      "Vous pouvez saisir une idée vous-même ou utiliser le lien d’un article pour préremplir la fiche.",
    steps: [
      "Dans la liste souhaitée, touchez + pour ajouter un cadeau. Choisissez sa catégorie et renseignez son nom.",
      "Pour un produit en ligne, collez le lien du produit dans Lien, puis touchez Récupérer et attendez le résultat.",
      "Vérifiez le nom, la photo, le prix et la description. Certains vendeurs limitent la récupération : complétez les champs manuellement si nécessaire.",
      "Sur Amazon, vérifiez la couleur et la taille, et choisissez la variante proposée lorsqu’un choix est disponible.",
      "Ajoutez les précisions utiles : taille, couleur, référence, priorité, photo et prix, puis enregistrez le cadeau.",
    ],
    notes: [
      "Changer le lien retire les anciennes valeurs importées ; vos modifications manuelles sont conservées. Vérifiez toujours la fiche avant d’enregistrer.",
      "Le prix est indicatif. Vérifiez le prix, le vendeur et la variante sur le site marchand avant d’acheter.",
    ],
  },
  {
    id: "offrir",
    title: "10. Réserver, acheter et garder la surprise",
    intro:
      "La réservation évite qu’un autre proche achète le même cadeau. Elle ne commande pas le produit.",
    steps: [
      "Ouvrez une liste accessible d’un proche depuis son profil ou votre cercle.",
      "Choisissez le cadeau que vous souhaitez offrir et réservez-le.",
      "Les autres visiteurs autorisés voient qu’il est réservé pour éviter les doublons. Le propriétaire de la liste ne voit ni la réservation ni l’identité de la personne qui offre.",
      "Dans J’offre, retrouvez vos réservations. Indiquez qu’un cadeau est acheté après votre achat chez le vendeur.",
      "Si vous changez d’avis, annulez la réservation pour permettre à un autre proche de choisir ce cadeau.",
    ],
    notes: [
      "Vous ne pouvez pas réserver votre propre cadeau.",
      "Pour discuter d’un cadeau à plusieurs sans prévenir son destinataire, créez un groupe de conversation en décochant cette personne.",
    ],
  },
  {
    id: "cercles",
    title: "11. Créer, rejoindre et inviter dans un cercle",
    intro: "Un cercle est un groupe privé de proches, par exemple Famille, Amis ou Collègues.",
    steps: [
      "Dans Cercles, choisissez Créer un cercle et donnez-lui un nom.",
      "Pour rejoindre un cercle existant, choisissez Rejoindre avec un code et saisissez le code transmis par un administrateur.",
      "L’administrateur retrouve le code sur la page du cercle. Il peut le copier, le renouveler et gérer les membres.",
      "Après avoir rejoint un cercle, chaque personne choisit les listes qu’elle souhaite partager avec ce cercle.",
      "Pour inviter quelqu’un qui n’a pas encore l’application, utilisez l’invitation à Gift-Plan, puis transmettez aussi le code du cercle si vous souhaitez l’y accueillir.",
    ],
    notes: [
      "Une invitation à installer Gift-Plan ne fait pas entrer automatiquement dans un cercle.",
      "Seuls les membres ont accès à la composition du cercle. Le statut public d’un membre ne rend pas le cercle public.",
    ],
  },
  {
    id: "messages-prives",
    title: "12. Écrire en privé à une personne",
    intro: "Les conversations directes sont visibles uniquement par leurs deux participants.",
    steps: [
      "Dans Communauté, touchez la bulle sur une fiche. Vous pouvez aussi ouvrir le profil puis toucher Écrire, ou écrire depuis la fiche d’un membre de cercle.",
      "Saisissez votre texte dans Votre message et touchez Envoyer. Chaque message peut contenir jusqu’à 2 000 caractères.",
      "Si vous avez un cercle commun, l’échange peut commencer directement.",
      "Sans cercle commun, votre premier message est une demande de conversation. Attendez l’acceptation avant de poursuivre. La personne reçoit les choix Accepter ou Refuser.",
      "Retrouvez vos échanges avec la bulle Messages en haut de votre espace. Les nouveaux messages s’actualisent automatiquement quand la page est ouverte.",
    ],
    notes: [
      "Demande envoyée signifie que le premier message est transmis et que vous attendez une réponse à la demande.",
      "Si une demande est refusée, cet échange n’accepte plus de nouveaux messages. Si un échange est bloqué, aucun nouveau message ne peut être envoyé dans les deux sens.",
      "Les messages ne donnent aucun accès supplémentaire aux profils, aux contacts ou aux listes. Les compteurs de nouveaux messages sont dans l’application : ouvrez-la pour les consulter.",
    ],
  },
  {
    id: "groupes-surprises",
    title: "13. Écrire au cercle en excluant des personnes",
    intro:
      "Créez un échange à plusieurs pour préparer un cadeau commun ou une surprise. Vous choisissez exactement qui peut le voir.",
    steps: [
      "Ouvrez Cercles, puis le cercle concerné, et touchez Écrire au cercle.",
      "Donnez un nom à la conversation. Décochez la ou les personnes qui ne doivent pas participer, par exemple le destinataire de la surprise. Vous restez toujours inclus.",
      "Choisissez entre 2 et 50 participants, vous compris, puis touchez Vérifier avant de créer.",
      "Relisez les deux listes : Participants et Personnes exclues. Si nécessaire, utilisez Modifier la sélection.",
      "Touchez Créer avec ces participants. Cette étape crée l’échange sans envoyer de premier message.",
      "Vérifiez les participants affichés dans la conversation, écrivez votre texte puis touchez Envoyer au groupe.",
      "Retrouvez le groupe dans Messages → Groupes et surprises. Messages précédents permet de relire un historique plus long.",
    ],
    notes: [
      "Les personnes décochées ne voient ni la conversation, ni son titre, ni ses messages et ne reçoivent pas de notification pour cet échange.",
      "Les participants sont fixés à la création. Pour changer la sélection ou inclure une nouvelle personne, créez une autre conversation en vérifiant de nouveau les participants.",
      "Rejoindre le cercle plus tard ne donne pas accès aux groupes déjà créés. Quitter le cercle retire l’accès à ses groupes ; revenir dans le cercle ne rétablit pas cet accès.",
      "Quitter la conversation retire aussi l’accès à son historique. Un blocage entre vous et un participant peut empêcher vos envois dans ce groupe ; vous pouvez débloquer cette personne ou quitter l’échange.",
    ],
  },
  {
    id: "securite",
    title: "14. Bloquer, signaler et gérer ses données",
    intro: "Gardez le contrôle de vos échanges et de vos informations personnelles.",
    steps: [
      "Dans une conversation privée, utilisez Bloquer cette personne pour empêcher les nouveaux envois dans les deux sens. L’historique reste disponible.",
      "Dans un groupe, utilisez Bloquer à côté d’un participant. Si vous l’avez vous-même bloqué, le bouton Débloquer permet d’annuler ce blocage.",
      "Pour signaler un message reçu, touchez Signaler, expliquez le motif, puis confirmez la transmission.",
      "Dans Mon compte, utilisez Télécharger mon export (JSON) pour récupérer vos données et les messages auxquels vous avez accès.",
      "Pour supprimer votre compte, suivez la confirmation proposée dans Mon compte. Cette action supprime vos données et peut entraîner le transfert ou la suppression des cercles que vous avez créés.",
    ],
    notes: [
      "Un signalement transmet à l’administration uniquement le message concerné, son auteur, votre identifiant et votre motif ; il n’ouvre pas toute la conversation.",
      "La suppression d’un compte retire ses échanges directs. Dans un groupe, ses messages et sa participation sont supprimés ; les autres participants conservent leur échange. Supprimer le cercle supprime ses conversations de groupe.",
    ],
  },
  {
    id: "depannage",
    title: "15. Résoudre les difficultés courantes",
    intro: "Quelques vérifications utiles avant de recommencer une action.",
    steps: [
      "Un bouton récent manque : actualisez la page ou fermez puis rouvrez l’application pour charger la dernière version.",
      "Vous ne pouvez pas écrire depuis un profil : vérifiez que vous êtes connecté et que ce n’est pas votre propre profil. Le bouton Écrire se trouve à côté de Partager.",
      "Vous voyez Demande envoyée : attendez l’acceptation de l’autre personne avant de continuer.",
      "Une liste manque : vérifiez sa visibilité, les cercles choisis et vos accès. Une liste personnelle reste invisible aux autres, même si le profil est public.",
      "Un groupe manque : seuls les participants sélectionnés peuvent le voir. Être membre du même cercle ne suffit pas.",
      "Un lien produit se remplit mal : vérifiez le lien et la variante, puis corrigez les champs manuellement avant d’enregistrer.",
      "Un email manque : vérifiez l’adresse du compte et les indésirables. Utilisez le dernier lien reçu.",
      "Un message signale trop de tentatives : patientez avant de réessayer. Ces limites protègent les comptes contre les envois répétés.",
    ],
    notes: [
      "Si le problème persiste, notez la page concernée, les étapes suivies et le texte exact de l’erreur. Ne transmettez jamais votre mot de passe ni un lien de réinitialisation.",
    ],
  },
];
export function guideSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function findGuideChapters(query: string) {
  const terms = guideSearchText(query).split(/\s+/).filter(Boolean);
  return USER_GUIDE.filter((chapter) => {
    const text = guideSearchText(
      [chapter.title, chapter.intro, ...chapter.steps, ...(chapter.notes ?? [])].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
}
