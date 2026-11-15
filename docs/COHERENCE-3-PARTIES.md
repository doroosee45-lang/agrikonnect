# AGRIKONNECT AFRICA — Cohérence technique des trois parties

**Date :** 23 octobre 2026
**Périmètre :** `backend/` · `apps/web/` · `apps/Mobile/`
**Méthode :** inspection du code réel (routes, services, modèles Prisma, couches API clientes),
comparaison avec le cahier des charges, corrections implémentées dans les fichiers, tests exécutés.

---

## 1. Architecture réelle des trois parties

### 1.1 Backend (`backend/`)

| Élément | Valeur vérifiée |
|---|---|
| Langage / module | JavaScript ESM, Node/Express |
| Auth | Supabase Auth + table `profiles` + rôles |
| ORM | Prisma — **96 modèles**, **11 migrations** |
| Routes HTTP | **358 routes** exposées (comptées par `scripts/check-frontend-contract.mjs`) |
| OpenAPI | 287 chemins · 354 opérations · 45 tags |
| Permissions | 131 permissions déclarées, 131 vérifiées |
| Moteur géospatial | `backend/geoai/` — Python stdlib, port 8100, 12 routes, sans accès base |
| Tests | `node --test tests/` (récursif, inclut `tests/e2e/`) |

Points d'architecture qui conditionnent les clients :

- **Multi-tenant** : `src/middleware/tenant.js` résout l'organisation via l'en-tête
  `x-organization-id` ; `assertOwnership` renvoie **404** (et non 403) pour ne pas révéler
  l'existence d'une ressource d'une autre organisation.
- **Enveloppe de réponse** : succès `{success, message?, data, meta?}`, erreur
  `{success:false, message, requestId, errors[], details?}`. Pagination en `meta`.
- **Modes de donnée** (`DataMode`) : `REAL` (physique) · `CONFIGURATION` (enregistré, hors
  service) · `SIMULATED` (généré, étiqueté, refusé à l'écriture en production). Un équipement
  simulé n'est jamais présenté comme connecté.
- **Garde-fou CDC** : un satellite ne mesure **jamais** le sous-sol. Les réponses satellite
  portent `measuresSubsurface: false` côté serveur.

### 1.2 Application Web (`apps/web/`)

| Élément | Valeur vérifiée |
|---|---|
| Pile | React + TypeScript + Vite + React Router + TanStack Query + framer-motion |
| Pages | **156 pages `.tsx`**, 157 routes dans `App.tsx`, toutes avec `element=` |
| Couche API | `src/services/endpoints.ts` — **38 clients** après corrections |
| Types | `src/services/types.ts` |
| Cache | `src/services/query.ts` (clés centralisées) |

Socles partagés : `PlotModule<T>` (modules de parcelle, **lecture seule — pas de mutation**),
`ResourcePage<T>` (listes), `DetailPage<T>` (fiches).

### 1.3 Application mobile (`apps/Mobile/`)

| Élément | Valeur vérifiée |
|---|---|
| Pile | Expo Router + TypeScript + TanStack Query + Reanimated |
| Écrans | **205 écrans `.tsx`** sous `src/app/` (comptés par `find`) |
| Couche API | `src/services/api/endpoints.ts` — **38 clients** après corrections |
| Types | `src/services/api/types.ts` |

Les deux clients ont désormais **le même jeu de clients API**, à une exception près assumée :
`syncApi`/`satelliteApi` et `exportApi` existent des deux côtés ; les différences résiduelles
sont listées en §7.

---

## 2. Correspondance fonctionnalités ↔ modules

| Fonctionnalité CDC | Module backend | Web | Mobile |
|---|---|---|---|
| Quoi semer sur une durée donnée | `recommendation/` | `farmer/Plots/Recommendations` | `farmer/plots/[id]/recommendations` |
| État réel du sol **et du sous-sol** | `recommendation/` (buildSoilState) | `farmer/Plots/Soil` | `farmer/plots/[id]/soil` |
| Satellite (surface uniquement) | `satellite/` | `farmer/Plots/Satellite` | `farmer/plots/[id]/satellite` |
| Alertes de seuil / capteur muet | `alerts/` | `farmer/Plots/Sensors` | `farmer/plots/[id]/sensors` |
| Anomalies de mesure (revue agronome) | `anomalies/` | `admin/Devices` | `admin/devices` |
| Dossiers d'export | `exports/` | `farmer/Export/{index,Detail,Documents}` | `farmer/export/{index,[id],[id]/documents}` |
| Interpolation / prévision | `geospatial/` | `farmer/Plots/PrecisionReport` | `farmer/plots/[id]/precision-report` |
| Synchronisation hors ligne | `sync/` | `farmer/SyncStatus` | `farmer/sync` |

---

## 3. Incohérences détectées et corrections appliquées

### 3.1 Le moteur de recommandation n'avait **aucune interface**

**Constat.** Les quatre routes du moteur —
`POST /plots/:plotId/recommendations`, `GET /plots/:plotId/recommendations`,
`GET /recommendations/:id/explanation`, `POST /recommendations/:id/decision` —
n'étaient appelées **ni par le web ni par le mobile**.

**Correction apportée à mon propre constat antérieur.** J'avais d'abord décrit les pages
`Recommendations` comme « affichant la compatibilité sous un titre trompeur ». C'était faux :
les deux pages s'intitulaient honnêtement « Compatibilité culturale » / « Compatibilité ».
Le défaut réel est autre et plus grave : **la question centrale du cahier des charges — quoi
semer sur une durée donnée — n'était accessible depuis aucune interface.**

**Correction implémentée.** Les deux écrans exposent désormais le moteur, **en conservant**
l'évaluation de compatibilité existante (les deux ne répondent pas à la même question :
l'une dépend d'une période, l'autre non) :

- saisie de la période, calcul, affichage du classement (score, couverture, sources,
  critères **non évalués**) ;
- `INSUFFICIENT_DATA` affiché comme tel avec la raison du serveur — rien n'est deviné ;
- `indicative` + `indicativeReasons` affichés quand les plages agronomiques sont provisoires ;
- `dataModeNotice` affiché dès que le mode n'est pas `REAL` ;
- décision **Accepter / Refuser** sur une recommandation `PENDING`.

### 3.2 Les écrans « Exportations » affichaient des **commandes**

**Constat.** Le backend possède un modèle `ExportOrder` distinct (référence, incoterm,
destination, taux de change, quatre documents obligatoires, chaîne de statuts propre) et
5 routes `/exports`. Les **six** écrans d'export — trois web, trois mobiles — appelaient
`orderApi` et `projectDataApi`. `exportApi` existait dans le mobile mais n'était utilisé que
par `international/documents.tsx`.

**Erreur que j'ai commise et corrigée en cours de route.** J'ai d'abord écrit le détail web
contre une forme plate `ExportOrder`. La compilation a révélé l'écart : `GET /exports/:id`
renvoie en réalité `{exportOrder, compliance, finance}` — c'était le **type mobile** qui était
juste. J'ai également découvert que le type mobile `ExportDocumentRow` inventait quatre champs
inexistants (`status`, `expiresAt`, `mediaId`, `createdAt`) alors que le modèle Prisma n'a que
`{id, exportOrderId, type, name, storageKey, issuedAt}`.

**Corrections implémentées.**
- Web : les trois pages réécrites sur `exportApi`, avec la conformité documentaire
  (`canBeCertified` calculé **côté serveur**, jamais redeviné) et la conversion de change
  (message du serveur repris tel quel quand aucun taux daté et sourcé n'existe).
- Mobile : les trois écrans réécrites sur `exportApi` ; le type `ExportDocumentRow` aligné sur
  le modèle Prisma ; `ExportOrderStatus` typé au lieu de `string`.
- Mobile : le bouton « Documents du dossier » était **mort** (`onPress={() => {}}`) — il navigue
  désormais réellement vers l'écran des documents.

### 3.3 L'écran « Satellite & diagnostic » du mobile ne montrait aucun satellite

**Constat.** Son titre promettait du satellite ; il n'appelait que `geoApi` (diagnostic). Le
client `satelliteApi` existait dans le web mais pas dans le mobile.

**Correction implémentée.** `satelliteApi` ajouté au mobile (types + client + clés de cache) et
une section « Séries satellite » insérée dans l'écran : observations, acquisition à la demande,
rappel `measuresSubsurface` repris du serveur, étiquetage visible des observations
`SIMULATED`. **Le diagnostic existant est intégralement conservé.** Un refus d'acquisition
(200 + `rejected`) est affiché comme un refus motivé, pas comme une erreur.

### 3.4 Les alertes de seuil n'avaient **aucune interface**

**Constat.** `GET /alerts`, `GET /alerts/:id`, `POST /alerts/:id/read`,
`POST /alerts/:id/handled` n'étaient appelées par aucun client. La seule occurrence de
« alerts » côté client était `/weather/plots/:plotId/alerts`, qui est un autre objet.

**Correction implémentée.** `alertApi` ajouté aux deux clients et panneau « Alertes de seuil »
inséré dans le module **Capteurs** de chaque client (les alertes `SENSOR_SILENCE` concernent les
capteurs ; ce placement évite d'ajouter des pages hors de l'arborescence validée). Le panneau
distingue explicitement les trois sources :

- `MEASUREMENT` — franchissement constaté ;
- `FORECAST` — franchissement anticipé, avec la date prévue ;
- `SENSOR_SILENCE` — **absence** de donnée, jamais une mauvaise mesure.

Actions « Marquer lue » et « Traiter » câblées ; compteur `openCount` repris du serveur.

### 3.5 Les anomalies de mesure n'avaient **aucune interface**

**Constat.** Les 6 routes `/anomalies` n'étaient appelées par aucun client : la revue par
agronome — pourtant exigée par le cahier des charges — était impossible.

**Correction implémentée.** `anomalyApi` ajouté aux deux clients et panneau de revue inséré dans
`admin/Devices` (web) et `admin/devices` (mobile) : liste, seuils de détection **explicitement
marqués provisoires**, confirmation / rejet. L'interface énonce la règle métier : `CONFIRMED`
écarte la mesure du calcul, `DISMISSED` la réhabilite immédiatement, une anomalie revue n'est
jamais rouverte. Le mode `SIMULATED` est affiché quand il s'applique.

### 3.6 Défauts de compilation et de typage corrigés au passage

| Défaut | Fichier | Correction |
|---|---|---|
| `COLORS.border` inexistant (la clé est `lightBorder`) | `farmer/Projects/Create.tsx` | clé corrigée |
| `preset="label"` inexistant côté mobile | `farmer/plots/[id]/satellite.tsx` | `bodySm` |
| `ProvenanceTag kind="REMOTE_SENSING"` (le mobile utilise des kinds en minuscules) | idem | `satellite` |
| `ExportOrder` supprimé par un patch de type mal borné | `apps/web/src/services/types.ts` | interface restaurée |
| Accolade orpheline après un patch de type | `apps/Mobile/src/services/api/types.ts` | supprimée |
| Mutation `detectAll` appelant `detectDevice('')` | `apps/web/src/pages/admin/Devices.tsx` | supprimée |
| Clé de cache `anomalies.all` manquante | `query.ts` (web **et** mobile) | ajoutée |

> Les trois derniers défauts ont été **introduits par mes propres modifications** puis détectés
> par `tsc`. Ils sont listés ici parce qu'un rapport qui ne mentionne que les défauts hérités
> donnerait une image fausse du travail.

---

## 4. Routes API et échanges de données (formes vérifiées dans le code source)

Toutes les formes ci-dessous ont été lues dans les services backend, pas déduites.

| Route | Forme de réponse |
|---|---|
| `GET /alerts` | `{items, page, limit, total, totalPages, openCount}` |
| `GET /exports` | `{items, total, page, limit}` — chaque ligne porte `_count.documents` |
| `GET /exports/:id` | `{exportOrder, compliance:{required[], missing[], canBeCertified}, finance:{totalAmount, currency, fxRate, conversion:{amount, error?}}}` |
| `POST /exports` / `PATCH /exports/:id/status` | `ExportOrder` nu (pas l'enveloppe de conformité) |
| `POST /exports/:id/documents` | `ExportDocument` nu |
| `GET /plots/:id/recommendations` | `{items, count}` |
| `POST /plots/:id/recommendations` | `{recommendation, indicative, indicativeReasons, dataMode, dataModeNotice?, counts, satellite?}` |
| `GET /satellite/plots/:id/observations` | `{plotId, items[], count, settings, measuresSubsurface:false}` |
| `POST /satellite/plots/:id/acquire` | **201** scène acquise · **200** refus (`rejected:true` + `reason`) |
| `GET /anomalies` | `SensorAnomaly[]` |
| `POST /anomalies/:id/review` | `{anomaly, readingExcluded}` |

**Énumérations alignées sur `prisma/schema.prisma`** (et non sur des hypothèses) :

- `RecommendationStatus` = `ACTIVE | SUPERSEDED | REJECTED | COMPLETED | INSUFFICIENT_DATA | PENDING`
- `AlertStatus` = `NEW | READ | HANDLED` · `AlertSeverity` = `INFO | WARNING | CRITICAL`
- `AlertSourceType` = `MEASUREMENT | FORECAST | SENSOR_SILENCE`
- `AnomalyStatus` = `NEW | CONFIRMED | DISMISSED`
- `AnomalyReason` = `OUT_OF_RANGE | IMPOSSIBLE_JUMP | FROZEN_VALUE | STATISTICAL_OUTLIER | SILENT`
- `ExportOrderStatus` = `DRAFT | CONFIRMED | IN_CONTROL | CERTIFIED | IN_TRANSIT | DELIVERED | CLOSED | CANCELLED`

---

## 5. Fichiers modifiés

### Web (`apps/web/`)

| Fichier | Nature de la modification |
|---|---|
| `src/services/types.ts` | types recommandation, alertes, anomalies, export (formes réelles) |
| `src/services/endpoints.ts` | clients `recommendationApi`, `alertApi`, `anomalyApi`, `exportApi` |
| `src/services/query.ts` | clés `recommendations`, `alerts`, `anomalies`, `exports` |
| `src/pages/farmer/Export/index.tsx` | réécrit sur `exportApi` |
| `src/pages/farmer/Export/Detail.tsx` | réécrit sur `{exportOrder, compliance, finance}` |
| `src/pages/farmer/Export/Documents.tsx` | réécrit sur `exportOrder.documents` |
| `src/pages/farmer/Plots/Recommendations.tsx` | moteur de recommandation + compatibilité conservée |
| `src/pages/farmer/Plots/Sensors.tsx` | panneau alertes de seuil |
| `src/pages/admin/Devices.tsx` | panneau revue d'anomalies |
| `src/pages/farmer/Projects/Create.tsx` | `COLORS.border` → `COLORS.lightBorder` |

### Mobile (`apps/Mobile/`)

| Fichier | Nature de la modification |
|---|---|
| `src/services/api/types.ts` | satellite, recommandation, alertes, anomalies ; `ExportDocumentRow`/`ExportOrderRow` alignés sur Prisma |
| `src/services/api/endpoints.ts` | clients `satelliteApi`, `recommendationApi`, `alertApi`, `anomalyApi` |
| `src/services/query.ts` | clés `satellite`, `recommendations`, `alerts`, `anomalies` |
| `src/app/farmer/plots/[id]/satellite.tsx` | section satellite réelle (diagnostic conservé) |
| `src/app/farmer/plots/[id]/recommendations.tsx` | moteur de recommandation (compatibilité conservée) |
| `src/app/farmer/plots/[id]/sensors.tsx` | panneau alertes de seuil |
| `src/app/farmer/export/index.tsx` | réécrit sur `exportApi` |
| `src/app/farmer/export/[id].tsx` | réécrit sur `exportApi` ; bouton mort réparé |
| `src/app/farmer/export/[id]/documents.tsx` | réécrit sur `exportOrder.documents` + conformité |
| `src/app/admin/devices.tsx` | panneau revue d'anomalies |

**Aucun fichier backend n'a été modifié** dans cette passe : les défauts étaient du côté des
clients.

---

## 6. Tests exécutés et résultats

Tous les résultats ci-dessous proviennent d'exécutions réelles, non de déductions.

| Vérification | Commande | Résultat |
|---|---|---|
| Backend — suite complète | `npm run verify` | **EXIT 0** |
| Backend — tests unitaires | `node --test tests/` | **614 pass / 0 fail** |
| Backend — tests e2e (PostgreSQL embarqué) | idem | **88 pass / 0 fail** |
| Backend — migrations | `check:migrations` | 11 migrations ✓ |
| Backend — smoke HTTP | `smoke-http.mjs` | ✓ |
| Contrat backend ⇄ clients | `check-frontend-contract.mjs` | **EXIT 0** |
| Web — typage | `npx tsc --noEmit` | **EXIT 0** |
| Web — build | `npx vite build` | **EXIT 0** — 318,08 kB / 98,41 kB gzip |
| Mobile — typage | `npx tsc --noEmit` | **EXIT 0** |

**Progression mesurée par le script de contrat :**

| Indicateur | Avant | Après |
|---|---|---|
| Appels clients distincts | 240 | **255** |
| Routes backend sans appel client | 118 | **103** |
| Appels client sans route correspondante | 0 | **0** |

Les 12 routes précédemment mortes sont désormais référencées **dans les deux clients**
(vérifié par recherche littérale dans les couches API).

**Ce que ces tests ne couvrent pas.** `tsc` et `vite build` valident le typage et la
compilation, pas le rendu à l'écran. Aucun test de bout en bout navigateur
(Playwright/Cypress) n'existe dans ce dépôt : les parcours UI → base → UI décrits au cahier des
charges sont couverts côté **backend** par les 88 tests e2e (harnais PostgreSQL embarqué,
requêtes HTTP réelles), mais pas depuis une interface réellement pilotée. C'est un manque
réel, signalé en §7.

---

## 7. Ce qui reste manquant ou à vérifier

### 7.1 Routes backend encore sans appel client (96)

> **Évolution.** Le compteur est passé de 103 à 96 : la famille
> `agronomic-ranges` est désormais couverte par un écran web
> (`pages/admin/AgronomicRanges.tsx`) et un écran mobile
> (`app/admin/agronomic-ranges.tsx`), y compris l'import CSV.

Familles concernées, par ordre d'importance fonctionnelle :

| Famille | Routes | Commentaire |
|---|---|---|
| `billing` | 5 | Facturation. |
| `channels` | 3 | Canaux de notification. |
| `due-diligence` | 2 | Diligence investisseur. |
| `geodata/*satellite` | 2 | Doublon fonctionnel de `/satellite/*`, déjà couvert. |
| `admin/export/farms` | 1 | Export administrateur. |
| divers | le reste | Routes internes, variantes par rôle, ou opérations déjà accessibles sous un autre préfixe. |

> **Mise en garde méthodologique.** Un regroupement par premier segment de chemin
> **sur-évalue** les manques : `alerts`, `lots`, `dataroom` et `recommendations` apparaissaient
> comme non couverts alors que les clients y accèdent via `/weather/plots/:id/alerts` ou
> `/plots/:id/recommendations`. Chaque manque supposé doit être confirmé par une recherche
> littérale du chemin avant d'être affirmé.

### 7.1bis Écart assumé — règle de combinaison

La règle par défaut est passée de la **moyenne des critères** au **facteur le
plus limitant** (moteur v2.0). Ce n'est pas un détail : sur un même état mesuré,
deux cultures classées dans un ordre sous la v1.0 peuvent s'inverser sous la
v2.0. Le versionnage rend ce changement explicite plutôt que silencieux — chaque
recommandation porte `ruleSetVersion`, figé à l'écriture, et la v1.0 reste
disponible. **Aucune des deux règles n'a été validée par un agronome sur des
données réelles** : c'est un choix d'ingénierie documenté, pas une conclusion
mesurée.

### 7.1ter Écart assumé — SMS Twilio (étape E)

**Aucun SMS réel n'a été livré.** Tous les tests passent par un faux serveur
HTTP. Le routage vers Vodacom/Airtel/Orange, la préservation effective de
l'identifiant d'expéditeur, la remise sur terminaux réels et le coût réel par
segment **ne sont pas vérifiés**. La route `POST /sms/test-send` existe pour
cette recette.

**Contradiction non tranchée** : la page Twilio pour la RDC indique la
pré-inscription de l'identifiant alphanumérique comme non applicable (disponible
dynamiquement) ; une source tierce rapporte une pré-inscription exigée par
Vodacom. Signalée dans `docs/SMS-TWILIO.md` §1 et renvoyée par
`GET /sms/settings` (`preRegistrationNotice`), pas résolue.

**Non implémenté, volontairement** : la fenêtre horaire d'envoi recommandée par
Twilio ; la réécriture des gabarits d'alerte pour éviter les caractères qui
forcent l'UCS-2 ; les écrans de consentement et de suivi ; le câblage du job
d'alertes sur `sendAlertBatch()`.

**Un test préexistant fragile a été corrigé au passage.** Le test satellite
« une scène SIMULATED ne déclenche aucune alerte » échouait de façon
**aléatoire** : le fournisseur simulé produit `12 + fraction × 30` à partir du
hachage d'un identifiant de parcelle **généré à l'exécution**, et un seuil écrit
en dur à 40 % était franchi à l'envers dans environ 7 % des exécutions. Le seuil
est désormais dérivé de la valeur observée ; le test prouve exactement la même
chose. Vérifié sur 4 exécutions consécutives.

### 7.2 Lacunes backend déjà documentées (non corrigées ici)

- **Aucun fournisseur satellite réel** n'est câblé : les acquisitions sont simulées et
  étiquetées comme telles.
- **Aucune capacité d'upload de fichier** : `GeospatialImport` n'est pas câblé, ce qui bloque
  l'import de couches vectorielles réelles.
- **`SeasonFeedback` non câblé** : le retour de saison, prévu pour recalibrer le moteur, n'a ni
  écriture ni lecture.
- **`IotDevice` n'a pas de colonne type de capteur.**
- **`createRange` ignore `AGRONOMIC_DATASET`.**
- **Aucun lien entre une `SensorAnomaly` et une `ThresholdAlert`.**
- Les raisons `OUT_OF_RANGE`, `IMPOSSIBLE_JUMP` et `SILENT` ne sont **pas produites** par le
  détecteur : seule `STATISTICAL_OUTLIER` et `FROZEN_VALUE` le sont.
- Les taux de détection d'anomalies publiés (100 % de détection, 2,5 % de fausses alertes) sont
  mesurés sur **40 séries synthétiques** à générateur déterministe. Ils ne remplacent pas une
  mesure sur données réelles.

### 7.3 À vérifier

- **Écrans du score d'adéquation (étape D)** : l'étiquette « adéquation », la
  version du moteur et la règle de combinaison affichées dans
  `pages/farmer/Plots/Recommendations.tsx` et
  `app/farmer/plots/[id]/recommendations.tsx` sont vérifiées **par compilation
  seule**. Aucun navigateur ni simulateur ne les a pilotées.
- **Écrans des plages agronomiques (étape B)** : l'affichage des quatre limites
  (toléré min, idéal min, idéal max, toléré max), du type de source et de la
  zone, ainsi que les champs de saisie ajoutés, sont vérifiés **par compilation
  seule** (`tsc --noEmit`, 0 erreur sur web et mobile). Aucun navigateur ni
  simulateur ne les a pilotés.
- **Parcours de bout en bout depuis une interface réellement pilotée** (voir §6).
- **Rendu mobile sur tailles d'écran variées et réseau instable** : les états de chargement,
  d'erreur et de vide sont présents dans le code, mais leur comportement en conditions
  dégradées n'a pas été observé sur appareil.
- **Envoi SMS réel** : le canal est derrière une interface et le mode simulé est réservé aux
  tests, mais aucun fournisseur n'est branché.

---

## 8. Reproductibilité

```bash
# Backend (les dépendances ne persistent pas entre les sessions)
cd backend
npm install --legacy-peer-deps --no-audit --no-fund
./node_modules/.bin/prisma generate
npm run verify                          # EXIT 0 attendu
node scripts/check-frontend-contract.mjs

# Web
cd apps/web && npm install --legacy-peer-deps
npx tsc --noEmit && npx vite build

# Mobile
cd apps/Mobile && npm install --legacy-peer-deps
npx tsc --noEmit
```

Journal complet de la suite backend : `/home/user/verify-coherence.log`.
