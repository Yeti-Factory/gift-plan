# Plan de sécurisation Gift-Plan

Travail par phases. Ce plan détaille **Phase 1** (à implémenter maintenant après validation) et donne un survol des phases suivantes pour cadrage. Chaque phase se termine par des vérifications et un compte rendu avant la suivante.

---

## PHASE 1 — Bloquants de sécurité (à implémenter maintenant)

### 1.1 Adhésion aux cercles verrouillée

**Nouvelle migration** (non destructive, aucune migration existante touchée) :

- `REVOKE INSERT ON public.circle_members FROM authenticated;` (le rôle `service_role` et les fonctions `SECURITY DEFINER` conservent l'accès).
- `DROP POLICY IF EXISTS cm_insert_self ON public.circle_members;` (remplacée : plus d'INSERT direct).
- Ajout d'une table `public.circle_bans (circle_id, user_id, banned_at, banned_by)` avec RLS lisible admins uniquement. `remove_member` insère une ligne.
- Réécriture de `public.join_circle(_code)` et `public.join_circle_by_code(_code)` :
  - vérifie `auth.uid()`, normalise le code (upper+trim),
  - rejette si `circle_bans` contient l'utilisateur,
  - rejette si le code est expiré (`expires_at`) ou révoqué (`revoked_at`),
  - insère en `circle_members` via SECURITY DEFINER.
- `REVOKE EXECUTE ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated` sur toutes les fonctions SECURITY DEFINER touchées ; `SET search_path = public` déjà présent, vérifié partout.
- Le trigger `_circles_after_insert` continue d'insérer le créateur comme admin (SECURITY DEFINER, bypass RLS).

### 1.2 Audit + correction RLS complète

Nouvelle migration qui remplace les policies existantes par des versions renforcées (via `DROP POLICY IF EXISTS` puis `CREATE POLICY`, tables et colonnes inchangées) :

- **profiles** : SELECT réservé aux profils partageant au moins un cercle avec `auth.uid()` (nouveau helper `public.shares_circle_with(_a uuid, _b uuid)` SECURITY DEFINER) + son propre profil.
- **circles** : SELECT réservé aux membres actuels (déjà OK, vérifié). UPDATE/DELETE réservés à `is_circle_admin`.
- **circle_members** : DELETE réservé aux admins via RPC ; UPDATE bloqué en direct.
- **lists** : ALL policies exigent `is_circle_member(circle_id, auth.uid())` **actuel** + `owner_id = auth.uid()` pour write. Un ex-membre perd tout accès.
- **gifts** : INSERT/UPDATE contrôlent que la liste cible appartient à `auth.uid()` ET que `owner_id = auth.uid()` ET que la liste est dans un cercle où l'utilisateur est membre. Un trigger `BEFORE INSERT/UPDATE` force `owner_id := (SELECT owner_id FROM lists WHERE id = NEW.list_id)` pour empêcher toute manipulation.
- **reservations** :
  - INSERT : `buyer_id = auth.uid()` + acheteur membre actuel + acheteur ≠ propriétaire du cadeau.
  - UPDATE : `gift_id` immuable (trigger `BEFORE UPDATE` qui rejette le changement), buyer_id immuable.
  - SELECT : la policy "surprise" est préservée (le propriétaire ne voit jamais les réservations de ses propres cadeaux — vérifié via `gift_owner_id(gift_id) <> auth.uid()`).
- **circle_activity** : SELECT membres actuels uniquement ; INSERT réservé aux fonctions SECURITY DEFINER (révoquer INSERT direct).
- **storage.objects (bucket gift-images)** : policies déjà présentes vérifiées ; chemin `<uid>/...` obligatoire.

### 1.3 SSRF dans `gift-scrape.functions.ts`

Réécriture complète :

- Parse URL : rejette si `protocol ∉ {http,https}`, si `username`/`password` présents.
- `dns.promises.lookup(host, { all: true })` → rejette toute IP dans : `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (dont `169.254.169.254`), `100.64/10`, `0.0.0.0/8`, IPv6 `::1`, `fc00::/7`, `fe80::/10`, multicast, réservé.
- Fetch avec `redirect: "manual"`, boucle max 3 redirections, re-validation URL+DNS à chaque saut.
- `AbortController` timeout 5 s total.
- Lecture streamée : `response.body.getReader()` accumulant octets, abort dès > 1 Mo (jamais `res.text()` global).
- `Content-Type` doit commencer par `text/html` ou `application/xhtml+xml`.
- Rate limit par `context.userId` : table `public.scrape_rate_limit(user_id, window_start, count)` + fonction SQL atomique (10 req / 5 min).
- Erreurs utilisateur : `{ ok: false }` générique. Détails via `console.error` avec `request_id`.
- Tests Vitest ajoutés (`src/lib/gift-scrape.functions.test.ts`) : localhost, 10.0.0.1, redirection 302 → 169.254.169.254, réponse 2 Mo, timeout 6 s, mauvais content-type, credentials in URL.

### 1.4 Authentification du webhook email

`src/routes/lovable/email/auth/webhook.ts` :

- Vérification signature HMAC avant tout parse métier :
  - Header attendu `X-Lovable-Signature` (broker officiel Lovable) **ou** `X-Webhook-Signature` (fallback secret dédié `AUTH_EMAIL_WEBHOOK_SECRET`).
  - Lecture body **brut** (`await request.text()`) une seule fois avant JSON.parse.
  - `crypto.timingSafeEqual` sur `sha256` hex du body.
  - Rejet 401 si header absent/invalide, sans envoi.
- Idempotence : cache en mémoire + `Idempotency-Key` Resend (`run_id`), déjà partiel — renforcé avec table `public.email_webhook_seen(run_id, seen_at)` (TTL 24 h) pour survivre aux redémarrages.
- Rate limit IP (10/min) via table `public.webhook_rate_limit`.
- Aucun log du `token`, `token_hash`, `url` complet, ni du corps du mail.
- Nouveau secret via `secrets--generate_secret` : `AUTH_EMAIL_WEBHOOK_SECRET` (64 chars).
- Test : POST sans signature → 401, avec mauvaise signature → 401, avec bonne signature → 200 (mock Resend).

### 1.5 Renforcement des invitations

Nouvelle migration :

- Ajout colonnes `public.circles.invite_code_created_at`, `invite_code_expires_at` (défaut `now() + interval '30 days'`), `invite_code_revoked_at`.
- `gen_invite_code()` réécrite : `encode(gen_random_bytes(8), 'base32')` filtré alphabet non ambigu (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), longueur 12. Rétrocompat : les codes 6-hex existants restent valides jusqu'à expiration/régénération.
- `regenerate_invite_code` : positionne `invite_code_revoked_at = old_created_at_effective` puis remplace.
- `join_circle*` : vérifie `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
- Table `public.join_attempts(user_id, attempted_at)` → RPC `join_circle` compte 5 tentatives / 10 min max, sinon `RAISE 'RATE_LIMITED'`.
- UI (`$circleId.index.tsx`) : affiche date d'expiration, bouton régénération inchangé côté API.

### 1.6 APP_URL centralisé (préparation phase 1, complété phase 2)

- Ajout `APP_URL` dans `.env.example` et lecture serveur (validation `URL(...)` au boot).
- `SITE_URL` du webhook lu depuis `process.env.APP_URL` avec fallback `https://gift-plan.yeti-lab.fr`.
- Origines autorisées OAuth/reset construites depuis `APP_URL`.

---

### Fichiers Phase 1

**Nouveaux :**

- `supabase/migrations/<ts>_phase1_security.sql` (une seule migration atomique)
- `src/lib/gift-scrape.functions.test.ts`
- `src/lib/net-guard.ts` (helpers DNS/IP privé)
- `src/lib/webhook-auth.ts` (HMAC + rate limit)
- `src/routes/lovable/email/auth/webhook.test.ts`
- `vitest.config.ts` si absent

**Modifiés :**

- `src/lib/gift-scrape.functions.ts` (réécriture)
- `src/routes/lovable/email/auth/webhook.ts` (auth + no-log)
- `src/routes/_authenticated/circles/index.tsx` (join via RPC seulement — déjà OK, vérifié)
- `src/routes/_authenticated/circles/$circleId.index.tsx` (affichage expiration code)
- `.env.example` (APP_URL, AUTH_EMAIL_WEBHOOK_SECRET)
- `package.json` (script `test`, dépendance `vitest`)

### Risques Phase 1

- Codes d'invitation existants toujours acceptés (rétrocompat) mais expireront à 30 j à partir de la migration ; les admins peuvent régénérer avant.
- Un utilisateur qui avait été retiré manuellement (avant `circle_bans`) peut encore rejoindre avec le code — les bannissements ne sont pas rétroactifs, documenté.
- Le scraper peut refuser des sites derrière un CDN qui répond via IP privée en split-horizon (rare, documenté).
- Webhook Lovable : si le broker officiel n'expose pas de signature, on bascule sur `AUTH_EMAIL_WEBHOOK_SECRET` — nécessite action manuelle Coolify (documentée en fin de phase).

### Vérifications Phase 1

- `supabase--linter` après migration.
- Tests Vitest SSRF + webhook.
- Tests manuels : join avec code bidon, join après ban, join après expiration, scrape `http://127.0.0.1`, scrape `http://169.254.169.254`, POST webhook sans signature.
- `bun run build`, `tsgo` typecheck.

### Actions manuelles Phase 1

- **Coolify** : ajouter `AUTH_EMAIL_WEBHOOK_SECRET` (valeur affichée après `generate_secret`) et `APP_URL=https://gift-plan.yeti-lab.fr`.
- **Lovable Cloud → Auth hooks** : si un secret de signature est configurable pour le webhook auth, y coller la même valeur ; sinon je l'indiquerai.
- Redémarrer le service Coolify après ajout.

### Rollback Phase 1

- La migration crée une migration inverse `supabase/migrations/<ts>_phase1_security_rollback.sql` fournie séparément (non appliquée) qui : recrée `cm_insert_self`, réaccorde INSERT, restaure les policies antérieures. Documenté dans le compte rendu.

---

## Survol phases suivantes (pour cadrage, non implémentées maintenant)

- **Phase 2** — Storage (bucket versionné, MIME sniff via magic bytes, URL signées 5 min à la demande, suppression cascade), pages Profil/CGU/Confidentialité, export RGPD, suppression de compte avec ré-auth récente.
- **Phase 3** — `packageManager` bun, suppression `package-lock.json`, Prettier full run, ESLint 0 erreur, scripts npm complets, tests d'intégration RLS multi-users via `@supabase/supabase-js` avec JWT signés, GitHub Actions CI, headers de sécurité (CSP stricte via nonce SSR, HSTS, etc.), Dockerfile user non-root, endpoint `/healthz`, logs structurés avec `request_id`.
- **Phase 4** — édition listes/cadeaux, date d'événement, rappels, notifications, devise, recherche/filtres, pagination, confirmations de suppression, meilleurs états d'erreur.

---

## Méthode

1. Après ton **go**, j'implémente **uniquement la Phase 1**.
2. Je fournis : diff résumé, migration SQL, tests + résultats, linter Supabase, actions manuelles précises, procédure de rollback.
3. J'attends ta validation avant Phase 2.

Confirme pour lancer la Phase 1, ou demande des ajustements.
