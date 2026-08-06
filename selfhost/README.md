# Hébergement autonome de Gift-Plan

Gift-Plan fonctionne sans service Lovable ni Supabase :

- PostgreSQL privé dans Coolify ;
- Better Auth dans l'application TanStack Start ;
- Resend pour la confirmation d'adresse et la réinitialisation du mot de passe ;
- volume persistant `/data/uploads` pour les avatars et les images de cadeaux.

## Déploiement Coolify

1. Créer une ressource Docker Compose depuis ce dépôt et sélectionner la branche de production.
2. Copier les variables de `selfhost/env.example` dans Coolify et remplacer toutes les valeurs d'exemple.
3. Utiliser le même mot de passe PostgreSQL, encodé pour une URL, dans `POSTGRES_PASSWORD` et `DATABASE_URL`.
4. Attacher le domaine `https://gift-plan.yeti-lab.fr` au service `app`, port `3000`, puis activer HTTPS.
5. Déployer. Le service `migrate` applique automatiquement les migrations avant le démarrage de l'application.
6. Vérifier `GET /api/public/health` et `GET /api/public/self-hosted-ready` avant de tester inscription, connexion, création et suppression d'un cadeau.

Le domaine pointe déjà vers le VPS : aucun changement DNS n'est requis tant que Coolify reste sur `51.210.245.159`.

## Import des données historiques

Exporter les tables de l'ancien backend au format CSV et télécharger les espaces de stockage. Placer les fichiers CSV dans un même dossier en conservant les noms des tables, par exemple `profiles.csv`, `lists.csv` et `gifts.csv`.

Le fichier `users.csv` est obligatoire, car les profils publics ne contiennent pas les adresses de connexion. Son format est fourni dans `selfhost/users.example.csv`. Les anciens mots de passe ne sont jamais exportables : après import, les utilisateurs utilisent « Mot de passe oublié » pour définir leur premier mot de passe Better Auth.

Faire d'abord une répétition transactionnelle, puis l'import réel :

```sh
bun run selfhost:import --dir /chemin/exports --dry-run
bun run selfhost:import --dir /chemin/exports
bun run selfhost:verify
```

Copier ensuite les objets de l'ancien espace `profile-avatars` dans `/data/uploads/avatars` et ceux de `gift-images` dans `/data/uploads/gifts`, sans modifier leurs chemins relatifs.

## Bascule sans perte

1. Déployer sur une URL de test et valider la migration complète.
2. Afficher une courte maintenance sur l'ancienne version.
3. Refaire l'export final, importer les données et les fichiers, puis comparer les totaux avec `bun run selfhost:verify`.
4. Basculer le domaine vers le nouveau service Coolify.
5. Conserver l'ancien backend en lecture seule jusqu'à validation des sauvegardes et de la restauration.

## Nettoyage et sauvegardes

Programmer dans Coolify une requête HTTP quotidienne :

```sh
curl -fsS -X POST \
  -H "Authorization: Bearer $STORAGE_CLEANUP_SECRET" \
  https://gift-plan.yeti-lab.fr/api/public/hooks/purge-storage
```

Activer une sauvegarde quotidienne du volume PostgreSQL et du volume `gift_plan_uploads`, avec une rétention d'au moins 14 jours. Effectuer un test de restauration avant la bascule définitive.

La base ne publie aucun port sur l'hôte. Les autorisations métier sont contrôlées côté serveur ; le navigateur ne reçoit jamais la chaîne de connexion PostgreSQL.
