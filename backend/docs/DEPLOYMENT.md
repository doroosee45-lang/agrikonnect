# Déploiement — AGRIKONNECT AFRICA (API V1 → V5)

> Ce document décrit la mise en service de l'API telle qu'elle est livrée dans ce dépôt :
> Node 20 + Express (ESM), Supabase (Auth + Storage) et PostgreSQL via Prisma.
> Les valeurs sensibles ne sont **jamais** dans le dépôt : elles passent par l'environnement.

---

## 1. Prérequis

| Composant | Version | Rôle |
|---|---|---|
| Node.js | ≥ 20 | API (ESM, `node --test`) |
| PostgreSQL | ≥ 14 | Base applicative (Supabase ou instance gérée) |
| Supabase | projet actif | Auth (JWT), Storage (médias privés/publics) |
| Reverse proxy | nginx / Caddy | TLS, HSTS, limite de taille (1 Mo JSON) |

L'API ne détient aucune donnée d'authentification : les mots de passe et les jetons sont gérés par
Supabase Auth ; la table `profiles` ne stocke que l'identité applicative (uuid Supabase).

---

## 2. Variables d'environnement

Copier `.env.example` → `.env`, puis renseigner :

```bash
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1            # informatif : la valeur est figée dans config/env.js

# Base de données (Supabase → Settings → Database → Connection string « Session pooler »)
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres?schema=public"

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # remplace SECRET_JWT ; jamais exposé au client
SUPABASE_BUCKET_MEDIA=agrikon-media
SUPABASE_BUCKET_PRIVATE=agrikon-private

# Domaine public (liens de partage, QR, pages de lot)
PUBLIC_WEB_URL=https://app.agrikonnect.africa
CORS_ORIGIN=https://app.agrikonnect.africa

# Comportement
JOBS_ENABLED=true                    # false = API seule (worker dédié)
REALTIME_ENABLED=true
PUBLIC_COORD_DECIMALS=2              # arrondi des coordonnées publiques (MAP-04)
AGGREGATE_MIN_GROUP_SIZE=10          # k-anonymat (DATA-02, SOIL-16, V5 §6)
API_DAILY_QUOTA=1000                 # quota par client d'API
NOTIFICATION_RETENTION_DAYS=90
ORDER_RESPONSE_DAYS=7
DISPUTE_SLA_DAYS=5
IOT_SILENCE_HOURS=24
LISTING_EXPIRY_MINUTES=5

# MFA (V4 NFR-01) — OBLIGATOIRE en production (SEC-08)
# Sans elle, l'API refuse de générer un secret TOTP (erreur 500 explicite).
MFA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")

# Moteur géospatial Python (voir §4 bis) — interne, jamais exposé
GEOAI_URL=http://127.0.0.1:8100
GEOAI_TOKEN=<secret-partage-avec-le-moteur>
GEOAI_TIMEOUT_MS=20000
GEOAI_RETRIES=1

# Data room (DR-02) — durée par défaut d'un accès accordé, plafond 90 jours
DATAROOM_ACCESS_TTL_DAYS=30

# Fournisseurs de notification (facultatifs : dégradation explicite si absents)
SMS_PROVIDER=console               # console | twilio | africastalking | webhook
SMS_API_KEY=
SMS_SENDER=AGRIKONNECT
SMS_WEBHOOK_URL=                   # requis si SMS_PROVIDER=webhook
EMAIL_PROVIDER=console             # console | resend | sendgrid | webhook
EMAIL_API_KEY=
EMAIL_FROM=no-reply@agrikonnect.africa
EMAIL_WEBHOOK_URL=                 # requis si EMAIL_PROVIDER=webhook

# Canal WhatsApp (V3 WA-01) — absent = canal désactivé (erreur explicite)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# Seuils de sécurité et quotas
OTP_TTL_MINUTES=10
OTP_MAX_SENDS_PER_HOUR=5
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
ACCESS_TOKEN_TTL_MINUTES=15
SIGNED_URL_TTL_SECONDS=300
AI_DAILY_QUOTA_PER_USER=50
AI_DAILY_QUOTA_PER_ORG=500
```

La liste exacte des variables est `.env.example` ; `npm run check:env` vérifie
qu'**aucune variable lue par le code n'est absente de ce fichier** et qu'aucune
variable documentée n'est morte.

`config/env.js` valide ces variables au démarrage (zod) : l'API **refuse de démarrer** si une variable
obligatoire manque ou est mal formée. C'est volontaire — un démarrage silencieux en configuration
incomplète produirait des comportements non traçables.

---

## 3. Base de données

### 3.1 Appliquer le schéma

La migration initiale est versionnée (86 tables, 51 enums, 46 clés étrangères, 121 index) :

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy      # prisma migrate deploy
npm run seed               # référentiels : pays, cultures, unités, paramètres, produits de données
```

- `prisma/migrations/20260918000000_init/migration.sql` est la **référence** du schéma.
- `npm run db:push` est réservé au développement local : il ne produit pas d'historique.
- Toute évolution ultérieure passe par `npm run prisma:migrate -- --name <intitulé>` puis revue du SQL.

### 3.2 Conventions portées par le schéma

| Convention | Implémentation |
|---|---|
| Identifiants | `id` texte (ULID accepté côté client pour le hors-ligne, SYNC-01) |
| Multi-tenant | `organization_id` sur toute entité métier + garde `resolveTenant` |
| Suppression logique | `deleted_at` (jamais de `DELETE` physique sur les entités métier) |
| Concurrence | `version` incrémentée à chaque écriture (verrou optimiste, SYNC-04) |
| Provenance | `source` (`declared`, `measured_lab`, `satellite`, …) toujours exposée |
| Journal | `audit_logs` append-only : acteur, action, ressource, avant/après, IP, user-agent |
| Géographie | GeoJSON `jsonb` + colonnes `latitude`/`longitude` + `public_*` arrondies |
| Argent | `Float` + `currency` ; conversion **uniquement** avec un taux daté et sourcé (`fx_rates`) |

### 3.3 RLS (défense en profondeur)

L'API applique l'isolation tenant côté service (`assertOwnership`, `resolveTenant`) et côté requêtes.
Pour un accès direct à la base par d'autres canaux (Metabase, scripts), activer la RLS :

```sql
alter table plots enable row level security;
create policy tenant_isolation on plots
  using (organization_id = current_setting('app.organization_id', true));
```

L'API ne dépend pas de ces politiques : elles sont une seconde barrière, pas la première.

### 3.4 Sauvegardes et restauration

- Sauvegarde automatique quotidienne Supabase + PITR si disponible sur l'offre.
- Le journal d'audit et les événements de lot (`lot_events`) sont **append-only** : une restauration
  doit être testée sur un environnement de recette avant toute production.
- Test de restauration trimestriel documenté (date, durée, anomalies).

---

## 4. Lancement

```bash
npm ci --omit=dev
npm run prisma:generate
npm start                      # node src/server.js
```

Au démarrage, le journal doit afficher :

```
[INFO] [realtime] Socket.IO actif sur le chemin /realtime
[INFO] [jobs] planificateur démarré : 7 tâche(s)
[INFO] AGRIKONNECT API démarrée sur http://localhost:4000/api/v1 (production)
```

### 4.1 Contrôles de santé

| Contrôle | Commande | Attendu |
|---|---|---|
| Process vivant | `curl -fsS $BASE/health` | `{"success":true,...}` |
| Contrat OpenAPI | `curl -fsS $BASE/docs/openapi.json` | JSON 3.0.3 |
| Refus d'accès | `curl -o /dev/null -w '%{http_code}' $BASE/plots` | `401` |
| 404 propre | `curl -o /dev/null -w '%{http_code}' $BASE/inconnu` | `404` |
| Validation | `curl -X POST $BASE/channels/ussd -d '{}'` | `422` |

### 4.2 Tâches planifiées

Le planificateur tourne dans le processus API (minuteurs `unref`, pas de dépendance externe).
Pour un déploiement multi-instances, **une seule** instance doit avoir `JOBS_ENABLED=true` :

```bash
# instance « api »
JOBS_ENABLED=false npm start
# instance « worker » (même image, même base)
JOBS_ENABLED=true  npm start
```

Supervision : `GET /admin/jobs` (permission `admin.jobs`) expose cadence, dernier passage, durée,
résultat et erreur. Déclenchement manuel audité : `POST /admin/jobs/:name/run`.

---

## 4 bis. Moteur géospatial Python (`geoai/`)

Le diagnostic de sol (indices spectraux, texture USDA, horizons, signature des
capteurs, imagerie, fusion multi-sources) est calculé par un service Python
séparé. Sans lui, l'API répond `503` sur les routes `/geospatial/*` et
`/plots/:id/soil-diagnosis` — les autres modules ne sont pas affectés.

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r geoai/requirements.txt          # numpy, scipy, Pillow
GEOAI_TOKEN=<secret-partage> python3 geoai/server.py --host 0.0.0.0 --port 8100
```

Côté API : `GEOAI_URL=http://127.0.0.1:8100`, `GEOAI_TOKEN=<même secret>`,
`GEOAI_TIMEOUT_MS=20000`, `GEOAI_RETRIES=1`. Le moteur est **sans état** (aucune
base, aucun stockage) : il peut être répliqué derrière un load balancer, mais ne
doit **jamais** être exposé à Internet (seule l'API Node le joint).

Supervision : `GET /api/v1/geospatial/health` (relais de `GET /health` du moteur)
et `python3 -m unittest discover -s geoai/tests -t .` en intégration continue.

## 5. Reverse proxy (exemple nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name api.agrikonnect.africa;

  client_max_body_size 2m;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /realtime/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

Les webhooks (`/channels/ussd`, `/channels/whatsapp/webhook`) doivent être joignables depuis les
passerelles opérateur/Meta : ne pas les placer derrière une authentification applicative, mais derrière
la vérification de signature (`WHATSAPP_APP_SECRET`) ou une liste d'IP autorisées.

### 5.1 `trust proxy` — valeur attendue

`src/app.js` pose **`app.set('trust proxy', 1)`** (valeur codée en dur, non
configurable par variable d'environnement).

`1` signifie : **faire confiance à exactement un saut** en amont. Concrètement,
Express remonte d'un cran dans `X-Forwarded-For` pour déterminer `req.ip`, et
utilise `X-Forwarded-Proto` pour `req.protocol` et `req.secure`.

| Déploiement | Valeur attendue | Effet |
|---|---|---|
| **Derrière un seul proxy** (nginx, Render, Railway, Fly — le cas documenté ici) | **`1`** ✅ | `req.ip` = l'adresse réelle du client |
| Derrière **deux** sauts (CDN puis nginx) | `2` | `1` donnerait l'adresse du CDN pour tous les clients |
| **Aucun** proxy (exposition directe du processus Node) | `false` | voir l'avertissement ci-dessous |

⚠ **Si le processus est exposé directement, sans proxy, `trust proxy = 1` est
une faille** : n'importe quel client peut envoyer son propre `X-Forwarded-For`
et Express le croira. Comme `req.ip` est la **clé du limiteur de débit**, un
attaquant peut faire tourner cette valeur à chaque requête et obtenir un quota
neuf indéfiniment — le limiteur devient décoratif. La configuration documentée
(nginx en amont) est donc **une condition de sécurité**, pas seulement un
détail de réseau.

Vérification en production :

```bash
curl -s https://api.agrikonnect.africa/api/v1/health -H 'X-Forwarded-For: 203.0.113.9' -i
# Derrière nginx : l'adresse vue par l'application est celle du client réel,
# pas 203.0.113.9 — nginx réécrit l'en-tête ($proxy_add_x_forwarded_for).
```

**Non modifié.** Passer cette valeur par une variable d'environnement
(`TRUST_PROXY`) serait raisonnable — un déploiement sans proxy n'a aujourd'hui
aucun moyen de la désactiver sans toucher au code — mais c'est un changement de
comportement de sécurité qui doit être décidé explicitement.

### 5.2 Limite de taille du corps — conflit avec le dépôt géospatial

⚠ **La configuration nginx ci-dessus pose `client_max_body_size 2m`.**

Or la route `POST /api/v1/geospatial/imports` accepte un corps base64 jusqu'à
**100 Mo** (fichier de 64 Mo + ~33 % d'encodage). Avec `2m`, **nginx renvoie 413
avant même que Node ne voie la requête** : le dépôt de fichiers géoradar et
drone est inutilisable dans le déploiement tel que documenté.

Corrections possibles, **à décider** (non appliquées) :

- porter `client_max_body_size` à `110m` globalement — simple, mais expose
  toutes les routes à des corps volumineux, alors que l'API est bornée à 1 Mo
  partout ailleurs ;
- ou mieux, un `location` dédié :

```nginx
location = /api/v1/geospatial/imports {
  client_max_body_size 110m;
  proxy_pass http://127.0.0.1:4000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_request_buffering off;   # évite de tamponner 100 Mo sur disque
}
```

La seconde option est préférable : elle garde le plafond de 2 Mo sur tout le
reste de l'API.

---

## 6. Sécurité opérationnelle

| Sujet | Mise en œuvre |
|---|---|
| TLS | Terminaison au proxy, HSTS, redirection HTTP → HTTPS |
| En-têtes | `helmet` (CSP, noSniff, frameguard) — voir `src/app.js` |
| CORS | Liste blanche `CORS_ORIGIN`, credentials autorisés |
| Limitation | `express-rate-limit` global + limiteur renforcé sur `/auth/*` |
| Taille | JSON 1 Mo, import CSV 2 Mo |
| Secrets | Variables d'environnement uniquement ; rotation des clés d'API via `api-clients` |
| MFA | Obligatoire pour les rôles investisseur et administration (`/auth/mfa/*`) |
| Données sensibles | Coordonnées exactes jamais publiées ; QR = URL publique seule |
| Journalisation | `requestId` sur chaque requête/réponse ; audit des actions sensibles |
| Erreurs | Aucune fuite de stack en production ; `message` métier explicite |

---

## 7. Procédure de mise à jour

1. `git pull` + `npm ci` + `npm run prisma:generate`.
2. `npm run prisma:deploy` (migration additive ; jamais de `db push` en production).
3. Vérifications locales : `npm run check`, `check:fields`, `check:perms`, `check:trace`, `npm test`.
4. Redémarrage progressif (ou rolling) ; surveiller `GET /admin/jobs` et les erreurs 5xx.
5. En cas de régression : redéploiement de l'image précédente. Les migrations sont **additives** ;
   un retour arrière de schéma doit être préparé au cas par cas (script de rollback relu).

---

## 8. Limites connues de cet environnement

- Aucun PostgreSQL n'est disponible dans l'environnement de développement de ce dépôt : les tests
  utilisent un double en mémoire (`tests/helpers/fakePrisma.mjs`) qui vérifie les **invariants métier**,
  pas le SQL généré.
- Les parcours réels (Auth Supabase, OTP SMS, emails, stockage) doivent être validés sur un
  environnement de recette avant ouverture au public.
- Les fournisseurs externes (météo, satellite/NDVI, SMS, email) sont branchés derrière des interfaces :
  sans clé, l'API répond avec une provenance explicite (`available: false`) plutôt que d'inventer.
