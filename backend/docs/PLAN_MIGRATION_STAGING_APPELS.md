# Plan de migration STAGING — appels audio et appareils push

> **Statut : PRÉPARÉ, NON EXÉCUTÉ.** Aucune étape de ce plan ne doit être
> lancée sans l'autorisation explicite et séparée du porteur du projet.
> Ce plan ne concerne **que** la base de staging. La production fera l'objet
> d'un plan et d'une autorisation distincts.

## 1. Périmètre

| Migration | Objets créés |
|---|---|
| `20261116000000_audio_calls` | types `CallKind`, `CallStatus`, `CallParticipantStatus` ; tables `call_sessions`, `call_participants`, `call_events` (+ index, clés étrangères vers `conversations`, `profiles`, `organizations`) ; RLS activée ; droits `anon` / `authenticated` retirés |
| `20261116010000_push_devices` | type `PushProvider` ; table `push_devices` (+ index, clé étrangère vers `profiles`) ; RLS activée ; droits `anon` / `authenticated` retirés |

Les deux migrations sont **additives** : aucune table existante n'est
modifiée, aucune donnée n'est réécrite, aucune colonne n'est supprimée. Le
réglage `modules.appels` vit dans la table `settings` existante (valeur par
défaut côté code) : pas de migration.

Interdits rappelés : ne pas rejouer `20261031020000_revoke_anon_authenticated_grants` ;
aucune commande de migration dans les commandes de build ou de démarrage
Render ; aucun `db push` ; aucun seed.

## 2. Prérequis (à confirmer par le porteur avant toute exécution)

1. **Un projet Supabase de staging distinct de la production** (URL de projet
   différente). Ne jamais exécuter ce plan si la chaîne de connexion désigne
   la production.
2. Chaîne de connexion **directe** (port 5432, ou pooler en mode session)
   fournie à l'opérateur dans son terminal, **jamais** collée dans le dépôt, un
   ticket ou une conversation. Le pooler en mode transaction (6543) ne
   convient pas aux migrations.
3. Branche relue et validée : `fix/audit-lot3-authentification` (code publié
   pour revue).
4. `CALLS_ENABLED=false` et `PUSH_ENABLED=false` sur le service de staging
   (valeurs par défaut de `render.yaml`).
5. Fenêtre d'intervention annoncée ; une seule personne opère.

## 3. Sauvegarde

1. Sauvegarde récente vérifiée du projet de staging (tableau de bord
   Supabase → Database → Backups), **ou** export logique :
   `pg_dump --schema=public --format=custom --file=staging-avant-appels.dump "$DATABASE_URL_STAGING"`
   (fichier stocké hors du dépôt).
2. Relever l'état de référence (lecture seule) :

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;

SELECT to_regclass('public.call_sessions'), to_regclass('public.push_devices');  -- attendu : NULL, NULL
```

## 4. Contrôle préalable (lecture seule)

Depuis `backend/`, avec la variable d'environnement de staging chargée
**dans le terminal uniquement** :

```bash
npx prisma migrate status
```

**Condition de poursuite** : la sortie liste **exactement deux** migrations en
attente, `20261116000000_audio_calls` et `20261116010000_push_devices`.
Si une autre migration apparaît en attente (en particulier
`20261031020000_revoke_anon_authenticated_grants`), **arrêter** : l'historique
de staging diverge et doit être analysé avant toute action.

## 5. Application

Option A — si le contrôle §4 est conforme :

```bash
npx prisma migrate deploy
```

Option B — application manuelle (si `migrate deploy` est jugé trop large) :

```bash
psql "$DATABASE_URL_STAGING" -v ON_ERROR_STOP=1 -1 -f prisma/migrations/20261116000000_audio_calls/migration.sql
npx prisma migrate resolve --applied 20261116000000_audio_calls
psql "$DATABASE_URL_STAGING" -v ON_ERROR_STOP=1 -1 -f prisma/migrations/20261116010000_push_devices/migration.sql
npx prisma migrate resolve --applied 20261116010000_push_devices
```

(`-1` : chaque fichier dans une seule transaction ; en cas d'erreur, rien
n'est appliqué.)

**Ordre avec le déploiement du code** : migrer **avant** de déployer la
branche sur le service de staging. Les routes `/me/push-devices` sont montées
même push désactivé : sans la table, elles répondraient 500.

## 6. Vérification RLS et droits (lecture seule)

```sql
-- 6.1 RLS activée sur les 4 tables (attendu : 4 lignes, relrowsecurity = true)
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('call_sessions', 'call_participants', 'call_events', 'push_devices');

-- 6.2 Aucune politique (attendu : 0) — accès réservé au backend (rôle propriétaire)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('call_sessions', 'call_participants', 'call_events', 'push_devices');

-- 6.3 Aucun droit pour anon / authenticated (attendu : 0 ligne)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('call_sessions', 'call_participants', 'call_events', 'push_devices')
  AND grantee IN ('anon', 'authenticated');

-- 6.4 Les mêmes contrôles sur l'ensemble du schéma (non-régression)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  AND c.relname <> '_prisma_migrations';                       -- attendu : 0 ligne

-- 6.5 Structure : 4 types et contraintes uniques
SELECT typname FROM pg_type
WHERE typname IN ('CallKind', 'CallStatus', 'CallParticipantStatus', 'PushProvider'); -- attendu : 4
SELECT indexname FROM pg_indexes
WHERE indexname IN ('call_sessions_room_name_key', 'call_participants_call_id_user_id_key',
                    'call_events_source_external_id_key', 'push_devices_provider_token_key'); -- attendu : 4
```

6.6 — Contrôle par l'API REST publique de Supabase (exécuté par l'opérateur,
clé publique `anon` lue dans son terminal, jamais recopiée) : une requête
`GET /rest/v1/call_sessions?select=id&limit=1` doit être **refusée**
(erreur de permission), de même pour les trois autres tables.

6.7 — Contrôle applicatif sur le service de staging (comptes de test dédiés,
jamais de compte réel) :
- `GET /api/v1/calls/config` → `enabled: false` et ses raisons ;
- `POST /api/v1/calls` → 503 `CALLS_UNAVAILABLE` ;
- `GET /api/v1/me/push-devices` → 200, liste vide ;
- `POST /api/v1/webhooks/livekit` → 404 (appels désactivés).

## 7. Critères de décision

**Go** (staging validé) si : §4 conforme, §5 sans erreur, §6.1 à §6.5
conformes, §6.6 refusé, §6.7 conforme, aucun nouveau 5xx dans les journaux.

**No-go → retour arrière (§8)** si : une vérification RLS ou de droits
échoue, une erreur de migration survient, ou le service de staging se
dégrade.

## 8. Retour arrière

1. Laisser `CALLS_ENABLED=false` et `PUSH_ENABLED=false`.
2. Redéployer sur staging la version précédente du backend (commit
   `260c111`) **avant** de supprimer les tables (le code des appels lit ces
   tables).
3. Exécuter en une transaction (vérifier d'abord que les tables ne
   contiennent que des données de test) :

```sql
BEGIN;
DROP TABLE IF EXISTS "push_devices";
DROP TYPE  IF EXISTS "PushProvider";
DROP TABLE IF EXISTS "call_events";
DROP TABLE IF EXISTS "call_participants";
DROP TABLE IF EXISTS "call_sessions";
DROP TYPE  IF EXISTS "CallParticipantStatus";
DROP TYPE  IF EXISTS "CallStatus";
DROP TYPE  IF EXISTS "CallKind";
DELETE FROM "_prisma_migrations"
WHERE migration_name IN ('20261116010000_push_devices', '20261116000000_audio_calls');
COMMIT;
```

4. Revérifier : `to_regclass` renvoie `NULL` pour les quatre tables,
   `npx prisma migrate status` liste de nouveau les deux migrations en attente,
   la requête §6.4 renvoie 0 ligne.
5. En dernier recours : restauration de la sauvegarde du §3.

Le retour arrière n'affecte aucune table existante : les clés étrangères
partent des nouvelles tables vers `conversations`, `profiles` et
`organizations`, jamais l'inverse.

## 9. Hors périmètre de ce plan

- Activation des appels (`CALLS_ENABLED=true`), configuration LiveKit, FCM,
  APNs : autorisation séparée, après validation du staging.
- Production : plan distinct, après retour d'expérience du staging.
- Builds mobiles natifs (EAS) et raccord iOS PushKit → CallKit
  (voir `APPELS_AUDIO.md` §8.3).
