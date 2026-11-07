# Matrice de recette — V2 → V5

Traçabilité entre les critères d'acceptation du cahier des charges et leur implémentation.
Chaque ligne indique **où** la règle est appliquée et **comment** elle est observée côté API.

> Document de lecture métier. La matrice **exhaustive et vérifiée automatiquement** est
> `docs/REQUIREMENTS.md` (213 identifiants, `npm run check:req`) : chaque exigence y est reliée à
> son fichier d'implémentation **et** à son fichier de test, et le script échoue si un identifiant
> cité dans le dépôt n'y figure pas. Les étiquettes `LOT-xx`, `REP-xx`, `PRE-xx`, `TEN-xx`,
> `MFA-xx`, `COOPG-xx`, `INVH-xx`, `API-05→07` y sont documentées comme **alias / sous-cas** de
> l'exigence canonique correspondante.

> Convention : « refus serveur » = la règle est appliquée dans le service, pas seulement dans l'interface.

---

## V2 — MARKET

| Réf. | Critère d'acceptation | Implémentation | Preuve observable |
|---|---|---|---|
| MKT-01 | Une annonce n'est visible qu'après publication | `market/listings/listings.service.js` — `search()` filtre `status: PUBLISHED` | `GET /listings` ne renvoie jamais un `DRAFT` ; `GET /listings/:id` → 404 pour un tiers |
| MKT-02 | Le vendeur ne peut pas vendre plus que son stock annoncé | `market/orders/orders.service.js` — contrôle `quantity <= listing.quantity` | `POST /orders` → 422 au-delà du disponible |
| MKT-03 | Recherche exploitable (culture, prix, zone, certification) | `searchListingsSchema` + `search()` | `GET /listings?cropId=…&certification=Bio&maxPrice=…` |
| MKT-04 | Cycle de vie contrôlé, expiration automatique | table `allowed` dans `changeStatus()`, `expireStale()` | `PATCH /listings/:id/status` → 409 sur transition interdite |
| MKT-01 | Publier sans photo est possible mais signalé | `changeStatus()` → `warnings[]` (non bloquant) | Réponse `{ listing, warnings: [{ field: 'photos', code: 'recommended' }] }` |
| MKT-02 | Les photos d'une annonce appartiennent au vendeur | `attachPhotos()` — `organizationId` vérifié, plafond `MAX_PHOTOS` | `POST /listings/:id/photos` → 422 si média d'une autre organisation |
| MKT-06 | Contacter un vendeur sans exposer ses coordonnées | `contactSeller()` → conversation `subjectType: LISTING` | `POST /listings/:id/contact` renvoie un fil, jamais un téléphone/e-mail |
| MKT-05 | Modération motivée et tracée | `moderate()` + `audit({action:'listing.moderate'})` | `PATCH /listings/:id/moderate` exige `reason` (≥ 5 caractères) |
| MKT-06 | Le matching est **explicable**, jamais un score opaque | `shared/matching.js` — liste de critères + tri documenté | `matches[]` expose `criteria[]`, `rank`, `explainingOrder` |
| REQ-01 | Une demande d'achat ne divulgue pas les coordonnées | `requests.service.js` — projection `seller` limitée | Réponse : `seller { name, type, countryCode }`, aucune lat/lng |
| REQ-03 | Les producteurs compatibles sont notifiés, sans spam | `notifyCompatibleSellers()` — plafond 20, `dedupeKey` | `notificationsSent` dans la réponse ; une notification par couple demande/utilisateur |
| REQ-04 | Une offre est chiffrée, datée, opposable | `Offer.validUntil` + statuts `PENDING/ACCEPTED/REJECTED/WITHDRAWN` | `PATCH /market/offers/:id` |
| ORD-01 | La création de commande est idempotente | `middleware/idempotency.js` sur `POST /orders` | Rejeu → même réponse + en-tête `Idempotent-Replayed: true` |
| ORD-02 | Les conditions sont figées (snapshot) | `Order.snapshot` créé à partir de l'annonce/offre | `GET /orders/:id` → `snapshot.frozenAt`, `snapshot.items[]` |
| ORD-03 | Machine à états stricte, contrôlée par rôle et par état | table `TRANSITIONS` + `partyOf()` | `PATCH /orders/:id/status` → 409/403 + `allowedTransitions` |
| ORD-04 | Aucun paiement opéré par la plateforme | `declarePayment()` + `paymentNotice` dans le snapshot | `paymentStatus` déclaratif, `disclaimer` renvoyé |
| ORD-05 | Litige ouvert et arbitré, avec preuve | `openDispute()`, `resolveDispute()`, `order_events` | `POST /orders/:id/disputes`, `PATCH /orders/admin/disputes/:id` |
| ORD-03 | Journal de commande append-only | `OrderEvent` écrit à chaque transition (création incluse) | `GET /orders/:id/events` → `from`, `to`, `role`, `reason`, `at` |
| ORD-03 | L'annulation restitue le stock réservé | `transition()` — restitution `RESERVATION` inverse + `PUBLISHED` | `CANCELLED` après `ACCEPTED` → quantité d'annonce restaurée |
| ORD-05 | File de litiges exploitable par la modération | `listDisputes()` — âge et SLA calculés | `GET /orders/admin/disputes` (lecture seule, sans coordonnées) |
| STK-01 | Le stock n'est jamais un solde modifiable | `market/inventory/inventory.service.js` — `computeBalance()` | `balanceSource: "derived_from_movements"` |
| STK-02 | Pas de stock négatif | contrôle dans `addMovement()` | `POST /inventory/movements` → 409 avec solde et mouvement demandés |
| NFR-04 | Pas de survente en cas de concurrence | `updateMany({ where: { quantity: { gte: qty } } })` | Deux commandes simultanées : une seule passe, l'autre reçoit 409 |
| TRA-01 | Transport lié à une commande, distance approximative | `transport.service.js` — `distanceKm`, libellés seuls | `GET /transport/requests` n'expose pas les adresses exactes |
| TRA-03 | Pas de livraison sans preuve | contrôle `!request.proof` avant `DELIVERED` | `PATCH /transport/requests/:id/status {status:'DELIVERED'}` → 409 sans POD |
| MSG-01 | Pas de messagerie libre | `subjectType` + `subjectId` obligatoires, participants = parties | `POST /messaging/conversations` → 403 si participant hors dossier |
| MSG-01 | Un fil unique par dossier | `ensureBusinessConversation()` (`hasEvery` + relecture) | Second appel → `replayed: true`, même `id` |
| MSG-02 | Un tiers n'apprend pas l'existence d'un fil | contrôle participant en tête de chaque lecture | `GET /messaging/conversations/:id/messages` → 404 (jamais 403) |
| MSG-02 | Accusés de lecture et compteur fiables | `readBy[]` + `groupBy` sur les non-lus | `unread` à 2 puis 0 après lecture ; `message:read` diffusé |
| MSG-02 | Pièces jointes contrôlées | `assertAttachments()` — URL http(s) ou clé interne | `attachments: ['javascript:alert(1)']` → 422 |
| MSG-04 | Notification temps réel sans polling | `emitToConversation` / `emitToUser` (rooms Socket.IO) | `message:new`, `notification:new` reçus par les seuls participants |
| MSG-03 | Signalement conservé pour la modération | `reportMessage()` + audit, message non supprimé | Réponse : `retention: "Message conservé…"` |
| NOTIF-03 | Préférences par type × canal | `notification_preferences` + `shared/events.js` | `PUT /notifications/preferences` puis absence d'envoi sur canal désactivé |
| BIL-01 | Numérotation séquentielle par organisation | `nextSequence()` dans une transaction | `FAC-2026-00001`, `00002`… sans trou |
| BIL-02 | Pas de conversion sans taux daté et sourcé | `shared/money.js` — `convert()` | `POST /billing` sans `fxRate.source` → 422 |
| Avis | Avis uniquement après livraison, un par partie | `reviews.service.js` | `POST /reviews/orders/:id/reviews` → 409 si statut antérieur |
| Avis | Réputation = moyenne **+ volume** | `reputation()` | `{ average, count, distribution }`, `null` si aucun avis |
| Avis | Modération sans destruction de preuve | `moderate()` — statut `HIDDEN` / `PUBLISHED` | `POST /reviews/reviews/:id/moderate` → `retention: "Avis conservé…"` |
| NFR-07 | Le temps réel ne modifie jamais les données | Socket.IO en lecture seule (`socket.data`), écritures REST | `attachRealtime()` n'expose aucune écriture métier |

---

## V3 — INTELLIGENCE

| Réf. | Critère d'acceptation | Implémentation | Preuve observable |
|---|---|---|---|
| SYNC-01 | Travail hors-ligne rejouable | `sync/sync.service.js` — collections + `opId` | `GET /sync/collections` documente le contrat |
| SYNC-02 | Idempotence par opération | `sync_operations.opId` unique | Rejeu → `result: "DUPLICATE"` |
| SYNC-03 | Conflits détectés, pas écrasés | verrou optimiste `baseVersion` vs `version` | `result: "CONFLICT"` + `conflict.resolution` |
| SYNC-04 | Rapport de conflits consultable | `conflictReport()` | `GET /sync/conflicts?onlyConflicts=true` |
| AI-01 | Consentement avant analyse d'image | contrôle `consentGiven` en tête de `analyze()` | `POST /ai/analyses` type `PLANT_PHOTO` sans consentement → 422 |
| AI-02 | Toute sortie porte un avertissement | `DISCLAIMER` écrit sur l'analyse et renvoyé | `analysis.disclaimer` non nul |
| AI-03 | La confiance est affichée, jamais implicite | `confidence` + libellé français | `confidence: { level: 'low', label: 'faible' }` |
| AI-04 | Version de prompt et de modèle traçables | `promptVersion`, `model`, `provider` persistés | `GET /ai/analyses/:id` → `provenance` |
| AI-05 | Escalade humaine possible | `escalate()` → statut `ESCALATED` | `POST /ai/analyses/:id/escalate` |
| AI-06 | Quotas anti-abus | `shared/quota.js` (50/j/utilisateur, 500/j/organisation) | 429 avec message explicite |
| WEA-01 | Aucune météo inventée | `forPlot()` → `available: false` si vide | Réponse explicite, `records: []` |
| WEA-02 | Donnée datée et sourcée | `WeatherData.source`, `observedAt`, `confidence` | `freshness.stale` au-delà de 24 h |
| WEA-03 | Alertes explicables | règles citées (`rule: "rainfallMm >= 50"`) | `GET /weather/plots/:id/alerts` |
| PRI-01 | Chaque prix est daté et sourcé | `MarketPrice.observedAt/source/sourceLabel` | `GET /prices` → `provenance.sources[]` |
| PRI-02 | Série exploitable, méthode affichée | `series()` — période, effectif, `method.reliable` | `GET /prices/series` |
| PRI-03 | Marchés sans relevé signalés | `staleMarkets()` | `GET /prices/stale-markets` |
| LOT-01 | Journal de lot append-only | aucun endpoint de mise à jour/suppression d'événement | `POST /lots/:id/events` seulement |
| LOT-02 | Lot rappelable, statut terminal | `recall()` + événement `OTHER` | `POST /lots/:id/recall` |
| LOT-03 | Vue publique limitée aux champs publiés | `publicView()` — projection stricte | `GET /public/lots/:code` → `published`, `disclosure.hiddenFields` |
| LOT-04 | Champs sensibles non publiables | liste `forbidden` dans `updatePublicFields()` | `PUT /lots/:id/public-fields` → 422 sur `plotId`, `price`… |
| CERT-01 | Déclaré ≠ vérifié | toute création en `PENDING` | `POST /certifications` → `status: "PENDING"` |
| CERT-02 | Vérification réservée à l'administration | `authorize('certifications.verify')` | 403 pour un producteur |
| CERT-03 | Expiration prise en compte partout | `decorate()` → `effectiveStatus`, `expiringSoon` | Une certification périmée n'apparaît jamais `VERIFIED` |
| IOT-01 | Clé d'appareil hachée, non relisible | `sha256(rawKey)`, clé renvoyée une fois | `deviceKey` uniquement à l'enregistrement |
| IOT-02 | Clé révocable / rotative | `revoke()`, `rotateKey()` | `POST /iot/devices/:id/revoke` |
| IOT-03 | Seuils → alertes, aucune action automatique | `evaluateThresholds()` + `automaticAction: "none"` | Notification `iot.threshold` |
| IOT-04 | Mesures non interpolées | `detectGaps()` | `gaps[]` dans `GET /iot/devices/:id/readings` |
| GEO-01 | Satellite / drone / lab rattachés à la parcelle | `geodata.service.js` — `assertPlot()` sur chaque route | 404 hors tenant |
| GEO-02 | Provenance distincte par source | `plotObservations()` — sections séparées | `provenancePolicy` renvoyée |
| GEO-03 | Écriture labo réservée au partenaire | contrôle `LAB_PARTNER` ou admin | 403 sinon |

---

## V4 — INVEST

| Réf. | Critère d'acceptation | Implémentation | Preuve observable |
|---|---|---|---|
| PRJ-01 | Un projet n'est public qu'après revue | `submit()` puis `review()` | `GET /projects` ne liste que `PUBLISHED` |
| PRJ-02 | Provenance champ par champ | `fieldStatus` + `provenanceSummary()` | `GET /projects/:id` → `provenance.fields[]` |
| PRJ-03 | Pas d'auto-vérification | `platform_verified` interdit au producteur | `PATCH /projects/:id` → 403 |
| PRJ-04 | Aucune promesse de rendement | `FORBIDDEN_CLAIMS` + `assertNoGuarantee()` | 422 sur « rendement garanti » |
| PRJ-05 | Revue administrative motivée | `review()` + notification au porteur | `PATCH /projects/:id/review` |
| DR-01 | Data room fermée par défaut | `activeGrant()` exigé avant toute lecture | `GET /dataroom/projects/:id/documents` → 403 sans accord |
| DR-02 | Demande d'accès explicite et justifiée | `requestAccess()` — justification ≥ 10 caractères, portée, durée | `POST …/access-requests` |
| DR-03 | Décision du propriétaire, avec expiration | `decideAccess()` — expiration ≤ 90 j | `expiresAt` renvoyé ; accès expiré → `EXPIRED` |
| DR-04 | Téléchargement désactivé par défaut | `downloadAllowed: false` par défaut, double contrôle | `GET /dataroom/documents/:id?download=true` → 403 |
| DR-05 | Journal d'accès append-only | `dataRoomAccessLogs` — insertions seules | `GET …/access-log` → `appendOnly: true` |
| DD-01 | Checklist structurée | `ensureChecklist()` — 5 catégories | `POST …/due-diligence/checklist` |
| DD-02 | Vérification professionnelle nominative | `professionalName` + `professionalCapacity` requis | `PATCH /due-diligence/:id {status:'VERIFIED'}` → 422 sans eux |
| DD-03 | La due diligence n'est pas publique | accès limité propriétaire/professionnel | 404 pour un tiers |
| REP-01 | Rapports horodatés par le serveur | `publishedAt` serveur | Impossible d'antidater |
| REP-02 | Impact avec `source` par indicateur | `createImpact()` — `source` par défaut `declared` | `provenance.caveat` liste les indicateurs non vérifiés |
| REP-03 | Pas de réécriture d'un rapport publié | création d'un nouveau rapport uniquement | aucun endpoint `PATCH` |
| FUND-01 | Consentement préalable matérialisé | `requestConsent()` → `consentId` + aperçu du contenu | `POST …/funding-requests/consent` |
| FUND-02 | Transmission impossible sans consentement | contrôle dur `consentId` + `consentGiven` | 403 sinon |
| FUND-03 | Aucune activité financière régulée | `DISCLAIMER` renvoyé sur chaque réponse | Pas de collecte, pas de rendement |
| INV-01 | Profil investisseur vérifié | `verify()` (admin) | `access.verified` |
| INV-02 | MFA obligatoire pour les données sensibles | `assertInvestorReady()` | 403 si `mfaEnabled: false` |
| INV-03 | Accès data room conditionné | `dataRoomAccess = verified && mfa` | Bloc `access` renvoyé |
| PRE-01 | Zones versionnées et sourcées | `ManagementZone.methodVersion`, `sources` | `GET /precision/plots/:id/management-zones` → `versions[]` |
| PRE-02 | Aucune zone sans données | refus si `sources.length === 0` | 422 explicite |
| PRE-03 | Rapport non validé par défaut | `validatedBy`/`validatedAt` nuls à la création | `status: "PROPOSITION_NON_VALIDEE"` puis `validateReport()` |

---

## V5 — GLOBAL

| Réf. | Critère d'acceptation | Implémentation | Preuve observable |
|---|---|---|---|
| TEN-01 | Appel d'offres public et daté | `Tender` + `deadline` | `GET /tenders` (ouvert par défaut) |
| TEN-02 | Réponses scellées | `getOne()` — projection selon le rôle | Un concurrent ne voit que sa propre réponse |
| TEN-03 | Réponse unique, refusée après date limite | contrôles dans `respond()` | 409 sur doublon ou deadline dépassée |
| EXP-01 | Incoterm contrôlé | liste `INCOTERMS` | 422 sur valeur inconnue |
| EXP-02 | Taux de change daté et sourcé | `validFxRate()` hors USD | 422 sinon |
| EXP-03 | Certification impossible sans documents | contrôle `REQUIRED_DOCUMENTS` | `PATCH /exports/:id/status {status:'CERTIFIED'}` → 409 avec la liste manquante |
| API-01 | Clé hachée, affichée une fois | `sha256(raw)` + préfixe indexé | `apiKey` renvoyé uniquement à l'émission |
| API-02 | Clé révocable, expirable | `DELETE /api-clients/keys/:id` | `status: "REVOKED"`, refus immédiat |
| API-03 | Finalité approuvée avant usage | `purposeApprovedAt` exigé dans `apiKeyAuth` | 403 « Contrat de finalité non approuvé » |
| API-04 | Quota + journal d'usage | `apiUsage`, `API_DAILY_QUOTA` | `GET /api-clients/clients/:id/usage` |
| DATA-01 | Produits de données publiables seulement avec agrégats conformes | `publishProduct()` | 409 sinon |
| DATA-02 | k-anonymat strict | `computeAggregate()` — groupe non calculé si `< minGroupSize` | `suppressed[]` sans valeur |
| DATA-03 | Composition et version de règle | `Aggregate.composition`, `ruleVersion` | `GET /public-api/v1/products/:id/aggregates` |
| DATA-04 | Contrat de données obligatoire | `assertContract()` dans `publicapi.service.js` | 403 sans contrat actif |
| DATA | Non-ré-identification | ni min, ni max, ni liste d'organisations | `disclosure.noReidentification` |
| GLB-03 | Aucune conversion sans taux daté et sourcé | `countries/fx.service.js` — table `fx_rates`, `stale` à 48 h | `GET /countries/fx-rates` → `available: false` si aucune cotation |
| INS-01 | Indicateurs pays tracés (source, méthode, date) | `insights.service.js` — chaque valeur est une enveloppe de provenance | `GET /insights/overview` → `indicators.*.source/method/computedAt` |
| INS-02 | k-anonymat appliqué aux agrégats pays | `anonymize()` — `null` + motif sous le seuil | Groupe de 3 organisations → `value: null`, `reason` explicite |
| INS-03 | Aucune donnée personnelle dans l'observatoire | décomptes d'organisations et volumes déclarés seulement | `disclosure.personalData` + `caveat` « volumes déclarés » |
| SOIL-04 | Règles agronomiques versionnées, validées par un agronome distinct de l'auteur | `AgronomicRuleSet` + `validateRuleSet()` | 403 « séparation des rôles » si l'auteur valide |
| SOIL-05 | Compatibilité culture/parcelle à 4 niveaux, dont « insuffisamment documenté » | `computeSuitability()` — `coverage < 0.6` ⇒ `INSUFFICIENTLY_DOCUMENTED` | Aucun niveau affiché sous le seuil de couverture |
| SOIL-06 | Rotation pluriannuelle proposée puis statuée | `proposeRotation()` / `decideRotation()` | 409 si le plan a déjà été statué |
| SOIL-07 | Plan agricole issu du calendrier du jeu de règles | `proposeFarmingPlan()` | 409 « aucun calendrier documenté : aucun plan n'est inventé » |
| SOIL-08 | Réponse « pourquoi ? » exploitable | `explanation.satisfied / unsatisfied / missing` | Chaque critère cite sa règle, sa valeur observée et sa source |
| SOIL-09 | Aucune conclusion sans données | `missingData[]` + niveau `INSUFFICIENTLY_DOCUMENTED` | 2 critères absents ⇒ aucun niveau chiffré |
| S2 §6.4 | Recommandations derrière feature flag par zone/culture | `ZoneFeatureFlag` + `isRecommendationEnabled()` | 403 « pas encore activées » hors zone validée |
| SOIL-10→12 | Fusion multi-sources avec priorité labo > capteur > satellite > photo > déclaré | `SOURCE_PRIORITY` + `fuseProfile()` | La valeur retenue est la plus fiable ; les autres restent en `alternatives[]` |
| SOIL-13 | `GET /plots/:id/soil-profile` expose le profil fusionné | `soilService.latestProfile()` | `fusedProfile`, `sourcesUsed`, `sourcePriority` |
| SOIL-14 | Rendement en fourchette, avec incertitude | `YieldEstimate.lowKg/pointKg/highKg/uncertaintyPct` | 409 sans référence documentée ; disclaimer « pas une garantie » |
| SOIL-16 | k-anonymat ≥ 10 sur les statistiques de sol | `publicService.soilStats()` | Groupe de 1 analyse ⇒ `suppressedGroups` sans valeur |
| USSD-01 | Canal pas à pas, sans état côté opérateur | `channels.ussd()` — chaîne `1*4` | Réponse ≤ 182 caractères, sessions et messages journalisés |
| WA-01 | Webhook WhatsApp signé, sans fuite de données | `whatsappVerify()` + `verifySignature()` | 403 si signature invalide ; aucune donnée personnelle renvoyée |
| NFR-01 (V4) | MFA TOTP obligatoire, secret chiffré | `mfa.service.js` — AES-256-GCM + codes de secours hachés | 403 si non enrôlé, 401 si code faux ; code de secours à usage unique |
| COOP-10 | Offre groupée sur disponibilité déclarée, répartition traçable | `groupoffers.service.js` — `previewPool()` / `split` figé | Membres sans consentement exclus ; unités non convertibles listées |
| INV-02 | Suivi de projet explicite et révocable | `hub.follow()` / `unfollow()` | Idempotent, audité, aucun doublon |
| INV-03 | Matching sans score ni notation | `hub.matches()` — liste `✔`/`✘` | Ordre : critères satisfaits → vérification → fraîcheur |
| PRJ-04 | Mise en relation consentie par les deux parties | `requestContact()` / `decideContact()` | Coordonnées jamais exposées avant acceptation ; refus silencieux |
| PUB-03 | QR du profil public (PNG et SVG) | `farmQr()` — QRKit côté serveur | Encode **uniquement** l'URL publique canonique |
| TRC-03 | Page publique de lot | `publicLot()` | Étapes `details.public === false` masquées et comptées ; « pas une certification » |
| BIL-01 (PDF) | Facture PDF numérotée | `invoicePdf()` — PDFKit | Mention « AGRIKONNECT n'encaisse aucun fonds » sur chaque page |
| S4 (PDF) | Rapport de précision labellisé | `precision.reportPdf()` | « NE CONSTITUE PAS UNE CERTIFICATION » sur chaque page |
| SYNC-02/03 | Pull par curseur, isolation tenant, tombstones | `sync.pull()` | Aucune ligne d'une autre organisation ; `hasMore` explicite |
| V5 §6 | Endpoints publics normalisés | `/public-api/v1/{agriculture,regions,crops,market-prices,projects,farmers}` | 403 sous le seuil de k-anonymat, jamais d'arrondi |
| AI-10 | Copilote ancré sur les données | `ai.copilot()` | `grounded: false` si aucune donnée : réponse de refus explicite |
| AI-03 | Documents générés en brouillon | `ai.generateDocument()` | `requiresReview: true` + sources citées |
