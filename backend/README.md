# AGRIKONNECT AFRICA — Backend (V1 → V5)

API REST du cahier des charges **AGRIKONNECT AFRICA v2.0 (18/09/2026)** — périmètre **complet** :
**V1 FARM** · **V2 MARKET** · **V3 INTELLIGENCE** · **V4 INVEST** · **V5 GLOBAL**, socle **Soil S1** inclus.

**Stack retenue** : Node 20 · Express · JavaScript (ESM) · **Supabase** (Auth + Postgres) · **Prisma**.

> ⚠️ **Divergence assumée avec le CDC** : le document cible MongoDB/Mongoose (index `2dsphere`, GeoJSON natif).
> L'implémentation utilise **Postgres/Supabase + Prisma** (choix validé avec le porteur). Les concepts sont conservés :
> GeoJSON stocké en `jsonb`, filtrage cartographique par **bbox** sur lat/lng indexés, `version` + `deletedAt` +
> identifiants **ULID côté client** pour préparer l'offline (P7). Aucune exigence fonctionnelle n'est perdue.

---

## 1. Démarrage

```bash
cp .env.example .env          # renseigner Supabase (URL, anon key, service role, DATABASE_URL, DIRECT_URL)
npm install
npx prisma generate           # génère le client
npm run prisma:deploy         # applique la migration SQL initiale livrée dans prisma/migrations/ (86 tables)
npm run seed                  # référentiels : pays CD/CG, 10 cultures, paramètres, produits de données
npm run dev                   # http://localhost:4000/api/v1/health
```

La migration de référence `prisma/migrations/20260918000000_init/migration.sql` est **livrée avec le
code** (73 tables, 45 enums, 46 clés étrangères, 121 index) : elle a été générée depuis
`schema.prisma`, donc `migrate deploy` suffit sur un environnement neuf.
Guide complet (Supabase, RLS, reverse proxy, exploitation, retour arrière) : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Le premier `SUPER_ADMIN` : créer l'utilisateur via Supabase Auth, appeler `POST /auth/sync-profile`,
puis passer le membership en `SUPER_ADMIN` (commande SQL indiquée en fin de `prisma/seed.js`).

**Providers en développement** : SMS et email sont en mode `console` (le code OTP et le lien s'affichent
dans les logs). Aucun compte tiers n'est nécessaire pour tester les parcours.

---

## 2. Architecture (modular monolith — CDC P1)

```
backend/
├── prisma/
│   ├── schema.prisma        # 73 modèles (V1 → V5)
│   ├── migrations/          # migration initiale versionnée (rejouable en CI/production)
│   └── seed.js              # référentiels uniquement (aucune donnée fictive)
├── docs/API.md              # référence de tous les endpoints
└── src/
    ├── config/              # env (zod), supabase (anon + admin), prisma
    ├── shared/
    │   ├── errors/          # ApiError (status + code + erreurs par champ)
    │   ├── http/            # response, errorHandler, logger, requestId, notFound, asyncHandler
    │   ├── permissions.js   # matrice RBAC ressource.action (CDC §3.2)
    │   ├── audit.js         # journal immuable (SEC-09)
    │   ├── geo.js           # GeoJSON, centroïde, superficie, arrondi public, bbox
    │   ├── units.js         # conversions kg (référentiel, jamais en dur)
    │   ├── ids.js · slug.js · crypto.js · pagination.js
    ├── middleware/
    │   ├── auth.js          # JWT Supabase → req.user (+ profil, memberships)
    │   ├── tenant.js        # isolation tenant + assertOwnership
    │   ├── authorize.js     # couche 2 : permission requise
    │   ├── validate.js      # validation Zod + rejet des opérateurs NoSQL
    │   └── rateLimit.js     # global / auth / écritures
    ├── integrations/        # sms.js, email.js (abstractions remplaçables)
    ├── realtime/            # Socket.IO : bus d'événements + rooms user/org/conversation
    ├── jobs/                # tâches planifiées idempotentes (expirations, SLO, purges)
    ├── modules/             # 1 dossier = 1 domaine : routes → controller → service → schema
    │   ├── auth/ users/ organizations/ crops/ farms/ plots/ productions/
    │   ├── soil/ cooperatives/ media/ verification/ reports/ public/
    │   ├── admin/ dashboard/ countries/
    ├── routes/index.js      # agrégation + healthcheck
    ├── app.js               # express + middlewares globaux
    └── server.js            # démarrage (HTTP + Socket.IO + planificateur) et arrêt propre
```

Chaque service métier **filtre systématiquement par `req.tenant.organizationId`** : le client ne fournit
jamais l'identifiant de tenant, il choisit seulement une organisation à laquelle il appartient
(`X-Organization-Id`).

---

## 3. Modèle d'autorisation (4 couches — CDC A.2)

1. **Authentification** — `authenticate` : JWT Supabase valide, profil actif.
2. **Autorisation** — `authorize('farms.write')` : permission issue de la matrice `shared/permissions.js`.
3. **Propriété / appartenance** — `assertOwnership(resource, tenantId)` : la ressource appartient au tenant.
4. **Isolation tenant** — filtre `organizationId` imposé côté serveur, jamais fourni par le client.

Les ressources tierces renvoient **404** (et non 403) pour ne pas confirmer leur existence.

Rôles V1 actifs : `FARMER`, `COOPERATIVE_ADMIN`, `COOPERATIVE_MEMBER`, `AGRICULTURAL_COMPANY`,
`SUPPORT_AGENT`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`, `PUBLIC_USER`.
Les rôles `BUYER`, `INVESTOR`, `SUPPLIER`, `TRANSPORTER`, `AGRONOMIST`, `LAB_PARTNER`, `API_CLIENT`
existent déjà dans l'énumération mais ne sont pas encore activés (V2→V5).

---

## 4. Exigences V1 (FARM) couvertes

| Bloc CDC | Implémentation |
|---|---|
| **AUTH-01→07** | Inscription en étapes, login email/téléphone, OTP SMS (TTL 10 min, 5 envois/h), vérif email, reset, refresh rotatif, langue + pays, consentement d'inscription assistée |
| **PROF-01→04** | Profil, visibilité par champ, complétude par critères, compteur de vues agrégé |
| **FARM-01→04** | CRUD exploitation, galerie, multi-exploitations, alerte superficie (jamais bloquante) |
| **PLOT-01→05** | CRUD, point GPS ou polygone, superficie calculée, historique cultural, archivage, validation géo |
| **CROP-01→02** | Catalogue administré multilingue + structure agronomique (contenu à valider par agronomes) |
| **PROD-01→04** | Enregistrement déclaré, conversions par référentiel, stats réelles, audit des modifications |
| **COOP-01→05** | Coopérative, membres + consentement, import CSV ligne par ligne, consolidation scopée |
| **PUB-01→06** | Page publique /farm/{slug}, slug unique + redirection, partage/OG, contact sans coordonnées |
| **MAP-01→04** | Carte par bbox, filtres, clusters côté client, positions approximatives |
| **VER-01→05** | 4 statuts, documents privés, file de revue, décision motivée, critères (aucun score global) |
| **Soil S1 (SOIL-01→03)** | Analyse par parcelle et par date, provenance/méthode/confiance, historique en frise, aucun conseil |
| **Admin V1** | Dashboard, utilisateurs, audit, paramètres, export CSV journalisé |
| **Transverse** | Helmet/CORS/rate-limit, Zod, audit immuable, soft delete, i18n-ready, pagination, requestId |

---

## 5. V2 → V5 : modules livrés

Chaque niveau réutilise les quatre couches de sécurité de V1 (authentification → organisation active →
permission → propriété de la ressource), le champ `source` de provenance, l'audit et l'isolation tenant.

### V2 — MARKET (`/listings`, `/purchase-requests`, `/market`, `/orders`, `/inventory`, `/transport`,
`/messaging`, `/notifications`, `/billing`, `/reviews`)

| Bloc CDC | Implémentation |
|---|---|
| **MKT-01→06** | Annonce en brouillon → publication, recherche (culture, prix, zone, certification, vendeur vérifié), expiration automatique, modération motivée et tracée |
| **REQ-01→05** | Demande d'achat, matching **déterministe et explicable** (liste de critères + tri explicite, aucun score opaque), notification ciblée, coordonnées masquées avant accord |
| **ORD-01→05** | Commande avec **snapshot des conditions** (prix/quantité figés), **machine à états** à 10 statuts (`PENDING → ACCEPTED → PROCESSING → READY → IN_TRANSIT → DELIVERED → COMPLETED`, branches `REJECTED`/`CANCELLED`/`DISPUTED`), transitions contrôlées par rôle **et** par état, journal d'événements, création **idempotente**, paiement **déclaratif** (aucun encaissement) |
| **STK-01→02** | Stock = **journal de mouvements** (le solde n'est jamais un champ modifiable), refus de stock négatif, alertes seuil/expiration |
| **TRA-01→03** | Demande de transport + offres, distance approximative, **preuve de livraison obligatoire** avant l'état `DELIVERED` |
| **MSG-01→03** | Conversation **obligatoirement rattachée** à une annonce / commande / transport / litige / projet, participants = parties du dossier, signalement conservé |
| **NOTIF-01→04** | Notifications in-app, préférences par **type × canal** (in-app, email, SMS, push), déduplication par clé |
| **BIL-01→04** | Devis/facture/proforma/reçu, **numérotation séquentielle par organisation** sans trou, conversion refusée sans taux **daté et sourcé** |
| **Avis** | Avis uniquement après livraison, un avis par partie et par commande, droit de réponse, moyenne **avec volume** (jamais une note seule) |

### V3 — INTELLIGENCE (`/sync`, `/ai`, `/weather`, `/prices`, `/lots`, `/certifications`, `/iot`, `/geodata`)

| Bloc CDC | Implémentation |
|---|---|
| **SYNC-01→05** | Push d'opérations offline : idempotence par `opId`, verrou optimiste `version`, **rapport de conflits explicite** ; **pull par curseur** (`GET /sync/pull`) avec tombstones et `hasMore` |
| **AI-01→06 / AI-10** | Analyses `CHAT`/`PLANT_PHOTO`/`DOCUMENT` : **consentement enregistré**, `disclaimer` + `confidence` + version de prompt et modèle **toujours exposés**, quotas, escalade vers un agronome ; **copilote** (`POST /ai/copilot`) qui ne répond qu'avec des données sourcées et refuse de conclure sans donnée ; **génération de documents** en brouillon à relire (`POST /ai/documents`) |
| **WEA-01→03** | Météo **datée et sourcée**, réponse « donnée indisponible » plutôt qu'une valeur inventée, alertes dérivées de seuils explicites et affichés |
| **PRI-01→03** | Prix **datés et sourcés**, série temporelle avec période et nombre de relevés, marchés sans relevé signalés comme non actualisables |
| **LOT-01→04** | Lots, journal d'événements **append-only**, vue **publique par QR limitée à `publicFields`**, rappel de lot |
| **CERT-01→04** | Certification déclarée ≠ vérifiée : statut `VERIFIED` réservé à l'administration, expiration calculée, certification expirée signalée partout |
| **IOT-01→04** | Clé d'appareil **hachée et affichée une seule fois**, rotation/révocation, ingestion sans JWT utilisateur, seuils → alertes, trous de mesure signalés |
| **GEO-01→03** | Satellite / drone / laboratoire **rattachés à la parcelle avec provenance distincte** (aucune fusion entre capteurs) |

### V4 — INVEST (`/projects`, `/dataroom`, `/funding`, `/investors`, `/precision`, `/invest`)

| Bloc CDC | Implémentation |
|---|---|
| **PRJ-01→05** | Projet avec **provenance champ par champ** (`fieldStatus`), `platform_verified` interdit au producteur, soumission → revue administrative, **filtre de formulation** (aucune promesse de rendement) |
| **DR-01→05** | Data room **fermée par défaut**, demande d'accès justifiée + portée + expiration, décision du propriétaire, **journal d'accès append-only**, téléchargement **désactivé par défaut** |
| **DD-01→03** | Checklist légale/financière/agronomique/environnementale/sociale, `VERIFIED` uniquement avec **nom et qualité du professionnel** |
| **REP-01→03** | Rapports d'avancement et d'impact, **`source` obligatoire par indicateur**, mention explicite des indicateurs non vérifiés, horodatage serveur |
| **FUND-01→03** | Consentement **condition dure** (identifiant + horodatage + copie du contenu), transmission refusée sans accord, aucun fonds manipulé |
| **INV-01→03** | Profil investisseur vérifié **+ MFA** requis pour la data room, refus au niveau service |
| **PRE-01→03** | Zones de gestion **versionnées** (`methodVersion`) avec sources déclarées, rapport de précision **non validé par défaut**, validation par agronome identifié |

### V5 — GLOBAL (`/tenders`, `/exports`, `/api-clients`, `/data`, `/insights`, `/public-api/v1`)

| Bloc CDC | Implémentation |
|---|---|
| **TEN-01→03** | Appel d'offres public, réponses **scellées** (visibles du seul acheteur et de leur auteur), adjudication transactionnelle |
| **EXP-01→03** | Dossier d'export, **Incoterms contrôlés**, taux de change daté et sourcé obligatoire hors USD, certification **impossible sans documents obligatoires** |
| **API-01→04** | Clients API, **contrat de finalité approuvé** avant toute clé, clés **hachées SHA-256** (affichées une fois), quota journalier, journal d'usage |
| **DATA-01→04** | Produits de données, agrégats **k-anonymes** (aucune valeur si `groupCount < minGroupSize`), **composition** déclaré/mesuré/estimé + version de règle, contrat de données obligatoire côté API publique |

### Invariants transverses vérifiés dans le code

1. **Aucune donnée inventée** : météo, prix, IA, agrégats répondent « indisponible » ou suppriment le groupe
   plutôt que de produire une valeur plausible.
2. **Aucune promesse financière** : pas de fonds, pas de rendement garanti, paiement déclaratif uniquement,
   filtre de formulation sur les projets.
3. **Provenance systématique** : `source` en V1/V3, `fieldStatus` champ par champ en V4, `composition` en V5.
4. **Idempotence et concurrence** : `Idempotency-Key` (commandes, stock, IA), `opId` (sync), verrou optimiste
   `version`, réservation de stock conditionnelle (pas de survente).
5. **Cloisonnement** : 404 plutôt que 403 hors tenant, participants de messagerie limités aux parties,
   data room fermée par défaut, clés et jetons jamais relisibles.

---

### Compléments transverses tracés au même niveau

Les familles suivantes ne sont pas des modules mais des exigences numérotées, suivies dans
`docs/REQUIREMENTS.md` avec la même règle (source + preuve de test) :

| Réf. | Règle | Où |
|---|---|---|
| **BIL-03 / BIL-04** | Numérotation séquentielle par organisation **et par type**, sans trou ; règlement **déclaratif** hors plateforme (aucun fonds détenu) | `market/billing/billing.service.js` |
| **AI-07** | Revue experte d'une analyse IA : **annotation humaine**, la sortie machine et sa version ne sont jamais réécrites | `ai/ai.service.js` — `reviewAnalysis()` |
| **CERT-04** | « Fiable » = vérifié : les certifications déclarées restent comptées **à part** | `certifications/certifications.service.js` — `trusted()` |
| **NFR-08** | Une règle agronomique n'est **opposable** qu'après validation par un agronome distinct de son auteur | `soil/intelligence.service.js` — `validateRuleSet()` |
| **FX-01→03** | Cotation **datée et sourcée**, refusée si future ou non positive, **idempotente** sur `(base, quote, asOf)`, et signalée comme périmée au-delà de 48 h | `countries/fx.service.js` |

---

## 5 bis. Intelligence du sol — moteur géospatial Python (`geoai/`)

Le backend Node ne calcule **aucun** indice spectral ni horizon de sol : il
délègue au moteur Python, qui reçoit un JSON et renvoie un diagnostic sourcé.
Détail complet : [`docs/GEOSPATIAL.md`](docs/GEOSPATIAL.md).

| Source | Calculé réellement (numpy/scipy/Pillow) |
|---|---|
| **Satellite** (Sentinel‑2 L2A) | NDVI, NDWI, NDMI, SAVI, MSAVI, BSI, GNDVI ; masque SCL/nuages ; statistiques zonales (médiane, P10/P90, part valide) ; phénologie (démarrage de saison, pic, fin, tendance, anomalie z) |
| **Sol** | texture **USDA 12 classes** depuis sable/limon/argile, groupe hydrologique, réserve utile, classes pH / MO / salinité, risque d'érosion à 3 facteurs expliqués, contraintes hiérarchisées |
| **Sous‑sol** | horizons segmentés sur ruptures mesurées, décroissance exponentielle de la MO (`OM₀·e^(−kz)`, R²), profondeur du substratum (ou « inconnue »), confiance selon la profondeur couverte |
| **Capteurs** | aberrations MAD, capteur bloqué, trous, dérive (tendance > 3σ du résidu), humidité volumique → **mm d'eau** |
| **Caméra / drone** | ExG, VARI, GLI, seuil d'Otsu, part de végétation/sol nu, entropie et contours, ombres ; CHM drone → hauteur moyenne/P90, couverture |
| **Fusion** | priorité **lab > capteur > satellite > drone > caméra > déclaré**, poids = fiabilité × qualité × fraîcheur, intervalle d'incertitude, **conflits signalés**, source fiable mais périmée explicitement déclassée |

Endpoints : `POST /plots/:plotId/soil-diagnosis`, `GET /plots/:plotId/soil-diagnosis[/latest]`,
`GET /geospatial/soil-diagnostics/:id`, `GET /geospatial/health|methods`,
`POST /geospatial/texture|spectral|imagery|sensors/quality|fusion`.

Garanties : aucune donnée inventée (sans prélèvement, le sous‑sol est *inconnu*),
aucune prescription sans jeu de règles validé (CDC S1), et **503 explicite** si le
moteur est indisponible — jamais de diagnostic de substitution.

---

## 6. Sécurité (SEC-01 → SEC-12)

| Réf. | Mise en œuvre |
|---|---|
| SEC-01 | `helmet`, CORS restrictif, rate limit global + renforcé sur auth |
| SEC-02 | Validation Zod systématique, rejet des clés `$`/`\0`, `strict()` sur les payloads |
| SEC-03 | Jetons Supabase courts + refresh rotatif, sessions révocables |
| SEC-04 | Hachage délégué à Supabase Auth (Argon2/bcrypt) |
| SEC-05 | OTP haché (SHA-256) + TTL + quota + blocage après 5 échecs |
| SEC-06 | MIME autorisé en liste blanche, taille max 5 Mo, clé de stockage renommée |
| SEC-07 | Bucket privé + URLs signées à durée courte (`SIGNED_URL_TTL_SECONDS`) |
| SEC-08 | Secrets uniquement en variables d'environnement, `.env` ignoré par Git |
| SEC-09 | `audit_logs` en ajout seul (acteur, action, ressource, IP, appareil, avant/après) |
| SEC-11 | TLS géré par l'hébergeur, chiffrement au repos Supabase |
| SEC-12 | Coordonnées exactes jamais publiées ; arrondi serveur + projection dédiée |

---

## 7. Conventions de données (CDC §12.1 / P2 / P7)

Toute entité métier porte : `id` (ULID accepté côté client), `organizationId`, `countryCode`,
`createdAt`, `updatedAt`, `createdBy`, `deletedAt` (suppression logique), `version`, `source`.

`source` ∈ `declared` · `platform_verified` · `third_party_verified` · `measured_lab` ·
`measured_sensor` · `satellite` · `photo_interpreted` · `estimated` · `derived` — toujours exposé par l'API.

Aucune statistique n'est inventée : chaque tuile du tableau de bord renvoie la requête qui la produit.

---

## 8. Vérifications effectuées

| Vérification | Résultat |
|---|---|
| `npx prisma validate` | ✅ schéma valide (**87 modèles**) |
| Migrations versionnées | ✅ `20260918000000_init` (86 tables / 51 enums / 46 FK / 121 index) + `20261020000000_mfa_enabled` (`Profile.mfa_enabled`) + `20261021000000_lot_recall` (événement `RECALL` du journal de lot) + `20261021010000_soil_diagnostics` (table `soil_diagnostics`) |
| `npm run check` (import complet de l'app) | ✅ OK |
| `npm run check:fields` | ✅ **0 clé invalide** sur 184 fichiers / 87 modèles |
| `npm run check:env` | ✅ **46 variables documentées**, **0 écart** : toute variable lue par `src/` figure dans `.env.example`, aucune variable documentée n'est morte |
| `npm run check:perms` | ✅ **114 permissions utilisées / 114 déclarées** |
| `npm run check:trace` | ✅ 53 familles · 196/196 |
| `npm run check:req` | ✅ **220/220 exigences numérotées**, source **et** preuve de test pour chacune ; échoue aussi sur tout identifiant cité dans le dépôt mais absent du catalogue |
| `npm run check:cdc` | ✅ **199 identifiants du cahier des charges** (149 fonctionnelles + 50 NFR) — chacun couvert par le catalogue ou par `docs/NFR.md`, **0 écart** |
| `npm test` | ✅ **329/329** tests unitaires et d'intégration (services réels sur double Prisma en mémoire) |
| `npm run test:geoai` | ✅ **70/70** tests du moteur Python (texture USDA, horizons, capteurs, spectre, imagerie, fusion, HTTP) |
| `npm run check:mounts` | ✅ **319 routes montées**, 315 documentées, **0 collision**, **0 écart** contrat/implémentation |
| `npm run test:e2e` | ✅ **31/31** parcours bout-en-bout sur PostgreSQL embarqué (17 parcours, 8 intelligence, 6 canaux) |
| `npm run docs:openapi` | ✅ OpenAPI 3.0.3 : **252 chemins / 315 opérations / 45 tags** |
| `npm run docs:traceability` | ✅ `docs/TRACEABILITY.md` (familles CDC) |
| `npm run docs:requirements` | ✅ `docs/REQUIREMENTS.md` (matrice **exigence par exigence**) |
| `npm run verify` | ✅ enchaîne check → fields → env → perms → trace → req → **cdc** → moteur Python → unitaires → e2e → montages → fumée HTTP |
| `npm run smoke` (fumée HTTP) | ✅ **315 opérations du contrat appelées**, **0 route fantôme** (`200×1 · 401×290 · 403×1 · 422×11 · 500×11 · 501×1` — les `500` sont les routes publiques qui interrogent la base, absente pendant la fumée) |

Les preuves par exigence vivent dans `tests/req-v1…req-v5.integration.test.mjs` : chaque test porte
l'identifiant du cahier des charges qu'il démontre (`MKT-02`, `DR-05`, `DATA-10`…). La matrice
`docs/REQUIREMENTS.md` liste, pour chaque identifiant, le fichier d'implémentation **et** le fichier
de test qui le prouvent — elle échoue (`exit 1`) dès qu'une exigence perd l'un des deux.

### 8 bis. Audit de conformité au cahier des charges (`npm run check:cdc`)

Le cahier des charges v2.0 (général + V1…V5 + Annexe A) contient **199 identifiants** :
149 exigences fonctionnelles et 50 exigences non fonctionnelles (numérotées par
version). Ils sont transcrits dans [`docs/CDC-INVENTAIRE.md`](docs/CDC-INVENTAIRE.md),
que `check:cdc` confronte au dépôt :

- une exigence fonctionnelle doit figurer au catalogue, qui exige lui-même un
  fichier d'implémentation **et** une preuve de test ;
- une exigence non fonctionnelle (`V1:NFR-01` … `V5:NFR-10`) doit avoir une ligne
  dans [`docs/NFR.md`](docs/NFR.md) avec la cible du CDC, la réponse du backend,
  sa preuve et sa portée (`backend` / `exploitation` / `client` / `mesure`).

Résultat : **199/199 couverts, 0 écart**. Les cibles chiffrées qui dépendent d'un
test de charge (p95, capacité) sont marquées `mesure` et **non déclarées
atteintes** — le principe P3 du CDC interdit d'afficher un chiffre non tracé.

> Les services sont testés sans base : `tests/helpers/fakePrisma.mjs` remplace les délégués Prisma par
> un magasin en mémoire (filtres scalaires, `in/gte/lt`, `has/hasEvery`, `OR/NOT`, `orderBy`,
> `take/skip`, `groupBy` avec `_count/_max/_min/_sum/_avg`, `aggregate`, `increment`, `$transaction`
> des deux formes). Les parcours e2e, eux, tournent sur un vrai PostgreSQL embarqué avec un GoTrue
> simulé (`tests/e2e/support/`).

---

## 9. Tâches planifiées (`src/jobs/index.js`)

Sept tâches idempotentes portent les règles qui ne peuvent pas dépendre d'un appel utilisateur.
Chacune renvoie un compte-rendu journalisé, visible dans `GET /admin/jobs`, et peut être déclenchée
à la main (audité `job.run`) via `POST /admin/jobs/:name/run`.

| Tâche | Cadence | Règle CDC |
|---|---|---|
| `listings.expire` | 5 min | MKT-06 — annonces échues → `EXPIRED` (mises à jour conditionnelles) |
| `orders.expirePending` | 15 min | ORD-02 — commande `PENDING` sans réponse au-delà de `ORDER_RESPONSE_DAYS` → `CANCELLED` + événement motivé |
| `dataroom.expireAccess` | 1 h | DR-02 — accès data room échus → `EXPIRED` + journal d'accès `EXPIRE` |
| `apikeys.expire` | 1 h | API-02 — clés expirées → `REVOKED` (ne fonctionnent plus) |
| `disputes.sla` | 6 h | DISP-02 — litige ouvert > `DISPUTE_SLA_DAYS` → alerte modérateurs, **une par jour et par litige** |
| `notifications.purge` | 24 h | NOTIF-02 — notifications **lues** > `NOTIFICATION_RETENTION_DAYS` supprimées ; les non lues sont conservées |
| `iot.markSilent` | 6 h | IOT-03 — capteur silencieux > `IOT_SILENCE_HOURS` signalé à son organisation |

Réglages : `JOBS_ENABLED=false` désactive le planificateur (déploiement « API seule » ou worker dédié).

---

## 10. Ce qui reste à faire avant production

Le périmètre **fonctionnel V1 → V5 est couvert et prouvé** (213/213 exigences, `npm run verify` vert).
Ce qui reste est de l'**exploitation**, pas du code manquant :

1. **Base réelle** : `npm run prisma:deploy` sur Supabase, `npm run seed`, puis rejouer `npm run test:e2e`
   contre l'instance (les 31 parcours tournent aujourd'hui sur PostgreSQL embarqué + GoTrue simulé).
   Voir `docs/DEPLOYMENT.md` (RLS, RPO/RTO, proxy, supervision).
2. **Fournisseurs externes** à brancher derrière les interfaces déjà en place (aucun contrat de service
   n'est simulé en production) : SMS/WhatsApp Business, email transactionnel, FCM/APNs (le temps réel
   Socket.IO est opérationnel), météo, imagerie satellite NDVI, stockage objet des PDF (factures,
   rapports d'impact, précision, exports).
3. **Clés et secrets** : `MFA_ENCRYPTION_KEY`, `API_KEY_PEPPER`, clés Supabase, `WEBHOOK_SECRET` par
   fournisseur — à provisionner par environnement (`.env.example` liste tout, sans valeur par défaut
   dangereuse).
4. **Conformité** : validation juridique des mentions (aucune activité financière régulée, aucun score
   de crédit, « ce n'est pas une certification »), DPA avec les partenaires de données, durée de
   conservation du journal d'audit et des journaux d'accès à la data room.
5. **Passage à l'échelle** : revue des index sur les requêtes de matching (volume `listing`/`request`),
   bascule du planificateur `node-cron` vers un exécuteur distribué si plusieurs instances.
