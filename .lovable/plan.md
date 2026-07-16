## Gift-Box — MVP

Appli PWA mobile-first de listes de cadeaux collaboratives (React + TanStack Start + Tailwind + shadcn/ui + Lovable Cloud/Supabase). Interface en français.

### Étape 1 — Backend (Lovable Cloud)

Activation de Lovable Cloud, puis migration SQL avec RLS stricte :

- `profiles` (id → auth.users, display_name, avatar_url) + trigger auto-création à l'inscription.
- `circles` (name, invite_code unique 6 char, created_by).
- `circle_members` (circle_id, user_id, role).
- `lists` (owner_id, circle_id, title, occasion, event_date).
- `gifts` (list_id, owner_id, title, description, url, image_url, price, currency, priority enum).
- `reservations` (gift_id, buyer_id, status enum, created_at) + **index unique partiel** sur `gift_id` où `status IN ('reserved','purchased')` → garantit atomicité (un seul acheteur).

**RLS — protection surprise :**
- Fonction SECURITY DEFINER `is_circle_member(circle_id, user_id)` pour éviter la récursion.
- `gifts` : SELECT si membre du cercle de la liste.
- `reservations` : SELECT uniquement si `buyer_id = auth.uid()` OU (membre du cercle ET `gift.owner_id != auth.uid()`). Le propriétaire ne peut JAMAIS lire les réservations de ses propres cadeaux.
- INSERT/UPDATE/DELETE scopés au propriétaire ou à l'acheteur selon le cas.
- GRANTs explicites `TO authenticated` sur chaque table.

Bucket Storage `gift-images` (public) pour photos.

### Étape 2 — Auth

- Page `/auth` : magic link email + Google (via broker Lovable).
- Layout `_authenticated` géré par l'intégration (déjà en place).
- Listener `onAuthStateChange` dans `__root.tsx`.

### Étape 3 — Écrans (toutes routes gated sous `_authenticated/` sauf `/auth`)

- `/` (publique) → redirige vers `/circles` si connecté, sinon `/auth`.
- `/circles` : mes cercles, boutons Créer / Rejoindre (via code).
- `/circles/$id` : membres du cercle avec avatars, code d'invitation à partager.
- `/circles/$id/members/$userId` : listes + cadeaux d'un membre. Cadeaux réservés grisés + nom offreur (sauf sur ma propre liste). Boutons « Je l'offre » / « Je l'ai acheté » / annuler.
- `/my-lists` : mes listes, édition, ajout/suppression cadeaux. Ajout par lien (fetch OG côté serveur) OU manuel + upload photo. Préservation du scroll après ajout (optimistic update via React Query).
- `/gifts-i-offer` : récap de mes réservations, total dépensé.

### Étape 4 — Temps réel

- Abonnement Supabase Realtime sur `gifts` et `reservations` filtrés par cercle, invalidation React Query ciblée.
- Réservation atomique via INSERT ; conflit unique → toast « déjà réservé ».
- Notif in-app (toast) sur INSERT `gifts` : « X a ajouté "titre" à sa liste ».

### Étape 5 — Aperçu de lien

Server function `fetchLinkPreview` (createServerFn) : fetch HTML, parse OG tags (title, image, price via meta `product:price:amount`). Fallback saisie manuelle si échec.

### Étape 6 — PWA

- `public/manifest.webmanifest` (nom, icônes 192/512, theme color, display standalone).
- Icônes générées via imagegen (gift box festif).
- Tags `<link rel="manifest">`, `apple-touch-icon`, `theme-color` dans `__root.tsx`.
- **Pas de service worker** au MVP (installabilité manifest-only, conforme aux règles PWA du template). Notifications push différées en phase 2.

### Étape 7 — Design system

Palette festive et chaleureuse : primaire corail/framboise, accents doré + turquoise, fond crème. Coins très arrondis (2xl), ombres douces, micro-animations Tailwind (`transition`, `hover:scale`). Tokens définis dans `src/styles.css` (oklch). Composants shadcn : Button, Card, Dialog, Input, Badge (priorités), Avatar, Sheet (mobile actions).

### Détails techniques

- Toutes les lectures/écritures via `createServerFn` + `requireSupabaseAuth` OU client browser Supabase pour realtime.
- React Query pour cache + invalidation ; scroll préservé via mise à jour optimiste (pas de refetch qui remonte la liste).
- Enum Postgres pour `priority` (`indispensable`, `j_adorerais`, `me_plairait`) et `reservation_status`.
- Total liste calculé côté client (somme prix).

### Phase 2 (hors scope MVP)

Multi-listes/occasions avec compte à rebours, tri/filtres, cagnottes, Père Noël secret, suivi prix, push notifications — implémentés un par un après validation.

Je démarre par activer Lovable Cloud puis j'enchaîne migration + écrans. Confirmes-tu le lancement ?