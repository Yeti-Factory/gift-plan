# Migration autonome de Gift-Plan

Cette cible remplace Lovable Cloud et Supabase par des services possédés et hébergés sur le VPS :

- PostgreSQL privé dans Coolify ;
- Better Auth dans l'application TanStack Start ;
- Resend pour la confirmation d'adresse et la réinitialisation du mot de passe ;
- volume persistant `/data/uploads` pour les avatars et images de cadeaux.

## Stratégie sans interruption

1. Déployer le socle autonome sur une URL de test et appliquer `selfhost/migrations/*.sql`.
2. Exporter les tables Lovable Cloud au format CSV et télécharger les deux espaces de stockage.
3. Importer les comptes, profils et données en conservant tous les UUID.
4. Demander aux comptes existants de définir un nouveau mot de passe : les anciens mots de passe ne sont pas exportables.
5. Basculer les écrans un par un vers l'API serveur, puis faire une répétition complète de la migration.
6. Pendant une courte maintenance, refaire l'export final, vérifier les totaux et basculer le domaine.
7. Conserver l'ancien backend en lecture seule le temps de valider sauvegardes et restauration.

## Export attendu

Lovable Cloud exporte les tables une par une en CSV. Place les fichiers disponibles dans un même dossier en conservant le nom des tables, par exemple `profiles.csv`, `lists.csv` et `gifts.csv`.

Le fichier `users.csv` est obligatoire car les profils publics ne contiennent pas les adresses email de connexion. Son format est fourni dans `selfhost/users.example.csv`. Les mots de passe ne doivent jamais y figurer : après l'import, la procédure « mot de passe oublié » crée de façon sûre le premier mot de passe Better Auth.

Avant l'import réel, effectuer une répétition transactionnelle :

```sh
bun run selfhost:import --dir /chemin/exports --dry-run
bun run selfhost:import --dir /chemin/exports
bun run selfhost:verify
```

## Contrôles

`GET /api/public/self-hosted-ready` ne renvoie aucun secret. Il répond `200` uniquement lorsque la configuration autonome est complète et que PostgreSQL répond, sinon `503` avec la liste des éléments manquants.

La base n'est jamais publiée sur un port hôte. Toutes les autorisations métier seront contrôlées par les routes serveur ; le navigateur n'obtiendra aucune chaîne de connexion PostgreSQL.
