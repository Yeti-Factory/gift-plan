import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Gift-Plan" },
      { name: "description", content: "Éditeur, hébergement et contact du service Gift-Plan." },
      { property: "og:title", content: "Mentions légales — Gift-Plan" },
      {
        property: "og:description",
        content: "Éditeur, hébergement et contact du service Gift-Plan.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MentionsLegales,
});

function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" updated="18 juillet 2026">
      <p>
        Cette page présente les informations légales relatives au service Gift-Plan, conformément à
        l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie
        numérique.
      </p>

      <h2 className="text-lg font-semibold mt-6">Éditeur</h2>
      <p>
        Gift-Plan est édité par <strong>Yeti Lab</strong>, marque commerciale de{" "}
        <strong>Yeti Factory SARL</strong>.
        <br />
        Siège social : 18bis route de Bû, 78550 Houdan, France.
        <br />
        Contact :{" "}
        <a href="mailto:office@yeti-factory.com" className="text-primary underline">
          office@yeti-factory.com
        </a>
        <br />
        Directeur de la publication : Yovan Nalovic.
      </p>

      <h2 className="text-lg font-semibold mt-6">Hébergement</h2>
      <p>
        L'application est hébergée par <strong>OVH SAS</strong>, 2 rue Kellermann, 59100 Roubaix,
        France (
        <a
          href="https://www.ovhcloud.com"
          className="text-primary underline"
          rel="noreferrer"
          target="_blank"
        >
          ovhcloud.com
        </a>
        ).
      </p>

      <h2 className="text-lg font-semibold mt-6">Sous-traitants techniques</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Supabase</strong> (via Lovable Cloud) — base de données, authentification,
          stockage des images.
        </li>
        <li>
          <strong>Resend</strong> — envoi des emails transactionnels (confirmation, réinitialisation
          de mot de passe).
        </li>
        <li>
          <strong>Lovable AI</strong> — récupération des aperçus produits (image et titre) à partir
          des liens ajoutés.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments du service (marque, interface, code) est la propriété de Yeti
        Factory SARL, sauf mention contraire. Toute reproduction non autorisée est interdite.
      </p>

      <h2 className="text-lg font-semibold mt-6">Signalement</h2>
      <p>
        Pour signaler un contenu illicite ou un problème de sécurité, écrivez à{" "}
        <a href="mailto:office@yeti-factory.com" className="text-primary underline">
          office@yeti-factory.com
        </a>
        .
      </p>
    </LegalLayout>
  );
}
