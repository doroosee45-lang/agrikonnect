# API — AGRIKONNECT AFRICA (V1 · FARM)

Base : `/api/v1`
Auth : `Authorization: Bearer <access_token Supabase>`
Tenant : `X-Organization-Id: <organizationId>` (facultatif — par défaut l'organisation individuelle du producteur)

## Format des réponses (CDC §13.1 / A.5)

```json
// Succès
{ "success": true, "message": "…", "data": { }, "meta": { "page": 1, "limit": 20, "total": 134 } }

// Erreur
{ "success": false, "message": "Validation error",
  "errors": [{ "field": "email", "code": "Email invalide" }],
  "requestId": "5f2c…" }
```

| Code | Usage |
|---|---|
| 200 / 201 / 204 | succès / création / suppression logique |
| 401 | non authentifié |
| 403 | authentifié mais permission manquante |
| 404 | inexistant **ou non visible** (anti-énumération) |
| 409 | conflit (doublon, transition invalide) |
| 422 | validation |
| 429 | limite de débit |

---

## 1. Public — aucune authentification

| Méthode | Route | Description |
|---|---|---|
| GET | `/public/farms/:slug` | Profil public (projection dédiée, contacts masqués) |
| GET | `/public/farms` | Annuaire public paginé (SEO) |
| POST | `/public/farms/:slug/contact` | Formulaire de contact sans révéler les coordonnées (PUB-06) |
| GET | `/public/map?bbox=minLng,minLat,maxLng,maxLat&countryCode&province&cropId` | Carte agricole : GeoJSON FeatureCollection, positions **approximatives** |
| GET | `/countries` · `/countries/:code` | Référentiel pays (devises, langues, découpage, unités) |
| GET | `/crops` · `/crops/:id` | Catalogue des cultures |

---

## 2. Authentification (AUTH-01 → AUTH-07)

| Méthode | Route | Corps | Notes |
|---|---|---|---|
| POST | `/auth/register` | `accountType, firstName, lastName, email?, phone?, password, locale, countryCode, cooperativeName?` | Crée compte Supabase + profil + organisation INDIVIDUAL (tenant) + membership |
| POST | `/auth/login` | `identifier` (email ou téléphone), `password` | 5 échecs → blocage 15 min |
| POST | `/auth/refresh` | `refreshToken` | Rotation gérée par Supabase |
| POST | `/auth/logout` | — | Révocation de session |
| POST | `/auth/send-otp` | `phone` | 🔒 5 envois/heure max, TTL 10 min |
| POST | `/auth/verify-phone` | `code`, `phone?` | OTP haché en base, 5 essais max |
| POST | `/auth/resend-verification` | `email` | Lien email |
| POST | `/auth/verify-email` | `tokenHash` | Vérifie le lien Supabase |
| POST | `/auth/forgot-password` | `email` | Réponse identique si compte inconnu |
| POST | `/auth/reset-password` | `tokenHash, password` | Jeton à usage unique |
| POST | `/auth/sync-profile` | — | 🔒 Crée le profil d'un utilisateur Supabase existant |

---

## 3. Compte & organisations

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/me` | Profil + complétude (critères cochés) + compteurs |
| PATCH | `/me` | Mise à jour (nouveau téléphone → re-vérification requise) |
| GET | `/me/permissions` | Rôles effectifs + permissions |
| POST | `/me/password` | Changement de mot de passe |
| DELETE | `/me` | Suppression logique |
| GET / POST | `/organizations` | Liste / création (COOPERATIVE ou COMPANY) |
| GET / PATCH | `/organizations/:id` | Détail / mise à jour (membre uniquement) |

---

## 4. Exploitations, parcelles, historique (FARM / PLOT)

| Méthode | Route | Notes |
|---|---|---|
| GET / POST | `/farms` | Liste paginée / création (id client ULID accepté) |
| GET / PATCH / DELETE | `/farms/:id` | Détail / mise à jour / archivage logique |
| PATCH | `/farms/:id/publish` | `{ isPublic }` — refuse si compte non vérifié |
| GET / POST | `/plots` | Liste / création (superficie calculée depuis le polygone) |
| GET / PATCH / DELETE | `/plots/:id` | Détail / mise à jour / archivage |
| GET / POST | `/plots/:id/crop-history` | Historique cultural + frise chronologique (PLOT-03) |
| PATCH | `/plots/:id/crop-history/:historyId` | Correction historisée |

---

## 5. Productions (PROD-01 → PROD-04)

| Méthode | Route | Notes |
|---|---|---|
| GET / POST | `/productions` | Déclaration marquée `source: declared` |
| GET / PATCH / DELETE | `/productions/:id` | Toute modification est auditée |
| GET | `/productions/stats?groupBy=crop\|plot\|month\|year` | Agrégations réelles ; expose `recordsWithoutKg` |

---

## 6. Soil & Crop Intelligence — piste S1

| Méthode | Route | Notes |
|---|---|---|
| GET | `/plots/:id/soil-assessments` | Analyses avec provenance complète |
| GET | `/plots/:id/soil-profile` | Dernier profil + paramètres manquants + avertissement |
| POST | `/plots/:id/soil-assessments` | Chaque paramètre : `value, unit, source, method, confidence, measuredAt` |
| PATCH / DELETE | `/plots/:id/soil-assessments/:assessmentId` | Mise à jour / archivage |

> Aucune recommandation de culture en V1 (S1 = collecte et affichage uniquement).

---

## 7. Coopératives (COOP-01 → COOP-05)

| Méthode | Route | Notes |
|---|---|---|
| GET / PATCH | `/cooperatives/current` | Coopérative de l'organisation active |
| GET / POST | `/cooperatives/:id/members` | Liste / invitation (consentement enregistré) |
| POST | `/cooperatives/:id/members/import` | CSV : rapport **ligne par ligne**, doublons, `dryRun` |
| PATCH | `/cooperatives/:id/members/:memberId` | Statut / portées de consentement |
| GET | `/cooperatives/:id/overview` | Consolidation limitée aux portées autorisées (COOP-05) |

---

## 8. Médias, vérification, signalements

| Méthode | Route | Notes |
|---|---|---|
| POST | `/media/upload-url` | URL signée (MIME + 5 Mo contrôlés), upload direct au stockage |
| POST | `/media/:id/confirm` | Confirmation après envoi |
| GET / DELETE | `/media` · `/media/:id` | Liste / suppression logique |
| POST | `/verifications` | Demande avec documents privés |
| GET | `/verifications/me` | Mes demandes + critères cochés (VER-05) |
| GET | `/admin/verifications` | File de revue (ADMIN) |
| PATCH | `/admin/verifications/:id` | Approbation / rejet **motivé** + notification + audit |
| POST | `/reports` | Signalement |
| GET / PATCH | `/admin/reports` · `/admin/reports/:id` | Modération |

---

## 9. Tableau de bord & administration

| Méthode | Route | Notes |
|---|---|---|
| GET | `/dashboard` | Tuiles + `source` de chaque agrégation + onboarding |
| GET | `/admin/dashboard` | Compteurs globaux calculés à la requête |
| GET / PATCH | `/admin/users` · `/admin/users/:id/status` | Suspension motivée, garde-fou SUPER_ADMIN |
| GET | `/admin/audit` | Journal d'audit filtrable |
| GET / PUT | `/admin/settings` | Paramètres applicatifs |
| GET | `/admin/export/farms` | CSV (export journalisé) |
| GET | `/admin/jobs` | État des tâches planifiées : description, fréquence, dernier passage, dernière erreur |
| POST | `/admin/jobs/:name/run` | Exécution manuelle auditée (`job.run`) — jamais besoin de redémarrer le serveur |

### Tâches planifiées (`src/jobs/index.js`)

Désactivables par `JOBS_ENABLED=false` (tests, workers dédiés). Chaque tâche est **idempotente** :
rejouer ne double aucun effet, et les mises à jour sont conditionnelles pour ne jamais écraser une
décision prise entre-temps par un utilisateur.

| Tâche | Fréquence | Effet | Réglage |
|---|---|---|---|
| `listings.expire` | 5 min | `PUBLISHED`/`RESERVED` → `EXPIRED` au-delà de `expiresAt` | — |
| `orders.expirePending` | 15 min | `PENDING` → `CANCELLED` sans réponse vendeur, + `OrderEvent` + notification | `ORDER_RESPONSE_DAYS` (7) |
| `dataroom.expireAccess` | 1 h | `GRANTED` → `EXPIRED` + entrée `EXPIRE` au journal d'accès (append-only) | — |
| `apikeys.expire` | 1 h | Clés `ACTIVE` échues → `REVOKED` (audité) | — |
| `disputes.sla` | 6 h | Alerte la modération sur les litiges ouverts au-delà du SLO | `DISPUTE_SLA_DAYS` (5) |
| `notifications.purge` | 24 h | Supprime les notifications **lues** au-delà de la rétention | `NOTIFICATION_RETENTION_DAYS` (90) |
| `iot.markSilent` | 6 h | Signale les capteurs muets (une alerte par organisation et par jour) | `IOT_SILENCE_HOURS` (24) |

Aucune tâche ne produit de verdict agronomique ni ne déplace d'argent : elles ne font qu'appliquer des
échéances déjà décidées par un humain.

### Taux de change (GLB-03)

| Méthode | Route | Permission | Notes |
|---|---|---|---|
| GET | `/countries/fx-rates?base=USD&quote=CDF` | `fx.read` | Dernière cotation connue + `ageHours`, `stale` au-delà de 48 h |
| GET | `/countries/fx-rates/pairs?base=USD` | `fx.read` | Toutes les paires connues et leur fraîcheur |
| PUT | `/countries/fx-rates` | `fx.write` | Enregistrement daté et sourcé, idempotent sur `(base, quote, asOf)` |

Sans cotation enregistrée, la réponse est `available: false` — **aucun taux par défaut n'est supposé** :

```json
{
  "base": "USD", "quote": "CDF", "rate": null, "available": false,
  "message": "Aucune cotation USD/CDF enregistrée. Aucune conversion ne peut être produite…"
}
```

---

## 10. V2 — MARKET

En-tête **`Idempotency-Key`** requis sur : `POST /orders`, `POST /inventory/movements`, `POST /ai/analyses`.

### Annonces (MKT-01 → MKT-06)

| Méthode | Route | Permission | Notes |
|---|---|---|---|
| GET | `/listings` | `listings.read` | Filtres : `q`, `cropId`, `type`, `countryCode`, `province`, `minQuantity`, `maxQuantity`, `minPrice`, `maxPrice`, `certification`, `sellerType`, `mine` |
| POST | `/listings` | `listings.write` | Créée en `DRAFT` |
| GET | `/listings/:id` | `listings.read` | Un brouillon reste 404 pour les tiers |
| PATCH | `/listings/:id` | `listings.write` | Refusé si `SOLD_OUT`/`ARCHIVED`/`EXPIRED` |
| PATCH | `/listings/:id/status` | `listings.write` | Transitions contrôlées (409 sinon) ; renvoie `{listing, warnings}` |
| POST | `/listings/:id/photos` | `listings.media` | Rattache des médias déjà téléversés (`mediaIds`, 10 max) |
| POST | `/listings/:id/contact` | `messages.write` | Ouvre (ou réutilise) le fil vendeur ↔ acheteur, sans exposer de coordonnées |
| PATCH | `/listings/:id/moderate` | `listings.moderate` | Motif obligatoire, audité |
| DELETE | `/listings/:id` | `listings.write` | Archivage logique |

`PATCH /listings/:id/status` renvoie **toujours** un tableau `warnings` : une annonce publiée sans photo
est acceptée (le producteur peut publier depuis le terrain) mais signalée comme non recommandée :

```json
{
  "success": true,
  "data": {
    "listing": { "id": "lst_…", "status": "PUBLISHED" },
    "warnings": [{ "field": "photos", "code": "recommended", "message": "Aucune photo : …" }]
  }
}
```

Une quantité nulle ou négative reste, elle, **bloquante** (422).

### Demandes d'achat & matching explicable (REQ-01 → REQ-05)

| Méthode | Route | Permission |
|---|---|---|
| GET / POST | `/purchase-requests` | `requests.read` / `requests.write` |
| GET / PATCH | `/purchase-requests/:id` | `requests.read` / `requests.write` |
| GET | `/purchase-requests/:id/matches` | `requests.read` |

`GET /purchase-requests/:id/matches?minVolumeRatio=0.25&maxDistanceKm=300` renvoie pour chaque annonce :

```json
{
  "listingId": "lst_…",
  "criteria": [{ "key": "volume", "label": "Volume ≥ 25 % de la demande", "satisfied": true, "detail": "…" }],
  "matched": 4, "total": 6,
  "rank": { "byCriteria": 4, "verifiedSeller": true, "freshness": "…" },
  "explainingOrder": "4/6 critères satisfaits, puis vendeur vérifié, puis fraîcheur"
}
```

Aucune coordonnée n'est exposée : seul le nom commercial et le pays du vendeur le sont.

### Offres (REQ-04)

| Méthode | Route | Permission |
|---|---|---|
| POST / GET | `/market/purchase-requests/:id/offers` | `offers.write` / `offers.read` |
| PATCH | `/market/offers/:offerId` | `offers.write` — `ACCEPTED` · `REJECTED` · `WITHDRAWN` (+ `counter`) |

### Commandes (ORD-01 → ORD-05)

| Méthode | Route | Permission | Notes |
|---|---|---|---|
| POST | `/orders` | `orders.write` | `Idempotency-Key` + snapshot des conditions |
| GET | `/orders?role=buyer\|seller&status=…` | `orders.read` | |
| GET | `/orders/:id` | `orders.read` | `allowedTransitions` renvoyé |
| GET | `/orders/:id/events` | `orders.read` | Journal **immuable** : `from`, `to`, `actorId`, `actorOrgId`, `reason`, `at` |
| PATCH | `/orders/:id/status` | `orders.write` | Machine à états, 409 si transition interdite |
| PATCH | `/orders/:id/payment` | `orders.write` | `DECLARED_UNPAID` / `DECLARED_PAID` (déclaratif) |
| POST | `/orders/:id/disputes` | `orders.write` | Ouvre le litige → statut `DISPUTED` |
| GET | `/orders/admin/disputes` | `orders.review` ou `disputes.read` | File des litiges (`status`, `orderId`), avec âge et SLA — sans coordonnées |
| PATCH | `/orders/admin/disputes/:id` | `disputes.review` | Décision motivée du modérateur |

Transitions (CDС V2 §8.4) :

```
PENDING   → ACCEPTED | REJECTED (vendeur) | CANCELLED (acheteur)
ACCEPTED  → PROCESSING (vendeur) | CANCELLED | DISPUTED
PROCESSING→ READY (vendeur) | DISPUTED
READY     → IN_TRANSIT (vendeur) | DISPUTED
IN_TRANSIT→ DELIVERED (vendeur/acheteur) | DISPUTED
DELIVERED → COMPLETED (acheteur) | DISPUTED
DISPUTED  → COMPLETED | CANCELLED (modérateur)
```

L'acceptation réserve le stock par mise à jour conditionnelle : **la survente est impossible** (409).
L'annulation restitue le stock réservé (`RESERVATION` inverse) et remet l'annonce en `PUBLISHED` ;
elle n'est plus possible à partir de `IN_TRANSIT`.

Chaque transition écrit un `OrderEvent` (append-only) : la suite `GET /orders/:id/events` est la
seule source de vérité pour l'historique, y compris les motifs de refus, d'annulation et de litige.

### Stocks (STK-01 → STK-02)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/inventory` | `inventory.read` — solde **dérivé** + alertes |
| POST | `/inventory` | `inventory.write` — article |
| GET | `/inventory/:id/movements` | `inventory.read` — journal + solde recalculé |
| POST | `/inventory/movements` | `inventory.write` — `IN` `OUT` `LOSS` `TRANSFER` `INVENTORY` `RESERVATION` `RELEASE` |

Le solde n'est jamais écrit : il est recalculé depuis le journal. Un mouvement qui rendrait le solde
négatif est refusé (409) et doit passer par un `INVENTORY` justifié.

### Transport (TRA-01 → TRA-03)

| Méthode | Route | Permission |
|---|---|---|
| GET / POST | `/transport/requests` | `transport.read` / `transport.write` |
| POST | `/transport/requests/:id/offers` | `transport.write` |
| POST | `/transport/offers/:id/accept` | `transport.write` |
| POST | `/transport/requests/:id/proof-of-delivery` | `transport.write` (transporteur assigné) |
| PATCH | `/transport/requests/:id/status` | `transport.write` — `PICKED_UP` `IN_TRANSIT` `DELIVERED` `FAILED` `CANCELLED` |

`DELIVERED` est refusé tant qu'aucune preuve (photos + réceptionnaire) n'est déposée.

### Messagerie (MSG-01 → MSG-03)

| Méthode | Route | Permission |
|---|---|---|
| POST / GET | `/messaging/conversations` | `messages.write` / `messages.read` |
| GET / POST | `/messaging/conversations/:id/messages` | `messages.read` / `messages.write` |
| POST | `/messaging/conversations/:id/archive` | `messages.write` |
| POST | `/messaging/messages/:id/report` | `messages.write` |

`subjectType` ∈ `LISTING` · `ORDER` · `TRANSPORT` · `DISPUTE` · `PROJECT` ; chaque participant doit être
partie au dossier, sinon 403. Un non-participant reçoit **404** (jamais 403 : l'existence du fil n'est
pas révélée). Un fil déjà ouvert sur le même dossier est réutilisé (`replayed: true`), jamais dupliqué.

Règles de contenu : une pièce jointe doit être une URL `http(s)` ou une clé de stockage interne
(sinon 422) ; un message signalé est **conservé** (masqué côté public uniquement) ; les accusés de
lecture sont par utilisateur (`readBy`) et alimentent le compteur `unread` de `GET /messaging/conversations`.

Pagination d'un fil : `GET /messaging/conversations/:id/messages?limit=30&before=<ISO>` — `nextCursor`
permet de remonter l'historique sans doublon.

### Temps réel (Socket.IO)

Le serveur expose Socket.IO sur le même port HTTP, **chemin `/realtime`** (désactivable via
`REALTIME_ENABLED=false` pour les tests). La taille maximale d'un message est plafonnée à 100 Ko et la
liste des origines autorisées reprend `CORS_ORIGIN`.

```js
import { io } from 'socket.io-client';

const socket = io('https://api.agrikonnect.africa', {
  path: '/realtime',
  auth: { token: supabaseSession.access_token },
});

socket.on('ready', ({ userId, organizationIds, conversationIds }) => { /* … */ });
socket.on('message:new', ({ conversationId, message }) => { /* … */ });
socket.on('message:read', ({ conversationId, userId }) => { /* … */ });
socket.on('notification:new', ({ id, type, title }) => { /* … */ });
socket.on('order:new', ({ orderId, number }) => { /* … */ });
```

| Événement (client → serveur) | Effet |
|---|---|
| `conversation:join` / `conversation:leave` | Rejoint / quitte la room d'un fil (vérifié : le socket doit être participant) |
| `typing` | Diffusé uniquement aux fils dont le socket est membre, expire au bout de 5 s |
| `ping:app` | Réponse `pong:app` avec la latence serveur |

Capacités (`io.emit`) : `namespaces` distincts absents, rooms `user:<id>`, `org:<id>`,
`conversation:<id>`. **Les écritures restent exclusivement REST** : le socket ne sert qu'à la
notification temps réel, jamais à créer une commande ou un message.

### Notifications (NOTIF-01 → NOTIF-04)

`GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read` ·
`GET /notifications/preferences` · `PUT /notifications/preferences` (type × canal).

### Facturation (BIL-01 → BIL-04)

| Méthode | Route | Permission |
|---|---|---|
| GET / POST | `/billing` | `invoices.read` / `invoices.write` |
| GET | `/billing/:id` | `invoices.read` — contrôle de cohérence du total |
| POST | `/billing/:id/settlement` | `invoices.write` — règlement **déclaré** hors plateforme |

Numérotation `FAC-AAAA-00001` par organisation et par type, sans trou. Un `fxRate` incomplet
(valeur, date **et** source) est refusé en 400.

### Avis

`POST /reviews/orders/:orderId/reviews` (après `DELIVERED`/`COMPLETED`) ·
`POST /reviews/reviews/:id/response` · `POST /reviews/reviews/:id/report` ·
`POST /reviews/reviews/:id/moderate` (`reviews.moderate` — `KEEP` / `REMOVE` = masquage, jamais
suppression) · `GET /reviews/organizations/:organizationId/reputation` (moyenne **+ nombre d'avis**).

Un avis sans commande livrée est refusé (409) ; un second avis sur la même commande aussi (409).

---

## 11. V3 — INTELLIGENCE

### Synchronisation offline (SYNC-01 → SYNC-04)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/sync/collections` | `sync.write` — contrat des collections synchronisables |
| POST | `/sync/push` | `sync.write` — ≤ 200 opérations, `opId` unique |
| GET | `/sync/conflicts?days=7&onlyConflicts=true` | `sync.write` |

Réponse : `results[]` (`APPLIED` · `DUPLICATE` · `CONFLICT` · `REJECTED`), `summary`,
`conflicts[]` et `conflictPolicy: "lastWriterWinsRefused"`. Un conflit **n'écrase jamais** la version serveur.

### IA assistée (AI-01 → AI-06)

| Méthode | Route | Permission |
|---|---|---|
| POST | `/ai/analyses` | `ai.write` — `Idempotency-Key` |
| GET | `/ai/analyses` · `/ai/analyses/:id` | `ai.read` |
| POST | `/ai/analyses/:id/escalate` | `ai.write` — escalade agronome |
| POST | `/ai/analyses/:id/feedback` | `ai.write` |

Toute réponse contient `disclaimer`, `confidence.{level,label}` et
`provenance.{promptVersion, model, generatedAt}`. `consentGiven: true` est **obligatoire** pour
`PLANT_PHOTO` et `DOCUMENT` (400 sinon). Quotas : 50 analyses/24 h/utilisateur, 500/24 h/organisation (429).

### Météo · Prix (WEA / PRI) — donnée datée et sourcée

| Méthode | Route | Permission |
|---|---|---|
| GET | `/weather/plots/:plotId` · `/history` · `/alerts` | `weather.read` |
| POST | `/weather` | `weather.read` (agent / import) |
| GET | `/prices` · `/prices/series` | `prices.read` |
| POST | `/prices` | `prices.write` |
| GET | `/prices/stale-markets` | `prices.write` |

Sans donnée, la réponse est `available: false` avec un message explicite : **aucune valeur inventée**.
Les alertes citent la règle (`rainfallMm >= 50`) et la source.

### Traçabilité (LOT-01 → LOT-04)

| Méthode | Route | Permission |
|---|---|---|
| GET / POST | `/lots` | `lots.read` / `lots.write` |
| GET | `/lots/:id` | `lots.read` |
| POST | `/lots/:id/events` | `lots.write` — **append-only** |
| PUT | `/lots/:id/public-fields` | `lots.write` — champs publiables uniquement |
| POST | `/lots/:id/recall` | `lots.write` |
| GET (public) | `/public/lots/:code` | — (réponse limitée à `publicFields`, rate-limit dédié) |

Aucun endpoint de mise à jour ou de suppression d'événement n'existe : le journal est immuable.

### Certifications (CERT-01 → CERT-04)

`GET/POST /certifications` · `GET /certifications/:id` ·
`GET /certifications/organization/:organizationId` ·
`PATCH /certifications/:id/verify` (admin/vérificateur) · `DELETE /certifications/:id`.

Toute déclaration naît `PENDING`. `effectiveStatus`, `expiresInDays`, `expiringSoon` et `trusted`
sont calculés côté serveur ; une certification expirée ne peut plus être vérifiée.

### IoT (IOT-01 → IOT-04)

| Méthode | Route | Auth |
|---|---|---|
| POST | `/iot/ingest` | clé d'appareil (`deviceKey`) — **sans JWT** |
| GET / POST | `/iot/devices` | `iot.read` / `iot.write` |
| POST | `/iot/devices/:id/rotate-key` · `/revoke` | `iot.write` |
| GET | `/iot/devices/:id/readings` | `iot.read` — trous de mesure signalés |

La clé d'appareil est renvoyée **une seule fois** à l'enregistrement ; seule son empreinte SHA-256 est stockée.

### Géodonnées (GEO-01 → GEO-03)

`GET /geodata/plots/:plotId/observations` (vue consolidée avec provenance par ligne) ·
`GET/POST /geodata/plots/:plotId/satellite` · `GET/POST /geodata/plots/:plotId/drones` ·
`GET/POST /geodata/plots/:plotId/lab-results` (écriture réservée au laboratoire partenaire ou à l'admin).

---

## 12. V4 — INVEST

### Projets (PRJ-01 → PRJ-05)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/projects` | `projects.read` — publiés uniquement, provenance résumée |
| POST | `/projects` | `projects.write` — brouillon |
| GET | `/projects/:idOuSlug` | `projects.read` — vue publique réduite si non-propriétaire |
| PATCH | `/projects/:id` | `projects.write` |
| POST | `/projects/:id/submit` | `projects.write` — exige `fundingNeed`, `impact`, `durationMonths`, `milestones` |
| PATCH | `/projects/:id/review` | `projects.review` — `PUBLISHED` ou `REJECTED` motivé |

`fieldStatus` porte la provenance **champ par champ**. Un producteur ne peut pas s'attribuer
`platform_verified` (403). Les formulations « rendement garanti », « capital garanti »… sont rejetées (400).

### Data room (DR-01 → DR-05)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/dataroom/projects/:projectId/documents` | `dataroom.read` — 403 si aucun accès actif |
| POST | `/dataroom/projects/:projectId/documents` | `dataroom.write` — téléchargement désactivé par défaut |
| POST | `/dataroom/projects/:projectId/access-requests` | `dataroom.request` — justification + portée + durée |
| PATCH | `/dataroom/access-requests/:id` | `dataroom.decide` — accord/refus, expiration ≤ 90 j |
| GET | `/dataroom/documents/:id?download=true` | `dataroom.read` — 403 si non autorisé |
| GET | `/dataroom/projects/:projectId/access-log` | `dataroom.write` — journal append-only |

Chaque tentative (y compris refusée : `LIST_DENIED`, `OPEN_DENIED`, `DOWNLOAD_DENIED`) est journalisée
avec IP et appareil. Un accès expiré est automatiquement basculé en `EXPIRED`.

### Due diligence (DD-01 → DD-03)

`POST /projects/:projectId/due-diligence/checklist` (5 catégories) ·
`GET /projects/:projectId/due-diligence` (propriétaire ou professionnel uniquement) ·
`PATCH /due-diligence/:id` · `POST /due-diligence/:id/evidence`.

`VERIFIED` exige un rôle habilité **et** `professionalName` + `professionalCapacity` (422 sinon).

### Reporting (REP-01 → REP-03)

`GET /projects/:projectId/reports` · `POST /projects/:projectId/progress-reports` ·
`POST /projects/:projectId/impact-reports` (source obligatoire par indicateur) — horodatage serveur,
correction par nouveau rapport (jamais de réécriture).

### Financement (FUND-01 → FUND-03)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/funding/projects/:projectId/funding-requests` | `funding.read` |
| POST | `/funding/projects/:projectId/funding-requests/consent` | `funding.write` — aperçu du contenu transmis |
| POST | `/funding/funding-requests/:id/transmit` | `funding.write` — **exige `consentId` + `consentGiven: true`** |
| PATCH | `/funding/funding-requests/:id/follow-up` | `funding.write` |

Sans consentement valide : 403 et aucune transmission. Le dossier transmis est le **snapshot** consenti.

### Investisseurs (INV-01 → INV-03)

`GET /investors/me` · `PUT /investors/me` · `PATCH /investors/:userId/verify` (admin).

`dataRoomAccess` n'est `true` que si le profil est vérifié **et** la MFA active ; l'accès est refusé
au niveau service, pas seulement dans l'interface.

### Précision (PRE-01 → PRE-03)

`GET/POST /precision/plots/:plotId/management-zones` (versionnées par `methodVersion`, sources déclarées,
refus si aucune source disponible) · `GET/POST /precision/plots/:plotId/precision-reports` ·
`PATCH /precision/precision-reports/:id/validate` (agronome identifié, `validatedAt` serveur).

### Tableau de bord investisseur

`GET /invest/dashboard` — KPI réels, projets publiés avec `verifiedFields`, rappels de non-garantie.
Accès conditionné à un profil vérifié + MFA.

---

## 13. V5 — GLOBAL

### Appels d'offres (TEN-01 → TEN-03)

`GET/POST /tenders` · `GET /tenders/:id` (les réponses des concurrents ne sont jamais exposées) ·
`POST /tenders/:id/responses` (une seule par vendeur, refusée après la date limite) ·
`POST /tenders/:id/award` · `POST /tenders/:id/close`.

### Export (EXP-01 → EXP-03)

`GET/POST /exports` · `GET /exports/:id` (conformité documentaire + conversion) ·
`POST /exports/:id/documents` · `PATCH /exports/:id/status`.

Incoterm obligatoire et contrôlé ; hors USD, un `fxRate { value, date, source }` est exigé ;
`CERTIFIED` est refusé si `INVOICE`, `CERTIFICATE_OF_ORIGIN`, `PHYTOSANITARY` ou `BILL_OF_LADING` manque.

### Clients API & clés (API-01 → API-04)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api-clients/clients` | `apiclients.read` |
| POST | `/api-clients/clients` | `apiclients.manage` — finalité ≥ 20 caractères |
| PATCH | `/api-clients/clients/:id/purpose` | `apiclients.manage` — **approbation obligatoire** |
| POST | `/api-clients/clients/:id/keys` | `apiclients.manage` — clé affichée une seule fois (max 5 actives) |
| DELETE | `/api-clients/keys/:id` | `apiclients.manage` — révocation immédiate |
| GET | `/api-clients/clients/:id/usage` | `apiclients.read` — quota + journal |

### Produits de données (DATA-01 → DATA-04)

`GET /data` (publiés) · `POST /data` · `PATCH /data/:id/status` ·
`POST /data/:id/aggregates` · `GET /data/:id/aggregates` · `POST /data/contracts`.

`minGroupSize` est plancher à **5**. Un groupe plus petit que le seuil n'est **pas calculé** :
il apparaît seulement dans `suppressed[]` (sans valeur). Chaque agrégat porte `composition`
(déclaré / mesuré / estimé) et `ruleVersion` ; aucun minimum, maximum ni identifiant d'exploitation
n'est exposé.

### API publique de données (clé d'API)

| Méthode | Route | Portée |
|---|---|---|
| GET | `/public-api/v1/products` | `data:read` |
| GET | `/public-api/v1/products/:id/aggregates` | `aggregates:read` — contrat de données actif requis |
| GET | `/public-api/v1/prices` | `prices:read` |

En-tête `X-API-Key`. Refus si finalité non approuvée, clé expirée/révoquée, contrat absent ou expiré,
ou quota journalier atteint (`API_DAILY_QUOTA`, défaut 1000/24 h).

---

### Observatoire pays (INS-01 → INS-03)

Destinataires : administration pays, bailleurs. Ce ne sont **pas** des données de marché ouvertes.

| Méthode | Route | Permission | Notes |
|---|---|---|---|
| GET | `/insights/overview?countryCode=CD` | `insights.read` | Indicateurs + `source`, `method`, `computedAt` |
| GET | `/insights/crops?countryCode=CD` | `insights.read` | Volumes déclarés par culture, triés |
| GET | `/insights/activity?countryCode=CD&months=6` | `insights.read` | Série mensuelle (annonces, commandes, projets) |
| GET | `/insights/disclosure-policy` | authentifié | Politique de divulgation appliquée |

Trois garanties vérifiables dans la réponse :

1. **k-anonymat** — aucun indicateur sous `AGGREGATE_MIN_GROUP_SIZE` organisations ; la valeur vaut
   `null` avec un motif, jamais `0` (qui serait une information fausse).
2. **Provenance** — chaque indicateur porte `source`, `method`, `computedAt`.
3. **Aucune donnée personnelle** — décomptes d'organisations et volumes agrégés uniquement, et la
   `caveat` rappelle que les volumes sont **déclarés**, non mesurés.

```json
{
  "countryCode": "CD",
  "indicators": {
    "producers": { "value": 128, "unit": "organisations", "source": "farms",
                   "method": "organisations distinctes possédant au moins une exploitation", "computedAt": "…" },
    "declaredVolumeKg": { "value": null, "unit": "kg", "source": "productions",
                          "method": "somme de Production.quantityKg",
                          "reason": "groupe de 3 organisation(s) < seuil de k-anonymat (10)" }
  },
  "disclosure": { "minGroupSize": 10, "personalData": "Aucune donnée personnelle…" }
}
```

---

## 14. Contrat OpenAPI et tests

```bash
npm run docs:openapi   # régénère src/docs/openapi.json (174 chemins / 226 opérations)
npm test               # tests de logique pure (node --test)
npm run check:fields   # vérifie modèles et clés Prisma utilisées dans le code
npm run check:perms    # vérifie que toute permission utilisée est déclarée
```

Le contrat est servi par `GET /api/v1/docs/openapi.json` et résumé par `GET /api/v1/docs`.

---

## Codes d'erreur applicatifs fréquents

`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `RATE_LIMITED` · `AUTH_RATE_LIMITED` · `INTERNAL_ERROR`

## Permissions (`ressource.action`)

`farms.read|write|delete` · `plots.read|write|delete` · `history.read|write` ·
`productions.read|write` · `soil.read|write` · `cooperatives.read|write|members` ·
`media.upload|delete` · `verifications.create|read|review` · `reports.create|review` ·
`crops.read|write` · `admin.users|audit|settings|dashboard` · `countries.read|write`

**V2** : `listings.read|write|moderate` · `requests.read|write` · `offers.read|write` ·
`orders.read|write|review` · `inventory.read|write` · `transport.read|write` · `messages.read|write` ·
`notifications.read` · `invoices.read|write` · `reviews.read|write|moderate` · `disputes.read|review`

**V3** : `sync.write` · `ai.read|write|review` · `weather.read` · `prices.read|write` ·
`lots.read|write` · `certifications.read|write|verify` · `iot.read|write` · `geodata.read|write` · `lab.read|write`

**V4** : `projects.read|write|review` · `investors.read|write|verify` · `dataroom.read|write|request|decide` ·
`duediligence.read|write` · `reporting.read|write` · `funding.read|write` · `precision.read|write`

**V5** : `tenders.read|write|respond` · `export.read|write` · `apiclients.read|manage` ·
`insights.read` · `dataproducts.manage`

Total : **99 permissions déclarées**, **92 utilisées** par les routes.

---

## Soil & Crop Intelligence — S2 / S3 (V2 §6, V3 §6)

| Méthode | Chemin | Permission | Rôle |
|---|---|---|---|
| `GET` | `/plots/:id/soil-profile` | `soil.read` | Profil **fusionné** multi-sources (priorité labo > capteur > satellite > photo > déclaré) |
| `GET` | `/plots/:id/suitability` | `soil.read` | Historique des évaluations de compatibilité |
| `POST` | `/plots/:id/suitability` | `soil.recommend` | Évalue la compatibilité culture/parcelle |
| `GET` | `/plots/:id/suitability/:suitabilityId` | `soil.read` | Réponse « pourquoi ? » détaillée |
| `GET` | `/plots/:id/rotation-plans` | `soil.read` | Rotations proposées et statuts |
| `POST` | `/plots/:id/rotation-plans` | `soil.recommend` | Propose une rotation (jeu de règles validé) |
| `PATCH` | `/plots/:id/rotation-plans/:planId` | `soil.recommend` | Accepte / refuse une rotation |
| `GET` | `/plots/:id/farming-plans` | `soil.read` | Plans agricoles pluriannuels |
| `POST` | `/plots/:id/farming-plans` | `soil.recommend` | Construit un plan (calendrier + points de contrôle) |
| `GET` | `/plots/:id/yield-estimates` | `soil.read` | Estimations de rendement |
| `POST` | `/plots/:id/yield-estimates` | `soil.recommend` | Estimation **en fourchette** (jamais un chiffre garanti) |

Réponse de compatibilité (extrait) :

```json
{
  "level": "MEDIUM",
  "levelLabel": "moyennement favorable",
  "ruleSetVersion": "2026.1",
  "coverage": 1,
  "reasons": [
    { "key": "ph", "expected": "entre 5.5 et 7.5", "observed": 6.4, "source": "measured_lab", "met": true, "explanation": "valeur dans la plage favorable" },
    { "key": "organicMatter", "expected": "≥ 2", "observed": 1.2, "source": "declared", "met": false, "explanation": "sous le seuil minimal" }
  ],
  "explanation": { "summary": "Niveau moyennement favorable : 1 critère(s) satisfait(s) sur 2 évaluable(s)." },
  "disclaimer": "Évaluation indicative produite par règles agronomiques validées. Elle ne remplace pas un diagnostic de terrain ni une analyse de laboratoire."
}
```

Garanties : sans jeu de règles **validé**, l'appel renvoie **409** ; sans activation zone/culture, **403** ;
sous 60 % de couverture des critères, le niveau est `INSUFFICIENTLY_DOCUMENTED` (aucun chiffre inventé).

## Moteur géospatial & pédologique (SOIL-10 → SOIL-14, GEO-01 → GEO-03)

Le calcul scientifique est fait par le service Python `geoai/` (voir `docs/GEOSPATIAL.md`).
L'API Node expose les résultats et conserve chaque diagnostic avec la version du
moteur et la version de méthode.

| Méthode | Chemin | Permission | Rôle |
|---|---|---|---|
| POST | `/plots/:plotId/soil-diagnosis` | `geospatial.write` | Calcule un diagnostic complet (sol, sous-sol, satellite, capteurs, imagerie, fusion) et le conserve |
| GET | `/plots/:plotId/soil-diagnosis` | `geospatial.read` | Historique des diagnostics (id, versions, confiance, sources) |
| GET | `/plots/:plotId/soil-diagnosis/latest` | `geospatial.read` | Dernier diagnostic complet |
| GET | `/geospatial/soil-diagnostics/:id` | `geospatial.read` | Diagnostic par identifiant |
| GET | `/geospatial/health` | `geospatial.read` | Disponibilité du moteur, version de méthode |
| GET | `/geospatial/methods` | `geospatial.read` | Seuils et ordre de priorité des sources (`/v1/meta`) |
| POST | `/geospatial/texture` | `geospatial.read` | Texture USDA à partir de sable/limon/argile |
| POST | `/geospatial/spectral` | `geospatial.write` | Indices spectraux + statistiques zonales d'une scène |
| POST | `/geospatial/imagery` | `geospatial.write` | Photo de parcelle (`camera`) ou produit drone |
| POST | `/geospatial/sensors/quality` | `geospatial.write` | Aberrations, capteur bloqué, trous, dérive, mm d'eau |
| POST | `/geospatial/fusion` | `geospatial.write` | Fusion multi-sources avec conflits signalés |

Corps de `POST /plots/:plotId/soil-diagnosis` (tous les champs sont optionnels ;
les données déjà en base sont utilisées en priorité) :

```json
{
  "slopePct": 9,
  "rainfallMm": 1250,
  "sensorDepthCm": 30,
  "declared": { "ph": 6.1, "clay": 22 },
  "series": [{ "date": "2026-09-01", "ndvi": 0.62 }],
  "scenes": [{ "scene": { "id": "S2-…", "capturedAt": "…", "resolutionM": 10 },
               "bands": { "B2": [[…]], "B3": [[…]], "B4": [[…]], "B8": [[…]], "B11": [[…]] } }],
  "imagery": { "camera": { "base64": "…" }, "drone": { "chm": [[…]], "flight": { "gsdCm": 3 } } }
}
```

Réponse (extrait) :

```json
{
  "data": {
    "diagnosis": {
      "id": "01J…", "methodVersion": "soil-diagnostic-v1", "engineVersion": "1.0.0",
      "confidence": 0.78, "confidenceLevel": "élevée", "sourcesUsed": ["lab", "sensor"],
      "result": {
        "soil": { "texture": { "class": "limon" }, "ph": { "class": "légèrement acide" } },
        "subsoil": { "horizons": [{ "label": "A", "topCm": 0, "bottomCm": 40 }],
                     "depthToBedrock": { "valueCm": null, "confident": false } },
        "satellite": { "latest": { "indices": { "ndvi": { "mean": 0.6 } } } },
        "sensors": { "moisture": { "mean": 24.2, "waterStorageMm": 72.6 } },
        "fusion": { "parameters": { "clay": { "value": 22, "source": "lab", "alternatives": [] } }, "conflicts": [] },
        "confidence": { "score": 0.78, "level": "élevée", "missing": [] },
        "caveats": ["Aucun prélèvement de sol…"],
        "recommendations": [],
        "disclaimer": "Diagnostic indicatif… ne constitue pas une certification."
      }
    },
    "engine": { "available": true, "version": "1.0.0", "latencyMs": 12 }
  }
}
```

Codes : `422` si aucune donnée exploitable, `503` si le moteur est injoignable
(aucun diagnostic de substitution n'est produit), `404` hors tenant.

---

## Gouvernance des règles (SOIL-04) et activation (S2 §6.4)

| Méthode | Chemin | Permission |
|---|---|---|
| `GET` | `/admin/rulesets` | `rules.read` |
| `POST` | `/admin/rulesets` | `rules.write` |
| `POST` | `/admin/rulesets/:id/validate` | `rules.validate` |
| `POST` | `/admin/rulesets/:id/retire` | `rules.validate` |
| `GET` | `/admin/feature-flags` | `rules.read` |
| `PUT` | `/admin/feature-flags` | `flags.write` |

Un jeu de règles est créé en `draft` et ne devient opposable qu'après validation par un agronome
**distinct de son auteur** (séparation des rôles, **403** sinon).

## Canaux complémentaires (USSD-01 / WA-01)

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| `POST` | `/channels/ussd` | publique (passerelle) | Menu pas à pas (`1` prix, `2` météo, `3` annonces, `4` lot) — réponse ≤ 182 caractères |
| `GET` | `/channels/whatsapp/webhook` | jeton `hub.verify_token` | Vérification Meta |
| `POST` | `/channels/whatsapp/webhook` | signature `X-Hub-Signature-256` si `WHATSAPP_APP_SECRET` | Messages entrants, réponse courte, journalisation |
| `GET` | `/admin/channels/messages` | `channels.read` | Journal des messages (audit) |

Aucun document ni donnée personnelle d'un tiers n'est exposé par ces canaux.

## MFA TOTP — V4 NFR-01

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/auth/mfa/status` | État de l'enrôlement et codes de secours restants |
| `POST` | `/auth/mfa/setup` | Génère le secret (chiffré AES-256-GCM en base) et l'URI `otpauth://` |
| `POST` | `/auth/mfa/confirm` | Active la MFA, renvoie 8 codes de secours **une seule fois** (hachés en base) |
| `POST` | `/auth/mfa/verify` | Vérifie un code TOTP (fenêtre ±30 s) ou un code de secours à usage unique |
| `POST` | `/auth/mfa/disable` | Désactive après vérification d'un code valide |

`assertMfa()` est réutilisable par les services sensibles : **403** si non enrôlé, **401** si code faux.

## Offre groupée coopérative (COOP-10)

| Méthode | Chemin | Permission |
|---|---|---|
| `POST` | `/cooperatives/:id/group-offers/preview` | `cooperatives.write` |
| `GET` | `/cooperatives/:id/group-offers` | `cooperatives.read` |
| `POST` | `/cooperatives/:id/group-offers` | `cooperatives.write` |
| `POST` | `/cooperatives/:id/group-offers/:offerId/confirm` | `cooperatives.write` |
| `POST` | `/cooperatives/:id/group-offers/:offerId/cancel` | `cooperatives.write` |

Seules les productions des membres ayant consenti à la portée `productions` sont agrégées ; les unités
non convertibles en kg sont **écartées et listées** ; la répartition (`split`) est figée et auditée.
La confirmation crée une annonce en **brouillon** — jamais publiée d'office.

## Hub investisseur (INV-02, INV-03, PRJ-04)

| Méthode | Chemin | Permission |
|---|---|---|
| `GET` | `/investment/projects` | `investors.read` |
| `GET` | `/investment/followed` | `investors.read` |
| `POST` | `/investment/projects/:id/follow` | `investors.write` |
| `DELETE` | `/investment/projects/:id/follow` | `investors.write` |
| `GET` | `/investment/matches` | `investors.read` |
| `POST` | `/investment/projects/:id/contact` | `investors.write` |
| `POST` | `/investment/projects/:id/contacts/:requestId/decide` | `projects.write` |
| `GET` | `/investment/contact-requests` | `investors.read` |

Classement = **critères satisfaits → projet vérifié → fraîcheur** (CDC V2 §8.5), affiché tel quel.
Aucun score, aucun pourcentage, aucune recommandation : la réponse contient la liste des critères
`✔`/`✘`. La mise en relation exige l'acceptation du porteur ; le refus reste silencieux.

## Documents PDF (BIL-01, S4)

| Méthode | Chemin | Permission |
|---|---|---|
| `GET` | `/billing/:id/pdf` | `invoices.read` |
| `GET` | `/precision/precision-reports/:id/pdf` | `precision.read` |

PDF produits côté serveur (PDFKit, aucune dépendance externe). La facture rappelle qu'AGRIKONNECT
n'encaisse aucun fonds ; le rapport de précision porte sur **chaque page** la mention
« NE CONSTITUE PAS UNE CERTIFICATION ».

## Public — QR, page de lot, statistiques de sol (PUB-03, TRC-03, SOIL-16)

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/public/farms/:slug/qr.png` (ou `.svg`, `?size=`) | QR du profil : **URL publique uniquement** |
| `GET` | `/public/lots/:code` | Page publique de lot : champs publiés + événements publics seulement |
| `GET` | `/public/soil-stats?countryCode=&parameter=` | Moyennes de sol par pays avec **k-anonymat ≥ 10** |

## API publique normalisée (V5 §6)

| Méthode | Chemin | Portée |
|---|---|---|
| `GET` | `/public-api/v1/agriculture` | `aggregates:read` |
| `GET` | `/public-api/v1/regions` | `aggregates:read` |
| `GET` | `/public-api/v1/crops` | `data:read` |
| `GET` | `/public-api/v1/market-prices` | `prices:read` |
| `GET` | `/public-api/v1/projects` | `data:read` |
| `GET` | `/public-api/v1/farmers` | `data:read` |

Toutes appliquent le seuil de k-anonymat (`AGGREGATE_MIN_GROUP_SIZE`, défaut 10) **avant** de répondre :
en dessous du seuil, l'endpoint refuse explicitement (403) plutôt que d'arrondir ou de compléter.

## Synchronisation — pull (SYNC-02/03)

`GET /sync/pull?since=<ISO>&collections=plots,productions&limit=200`

```json
{
  "since": "2026-01-01T00:00:00.000Z",
  "cursor": "2026-02-01T00:00:00.000Z",
  "hasMore": false,
  "counts": { "plots": 1 },
  "changes": { "plots": [ { "id": "plot_a", "version": 2, "deleted": false, "data": { "…": "…" } } ] },
  "policy": { "softDelete": true, "tombstones": "Les suppressions logiques sont renvoyées avec `deleted: true`" }
}
```

Isolation tenant systématique : aucune ligne d'une autre organisation n'est renvoyée (A.3).
---

## Tâches planifiées (supervision)

| Méthode | Chemin | Permission | Rôle |
|---|---|---|---|
| `GET` | `/admin/jobs` | `admin.jobs` | Cadence, dernier passage, durée, résultat, erreur de chaque tâche |
| `POST` | `/admin/jobs/:name/run` | `admin.jobs` | Déclenchement manuel, **audité** (`job.run` avec l'acteur) |

```json
{
  "enabled": true,
  "scheduled": 7,
  "jobs": [
    {
      "name": "listings.expire",
      "description": "Passe en EXPIRED les annonces dont la date de disponibilité est dépassée",
      "intervalMs": 300000,
      "intervalHuman": "5 min",
      "lastRunAt": "2026-10-20T22:45:00.000Z",
      "lastDurationMs": 12,
      "lastOk": true,
      "lastResult": { "expired": 2 },
      "running": false
    }
  ]
}
```

Les tâches sont **idempotentes** : les relancer ne crée ni doublon ni incohérence. Un job inconnu est
rejeté par la validation (`422`) ; une tâche déjà en cours renvoie `{ "skipped": true }`.

