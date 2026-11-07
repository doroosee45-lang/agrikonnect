# EXIGENCES NON FONCTIONNELLES (NFR) — V1 → V5

Le cahier des charges numérote ses exigences non fonctionnelles **par version**
(`V1 §10`, `V2 §10`, `V3 §10`, `V4 §10`, `V5 §10`). Cette matrice est lue par
`npm run check:cdc` : chaque identifiant de `docs/CDC-INVENTAIRE.md` doit y
apparaître.

Colonne **Portée** :
- `backend` — mesurable dans ce dépôt (code ou test) ;
- `exploitation` — configuration/déploiement, documentée dans `docs/DEPLOYMENT.md` ;
- `client` — dépend du front ou de l'application mobile (hors de ce dépôt), le
  backend fournit le contrat nécessaire ;
- `mesure` — cible chiffrée à valider par un test de charge en staging : le
  backend fournit les moyens (pagination, index, quotas) mais **la mesure n'a
  pas été exécutée ici** — c'est dit explicitement plutôt que supposé atteint.

## V1:NFR

| Réf. | Cible du CDC | Réponse du backend | Preuve | Portée |
|---|---|---|---|---|
| V1:NFR-01 | 10 000 utilisateurs, 100 concurrents, 50 000 parcelles, charge 3× | Pagination bornée sur toutes les listes, index sur chaque filtre courant, agrégations en base | `src/shared/pagination.js`, index de `prisma/migrations/20260918000000_init` (121 index) | mesure |
| V1:NFR-02 | API p95 < 500 ms sur les lectures | Requêtes paginées et indexées, projections publiques dédiées (jamais le document brut), aucune jointure inutile | `src/shared/pagination.js`, `src/modules/public/public.service.js` | mesure |
| V1:NFR-03 | LCP < 2,5 s, poids initial maîtrisé | Hors backend : le backend sert des payloads paginés et des URL de médias déjà redimensionnés | `docs/API.md` (conventions de pagination) | client |
| V1:NFR-04 | Images ≤ 5 Mo, reprise d'upload | Plafond de taille refusé à la validation, type MIME contrôlé, URL d'upload signée | `src/modules/media/media.schema.js` (`MAX_SIZE_BYTES = 5 Mo`) | backend |
| V1:NFR-05 | SEO ≥ 90, sitemap, Open Graph | Balises et Open Graph produits côté serveur, `noindex` des profils non vérifiés | `src/modules/public/public.service.js` (PUB-04/PUB-05), `tests/req-v1.integration.test.mjs` | backend |
| V1:NFR-06 | WCAG 2.1 AA sur les parcours principaux | Hors backend : l'API renvoie des libellés et des états explicites, jamais de couleur comme seule information | `src/shared/http/response.js` | client |
| V1:NFR-07 | Disponibilité 99,5 % | Sonde de santé, démarrage refusé si la configuration est invalide, dégradation explicite des intégrations absentes | `src/routes/index.js` (`GET /health`), `src/config/env.js`, `npm run smoke` (315 opérations, 0 route fantôme) | exploitation |
| V1:NFR-08 | Sauvegardes quotidiennes, RPO ≤ 24 h, RTO ≤ 4 h | Journal d'audit et événements de lot append-only (restauration cohérente), procédure documentée | `docs/DEPLOYMENT.md` §3.4, `tests/req-v1.integration.test.mjs` (SEC-10) | exploitation |
| V1:NFR-09 | Sécurité Annexe A.4.1, audit de dépendances, test d'intrusion | SEC-01 → SEC-12 implémentées et testées ; `npm audit` dans la CI ; test d'intrusion externe à planifier | `tests/req-v1…v5`, `src/middleware/{rateLimit,auth,authorize,tenant}.js` | backend |
| V1:NFR-10 | Appareils bas de gamme, connexions instables | Réponses paginées et bornées, identifiants générés côté client acceptés, écritures idempotentes | `src/shared/ids.js`, `src/middleware/idempotency.js` | backend |
| V1:NFR-11 | Logs structurés avec identifiant de corrélation | Identifiant de requête injecté et repris dans chaque log et chaque erreur | `src/shared/http/{requestId,logger,errorHandler}.js`, `tests/req-v1.integration.test.mjs` (NFR-11) | backend |

## V2:NFR

| Réf. | Cible du CDC | Réponse du backend | Preuve | Portée |
|---|---|---|---|---|
| V2:NFR-01 | Recherche p95 < 800 ms sur 100 000 annonces | Filtres indexés, pagination, aucun tri non indexé | `src/modules/market/listings`, index `listings` de la migration initiale | mesure |
| V2:NFR-02 | Messagerie p95 < 2 s, reprise sans perte | Historique par curseur (`before`), aucun doublon ni perte | `tests/messaging.integration.test.mjs` (MSG-02) | backend |
| V2:NFR-03 | Notifications < 30 s, déduplication, plafond | Événement central → N canaux, déduplication, plafond anti-spam | `src/modules/notifications`, `tests/req-v2.integration.test.mjs` (NOTIF-02/03/04) | backend |
| V2:NFR-04 | Aucune survente | Réservation atomique avec condition sur le solde, jamais de solde négatif | `tests/orders.integration.test.mjs` (NFR-04 : deux commandes valides, une seule passe) | backend |
| V2:NFR-05 | Numérotation séquentielle sans trou, PDF reproductible | Séquence par organisation et par type, taux de change figé dans le document | `src/modules/billing/billing.service.js`, `tests/req-extra.integration.test.mjs` (BIL-03) | backend |
| V2:NFR-06 | 99,5 %, dégradation si le cache est absent | Aucune dépendance dure à un cache : l'absence d'un fournisseur produit une erreur explicite, jamais une valeur inventée | `tests/families.integration.test.mjs` (WEA-01) | exploitation |
| V2:NFR-07 | Anti-abus : limites, signalement, blocage | Rate limiting par route sensible, signalements, blocage d'interlocuteur | `src/middleware/rateLimit.js`, `tests/req-v2.integration.test.mjs` (MSG-03, MOD-01/02) | backend |
| V2:NFR-08 | Aucun contact avant accord, pièces jointes privées | Coordonnées retirées des projections publiques et du matching, stockage privé + URL signées | `tests/req-v2.integration.test.mjs` (REQ-05), `src/modules/media` | backend |
| V2:NFR-09 | Android bas de gamme, mode léger | Hors backend : payloads bornés et mode « lecture seule » exposé par l'API | `docs/API.md` | client |
| V2:NFR-10 | Chaque transition et modération auditée | Écriture d'audit sur chaque transition d'état et décision de modération | `src/shared/audit.js`, `src/shared/orderStateMachine.js` | backend |

## V3:NFR

| Réf. | Cible du CDC | Réponse du backend | Preuve | Portée |
|---|---|---|---|---|
| V3:NFR-01 | Synchronisation idempotente, aucune duplication au rejeu | `opId` unique par opération, rejeu sans effet double | `src/modules/sync/sync.service.js`, `tests/intelligence.integration.test.mjs` (SYNC-02) | backend |
| V3:NFR-02 | Parcours essentiels hors ligne | Push et pull incrémentaux par curseur, soft delete propagé | `src/modules/sync/sync.service.js`, `tests/e2e/intelligence.e2e.test.mjs` | backend |
| V3:NFR-03 | IA texte p95 < 10 s, image p95 < 30 s | Timeout et retries bornés côté intégrations, aucune attente indéfinie | `src/integrations/geospatial.js` (`GEOAI_TIMEOUT_MS`), `src/modules/ai` | mesure |
| V3:NFR-04 | Seuils de qualité IA avant mise en production | Sortie IA jamais opposable seule : revue humaine et escalade agronome | `tests/req-extra.integration.test.mjs` (AI-07) | backend |
| V3:NFR-05 | Budgets IA mensuels et alertes | Quotas par utilisateur et par organisation, réponse 429 au-delà | `src/shared/quota.js`, `tests/policies.integration.test.mjs` (AI-06) | backend |
| V3:NFR-06 | Ingestion IoT tolérante aux doublons et au désordre | Mesures hors bornes rejetées, trous signalés, jamais d'interpolation | `src/modules/iot`, `tests/req-v3.integration.test.mjs` (IOT-03/04) | backend |
| V3:NFR-07 | USSD : session courte, menus ≤ 4 niveaux | Profondeur bornée à 4 niveaux, au-delà retour au menu principal et refus journalisé | `src/modules/channels/channels.service.js` (`MAX_USSD_DEPTH`), `tests/intelligence.integration.test.mjs` | backend |
| V3:NFR-08 | Base locale chiffrée, effacement à la déconnexion | Hors backend : jetons d'accès courts et révocables, révocation de session côté serveur | `src/modules/auth` (AUTH-05), `tests/req-v1.integration.test.mjs` | client |
| V3:NFR-09 | Minimisation des données transmises à l'IA, consentement | Consentement enregistré et révocable, contexte minimal, journalisation des requêtes | `src/modules/ai/ai.service.js`, `tests/policies.integration.test.mjs` (AI-05 / NFR-09) | backend |
| V3:NFR-10 | 99,5 %, dégradation sans fournisseur | Moteur géospatial absent → `503` explicite, aucun diagnostic de substitution | `src/integrations/geospatial.js`, `tests/geospatial.integration.test.mjs` | backend |

## V4:NFR

| Réf. | Cible du CDC | Réponse du backend | Preuve | Portée |
|---|---|---|---|---|
| V4:NFR-01 | MFA obligatoire, sessions courtes | TOTP réel (secret chiffré AES-256-GCM, codes de secours à usage unique), exigé pour l'investisseur et la data room | `src/modules/auth/mfa.service.js`, `tests/intelligence.integration.test.mjs` (MFA-01→04), `tests/families-v1.integration.test.mjs` (INV-02) | backend |
| V4:NFR-02 | URL signées ≤ 5 min, journal append-only | TTL issue de `SIGNED_URL_TTL_SECONDS` (300 s par défaut), jamais de durée en dur ; journal d'accès append-only | `src/modules/media/media.service.js`, `src/config/env.js`, `tests/req-v4.integration.test.mjs` (DR-04/05) | backend |
| V4:NFR-03 | Test d'intrusion externe avant mise en production | À réaliser avant mise en production ; les tests négatifs d'accès (admin, tiers, accès expiré) sont déjà automatisés | `tests/req-v4.integration.test.mjs`, `docs/DEPLOYMENT.md` §8 | exploitation |
| V4:NFR-04 | Conservation des journaux d'accès, horodatage fiable | Journal append-only (aucune API de mise à jour), horodatage serveur | `src/modules/dataroom`, `tests/req-v1.integration.test.mjs` (SEC-10) | backend |
| V4:NFR-05 | 99,5 %, sauvegardes chiffrées, restauration testée | Chiffrement au repos délégué à l'hébergeur, procédure de restauration documentée | `docs/DEPLOYMENT.md` §3.4 | exploitation |
| V4:NFR-06 | Ouverture de document p95 < 3 s, recherche p95 < 800 ms | URL signée générée après contrôle d'autorisation, requêtes paginées et indexées | `src/modules/dataroom`, `src/shared/pagination.js` | mesure |
| V4:NFR-07 | Mentions, avertissements, consentements, droits | Avertissement « pas une certification » dans chaque rapport de précision, consentement horodaté et révocable avant toute transmission | `src/modules/precision`, `src/modules/funding`, `tests/req-v4.integration.test.mjs` | backend |
| V4:NFR-08 | Chaque changement de statut et décision audité | Audit sur les transitions de projet, décisions d'accès et vérifications | `src/shared/audit.js`, `src/modules/projects` | backend |
| V4:NFR-09 | Accessibilité WCAG 2.1 AA sur les parcours V4 | Hors backend : réponses explicites, aucun état transmis uniquement par la mise en forme | `src/shared/http/response.js` | client |

## V5:NFR

| Réf. | Cible du CDC | Réponse du backend | Preuve | Portée |
|---|---|---|---|---|
| V5:NFR-01 | 99,9 % API principale, SLO distinct pour l'API publique | Sonde de santé, quotas et journal d'usage propres à l'API publique | `src/routes/index.js`, `src/middleware/apiKey.js`, `npm run smoke` | exploitation |
| V5:NFR-02 | Multi-zones, plan de reprise, exercices | Aucune dépendance à un nœud unique côté code ; plan de reprise et sauvegardes documentés | `docs/DEPLOYMENT.md` §3.4, §7 | exploitation |
| V5:NFR-03 | p95 < 500 ms, CDN pour le public | Projections publiques légères, médias servis par URL signée (cacheable par CDN) | `src/modules/public`, `src/modules/media` | mesure |
| V5:NFR-04 | Résidence des données par pays, isolation par countryCode | Résidence enregistrée par pays (`Country.hosting`), `countryCode` sur les entités, `COUNTRY_ADMIN` borné à son pays | `prisma/schema.prisma` (migration `20261021020000_country_hosting`), `src/modules/countries/countries.routes.js`, `tests/req-v5.integration.test.mjs` (GLB-01/02) | backend |
| V5:NFR-05 | Rotation et révocation des clés API, test d'intrusion annuel | Clé hachée, affichée une seule fois, révocable et expirable, journal d'usage | `src/middleware/apiKey.js`, `tests/req-v5.integration.test.mjs` (API-01/02), `tests/jobs.integration.test.mjs` | backend |
| V5:NFR-06 | Registre des traitements, contrats de finalité | Contrat de données obligatoire, finalités autorisées, retrait pris en compte | `src/modules/dataproducts`, `tests/req-v5.integration.test.mjs` (DATA-03/04) | backend |
| V5:NFR-07 | Observabilité par pays | Identifiant de corrélation et `countryCode` dans les journaux, sonde de santé | `src/shared/http/{requestId,logger}.js` | backend |
| V5:NFR-08 | Suivi des coûts par pays et par client API | Quota quotidien par client et journal d'usage par clé | `src/shared/quota.js`, `src/modules/apiclients` | backend |
| V5:NFR-09 | Chaînes externalisées, formats locaux | `locale` par utilisateur et par pays, unités et devises par référentiel, aucun format codé en dur | `src/shared/units.js`, `src/shared/money.js`, `tests/req-v5.integration.test.mjs` (I18N-01/02/03) | backend |
| V5:NFR-10 | Revue juridique par pays avant activation | Un pays n'est servi que si son statut est `PILOT` ou `ACTIVE`, son profil de conformité est versionné | `src/modules/countries/countries.routes.js` (`PUBLIC_FIELDS` filtré par statut), `tests/req-v5.integration.test.mjs` (GLB-02) | backend |

## Points non mesurés ici

Trois cibles chiffrées dépendent d'un test de charge en staging et **n'ont pas
été mesurées dans ce dépôt** : `V1:NFR-01`, `V1:NFR-02`, `V2:NFR-01`,
`V3:NFR-03`, `V4:NFR-06`, `V5:NFR-03` (colonne `mesure`). Le backend fournit
les moyens exigés (pagination bornée, index, quotas, timeouts), mais affirmer
que les p95 sont atteints sans mesure serait une statistique inventée — ce que
le principe P3 du cahier des charges interdit.

De même, `V1:NFR-03`, `V1:NFR-06`, `V2:NFR-09`, `V3:NFR-08` et `V4:NFR-09`
relèvent du front ou de l'application mobile, absents de ce dépôt.
