import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Gift-Plan" },
      { name: "description", content: "Comment Gift-Plan collecte, utilise et protège vos données personnelles." },
      { property: "og:title", content: "Politique de confidentialité — Gift-Plan" },
      { property: "og:description", content: "Comment Gift-Plan collecte, utilise et protège vos données personnelles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="18 juillet 2026">
      <p>
        Cette page est maintenue par Yeti Factory SARL et décrit comment Gift-Plan collecte et utilise
        vos données personnelles, conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.
      </p>

      <h2 className="text-lg font-semibold mt-6">Responsable de traitement</h2>
      <p>
        Yeti Factory SARL, 18bis route de Bû, 78550 Houdan, France —{" "}
        <a href="mailto:office@yeti-factory.com" className="text-primary underline">office@yeti-factory.com</a>.
      </p>

      <h2 className="text-lg font-semibold mt-6">Données collectées</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Compte</strong> : adresse email, mot de passe (chiffré), nom d'affichage.</li>
        <li><strong>Contenu que vous créez</strong> : cercles, listes de cadeaux, titres, liens, notes, images téléversées, réservations.</li>
        <li><strong>Journaux techniques</strong> : adresse IP, journaux d'accès et d'erreurs, strictement pour la sécurité et le débogage.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Finalités et bases légales</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Fournir le service (exécution du contrat) : gérer votre compte, vos cercles, vos listes et vos réservations.</li>
        <li>Sécurité et prévention des abus (intérêt légitime) : rate-limiting, détection des tentatives d'intrusion.</li>
        <li>Communication de service (exécution du contrat) : emails de confirmation et de réinitialisation de mot de passe.</li>
      </ul>
      <p>
        Aucune donnée n'est utilisée à des fins publicitaires. Aucun traceur publicitaire tiers n'est déposé.
      </p>

      <h2 className="text-lg font-semibold mt-6">Sous-traitants et transferts</h2>
      <p>Les données sont traitées par :</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>OVH SAS</strong> (France) — hébergement de l'application.</li>
        <li><strong>Supabase</strong> (via Lovable Cloud) — base de données, authentification, stockage des images.</li>
        <li><strong>Resend</strong> — envoi des emails transactionnels.</li>
        <li><strong>Lovable AI</strong> — récupération d'aperçus produits depuis les liens que vous ajoutez.</li>
      </ul>
      <p>
        Certains sous-traitants peuvent traiter des données hors Union européenne. Ces transferts sont
        encadrés par les clauses contractuelles types de la Commission européenne.
      </p>

      <h2 className="text-lg font-semibold mt-6">Durée de conservation</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Compte et contenus : tant que votre compte est actif. La suppression de votre compte
          (depuis l'onglet « Compte ») entraîne l'effacement immédiat de vos données personnelles
          et le transfert ou la suppression des cercles dont vous êtes créateur.</li>
        <li>Journaux techniques : 12 mois maximum.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition
        et de portabilité. Vous pouvez exercer ces droits en écrivant à{" "}
        <a href="mailto:office@yeti-factory.com" className="text-primary underline">office@yeti-factory.com</a>.
        En cas de désaccord, vous pouvez introduire une réclamation auprès de la{" "}
        <a href="https://www.cnil.fr" className="text-primary underline" rel="noreferrer" target="_blank">CNIL</a>.
      </p>

      <h2 className="text-lg font-semibold mt-6">Cookies</h2>
      <p>
        Gift-Plan utilise uniquement du stockage local (localStorage) strictement nécessaire au
        maintien de votre session. Aucun cookie de mesure d'audience ou de publicité n'est déposé.
      </p>

      <h2 className="text-lg font-semibold mt-6">Sécurité</h2>
      <p>
        L'accès à vos données est restreint par des règles de sécurité au niveau de la base (Row Level
        Security). Les mots de passe sont hachés par Supabase Auth. Les images sont accessibles uniquement
        via des URLs signées à durée limitée.
      </p>
    </LegalLayout>
  );
}