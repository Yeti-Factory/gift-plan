import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/legal/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — Gift-Plan" },
      { name: "description", content: "Conditions générales d'utilisation du service Gift-Plan." },
      { property: "og:title", content: "CGU — Gift-Plan" },
      { property: "og:description", content: "Conditions générales d'utilisation du service Gift-Plan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CGU,
});

function CGU() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updated="18 juillet 2026">
      <h2 className="text-lg font-semibold mt-6">1. Objet</h2>
      <p>
        Les présentes CGU régissent l'utilisation de Gift-Plan, service en ligne permettant de créer
        et partager des listes de cadeaux au sein de cercles privés (famille, amis).
      </p>

      <h2 className="text-lg font-semibold mt-6">2. Accès au service</h2>
      <p>
        Le service est actuellement fourni gratuitement. Une offre payante (« Premium ») pourra être
        proposée ultérieurement ; ses conditions seront communiquées avant toute souscription.
        L'accès requiert la création d'un compte avec une adresse email valide.
      </p>

      <h2 className="text-lg font-semibold mt-6">3. Compte utilisateur</h2>
      <p>
        Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité effectuée
        depuis votre compte. Vous pouvez supprimer votre compte à tout moment depuis l'onglet « Compte ».
      </p>

      <h2 className="text-lg font-semibold mt-6">4. Contenu publié par les utilisateurs</h2>
      <p>
        Vous conservez la propriété des contenus que vous publiez (titres, notes, images, liens).
        Vous garantissez disposer des droits nécessaires et vous engagez à ne publier aucun contenu
        illicite, diffamatoire, contraire aux droits d'autrui ou à la loi française.
      </p>
      <p>
        Vous accordez à Yeti Factory SARL une licence non exclusive, limitée à l'hébergement et
        l'affichage de ces contenus dans le cadre du fonctionnement du service.
      </p>

      <h2 className="text-lg font-semibold mt-6">5. Cercles et modération</h2>
      <p>
        Chaque cercle est administré par son créateur, qui peut nommer d'autres administrateurs.
        Les administrateurs peuvent inviter, retirer ou promouvoir des membres. Yeti Factory SARL
        n'intervient pas dans la modération interne des cercles, sauf en cas de contenu manifestement
        illicite signalé à{" "}
        <a href="mailto:office@yeti-factory.com" className="text-primary underline">office@yeti-factory.com</a>.
      </p>

      <h2 className="text-lg font-semibold mt-6">6. Disponibilité</h2>
      <p>
        Le service est fourni « en l'état ». Yeti Factory SARL met en œuvre les moyens raisonnables
        pour assurer la disponibilité et la sécurité du service, sans garantie de continuité absolue.
        Des interruptions pour maintenance ou raison technique sont possibles.
      </p>

      <h2 className="text-lg font-semibold mt-6">7. Responsabilité</h2>
      <p>
        Dans les limites autorisées par la loi, la responsabilité de Yeti Factory SARL ne saurait être
        engagée pour des dommages indirects, ni pour la perte de contenus résultant de la suppression
        d'un compte par son utilisateur.
      </p>

      <h2 className="text-lg font-semibold mt-6">8. Résiliation</h2>
      <p>
        Vous pouvez cesser d'utiliser le service à tout moment et supprimer votre compte.
        Yeti Factory SARL peut suspendre ou résilier un compte en cas de violation des présentes CGU,
        après notification lorsque cela est possible.
      </p>

      <h2 className="text-lg font-semibold mt-6">9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la{" "}
        <a href="/legal/confidentialite" className="text-primary underline">politique de confidentialité</a>.
      </p>

      <h2 className="text-lg font-semibold mt-6">10. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. En cas de litige et à défaut de solution
        amiable, les tribunaux français seront seuls compétents.
      </p>

      <h2 className="text-lg font-semibold mt-6">11. Modifications</h2>
      <p>
        Yeti Factory SARL peut modifier les présentes CGU. Les changements substantiels seront
        notifiés dans l'application. La poursuite de l'utilisation vaut acceptation.
      </p>
    </LegalLayout>
  );
}