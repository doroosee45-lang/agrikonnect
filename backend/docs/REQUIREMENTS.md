# Matrice de traçabilité CDC → code → preuve

> Généré par `npm run docs:requirements` — **223/223** exigences couvertes.

| Version | Exigences | Couvertes |
|---|---|---|
| V1 | 73 | 73 |
| V2 | 52 | 52 |
| V3 | 48 | 48 |
| V4 | 26 | 26 |
| V5 | 24 | 24 |


## Alias et sous-cas

| Alias | Exigence canonique | Portée |
|---|---|---|
| MFA-01 | NFR-01 | TOTP conforme RFC 6238, secret jamais stocké en clair |
| MFA-02 | NFR-01 | Code faux refusé, code de secours à usage unique |
| MFA-03 | NFR-01 | Opération sensible refusée sans enrôlement |
| MFA-04 | NFR-01 | Aucune clé de chiffrement TOTP par défaut en production (SEC-08) |
| PRI-01 | PRC-01 | Prix daté et sourcé (identifiant interne du module prices) |
| PRI-02 | PRC-02 | Série de prix avec méthode et échantillon |
| PRI-03 | PRC-03 | Marché sans relevé récent signalé, jamais interpolé |
| WEA-02 | WX-01 | Donnée météo datée et sourcée |
| WEA-03 | WX-01 | Alertes météo explicables |
| TRA-02 | TRP-01 | Distance approximative, libellés seuls |
| TRA-03 | TRP-01 | Pas de livraison sans preuve |
| PREC-02 | SOIL-15 | Aucune zone sans données |
| PREC-03 | SOIL-15 | Rapport de précision non validé par défaut |
| COOPG-01 | COOP-10 | Seules les productions des membres consentants sont agrégées |
| COOPG-02 | COOP-10 | Répartition figée et traçable de l’offre groupée |
| COOPG-03 | COOP-10 | Confirmation de l’offre groupée |
| INVH-01 | INV-03 | Matching investisseur explicable, sans score |
| INVH-02 | INV-02 | Suivre / ne plus suivre un projet de façon idempotente |
| INVH-03 | PRJ-04 | Mise en relation sans coordonnées avant acceptation |
| INVH-04 | PRJ-04 | Seul le porteur du projet statue sur une mise en relation |
| API-05 | DATA-10 | API publique : régions sous le k-anonymat retirées |
| API-06 | DATA-10 | /farmers refuse de publier sous le seuil de k-anonymat |
| API-07 | API-02 | /market-prices conserve date et source de chaque prix |
| TND-01 | PRC-10 | On ne répond pas à son propre appel d’offres |
| TRACE-01 | TRC-02 | Un lot rappelé refuse tout nouvel événement |
| LOT-01 | TRC-01 | Journal de lot append-only |
| LOT-02 | TRC-02 | Lot rappelable, statut terminal |
| LOT-03 | TRC-01 | Vue publique limitée aux champs publiés |
| LOT-04 | TRC-01 | Champs sensibles non publiables |
| REP-01 | RPT-01 | Rapport d’avancement |
| REP-02 | RPT-02 | Rapport d’impact avec provenance par indicateur |
| REP-03 | RPT-03 | Rapport publié immuable et consolidé |
| PRE-01 | PREC-01 | Zones de management calculées depuis des sources datées |
| PRE-02 | PREC-02 | Aucune zone sans donnée : refus explicite |
| PRE-03 | PREC-03 | Validation humaine d’un rapport de précision |
| TEN-01 | PRC-10 | Appel d’offres publié, réponse scellée |
| TEN-02 | PRC-10 | Réponse non modifiable après dépôt |
| TEN-03 | PRC-10 | Adjudication : une réponse retenue, les autres rejetées |

| Réf. | V | Exigence | Implémentation | Preuve | État |
|---|---|---|---|---|---|
| AUTH-01 | V1 | Inscription et création du profil, de l’organisation et de l’appartenance | `src/modules/auth/auth.schema.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-02 | V1 | Connexion, verrouillage après échecs répétés | `src/modules/auth/auth.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-03 | V1 | Code OTP SMS à durée de vie limitée et à usage unique | `src/modules/auth/auth.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-04 | V1 | Un code faux est refusé et comptabilisé | `src/modules/auth/auth.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-05 | V1 | Jeton rafraîchissable puis révocable (logout) | `src/modules/auth/auth.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-06 | V1 | Réinitialisation du mot de passe par lien à usage unique | `src/modules/auth/auth.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| AUTH-07 | V1 | Vérification de l’email | `src/modules/auth/auth.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PROF-01 | V1 | Lecture et mise à jour du profil | `src/modules/users/users.routes.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PROF-02 | V1 | Visibilité champ par champ | `src/modules/farms/farms.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PROF-03 | V1 | Préférences de notification du profil | `src/modules/dashboard/dashboard.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| PROF-04 | V1 | Aucune donnée personnelle dans les vues publiques | `src/modules/public/public.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| FARM-01 | V1 | Création d’une exploitation | `src/modules/farms/farms.schema.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| FARM-02 | V1 | Mise à jour contrôlée (version)  | `src/modules/farms/farms.service.js` | `tests/families.integration.test.mjs` | ✅ |
| FARM-03 | V1 | Archivage logique, jamais destructif | `src/modules/farms/farms.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| FARM-04 | V1 | Publication du profil public par le producteur | `src/modules/farms/farms.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PLOT-01 | V1 | Parcelle géolocalisée avec superficie dérivée | `src/modules/plots/plots.schema.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| PLOT-02 | V1 | Historique cultural de la parcelle | `src/modules/plots/plots.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PLOT-03 | V1 | Mise à jour avec verrou optimiste | `src/modules/plots/plots.routes.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PLOT-04 | V1 | Suppression logique de la parcelle | `src/modules/farms/farms.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PLOT-05 | V1 | Coordonnée hors du pays déclaré refusée | `src/modules/plots/plots.service.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| CROP-01 | V1 | Référentiel des cultures consultable | `src/modules/crops/crops.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| CROP-02 | V1 | Référentiel alimenté par l’administration seulement | `src/modules/crops/crops.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| CROP-03 | V1 | Noms localisés par langue | `src/modules/crops/crops.controller.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PROD-01 | V1 | Déclaration de production rattachée à une exploitation | `src/modules/productions/productions.schema.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| PROD-02 | V1 | Conversion en kg conservée avec l’unité d’origine | `src/modules/productions/productions.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| PROD-03 | V1 | Statistiques de production par culture et période | `src/modules/productions/productions.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PROD-04 | V1 | Provenance déclarée vs vérifiée | `src/modules/productions/productions.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| COOP-01 | V1 | Coopérative rattachée à une organisation | `src/modules/auth/auth.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| COOP-02 | V1 | Adhésion d’un membre par email ou téléphone | `src/modules/cooperatives/cooperatives.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| COOP-03 | V1 | Import CSV de membres avec essai à blanc | `src/modules/cooperatives/cooperatives.routes.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| COOP-04 | V1 | Consentement du membre par périmètre | `src/modules/cooperatives/cooperatives.routes.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| COOP-05 | V1 | Vue d’ensemble de la coopérative | `src/modules/cooperatives/cooperatives.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PUB-01 | V1 | Profil public d’une exploitation | `src/modules/farms/farms.service.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| PUB-02 | V1 | Ancien slug redirigé (jamais de lien mort) | `src/modules/farms/farms.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PUB-03 | V1 | QR du profil public en PNG et SVG | `src/modules/public/public.routes.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| PUB-04 | V1 | Partage social et balises Open Graph | `src/modules/public/public.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| PUB-05 | V1 | Profil non vérifié en noindex | `src/modules/public/public.service.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| PUB-06 | V1 | Formulaire de contact sans exposition des coordonnées | `src/modules/public/public.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| MAP-01 | V1 | Cartographie publique paginée | `src/modules/public/public.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| MAP-02 | V1 | Filtrage par bbox | `src/modules/public/public.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| MAP-03 | V1 | Filtrage par culture et pays | `src/modules/public/public.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| MAP-04 | V1 | Coordonnées publiques arrondies | `src/config/env.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| VER-01 | V1 | Demande de vérification déposée par le producteur | `src/modules/verification/verification.schema.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| VER-02 | V1 | Instruction administrative motivée | `src/modules/verification/verification.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| VER-03 | V1 | Provenance affichée séparément (déclaré ≠ vérifié) | `src/modules/verification/verification.routes.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| VER-04 | V1 | Aucune note globale de confiance | `src/modules/public/public.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| VER-05 | V1 | Décision tracée et auditable | `src/modules/users/users.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SOIL-01 | V1 | Relevé de sol daté, avec paramètres | `src/modules/soil/soil.schema.js` | `tests/families.integration.test.mjs` | ✅ |
| SOIL-02 | V1 | Rapport de laboratoire rattaché | `src/modules/soil/soil.schema.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SOIL-03 | V1 | S1 : aucun conseil automatique | `src/modules/plots/plots.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-01 | V1 | Limitation de débit sur l’authentification | `src/app.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-02 | V1 | Jeton absent ou invalide rejeté | `src/middleware/auth.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-03 | V1 | Autorisation à quatre couches (rôle, permission, tenant, ressource) | `src/middleware/authorize.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-04 | V1 | Isolation stricte entre tenants | `src/middleware/tenant.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-05 | V1 | Injection SQL neutralisée (requêtes paramétrées) | `src/middleware/validate.js` | `tests/listings.integration.test.mjs` | ✅ |
| SEC-06 | V1 | En-têtes de sécurité HTTP | `src/app.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-07 | V1 | CORS restreint aux origines déclarées | `src/app.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-08 | V1 | Corps de requête borné (413) | `src/app.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| SEC-09 | V1 | Secrets et clés jamais stockés en clair | `src/modules/admin/admin.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-10 | V1 | Journal d’audit append-only | `src/shared/audit.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-11 | V1 | Aucune donnée sensible dans les journaux | `src/shared/http/logger.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| SEC-12 | V1 | Idempotence des écritures sensibles | `src/config/env.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| NFR-01 | V1 | MFA TOTP obligatoire pour les accès sensibles | `src/modules/auth/auth.routes.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| NFR-02 | V1 | Pagination bornée et curseur | `src/modules/media/media.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| NFR-03 | V1 | Transactions pour les écritures multi-tables | `src/modules/farms/farms.service.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| NFR-04 | V1 | Pas de survente sous concurrence | `src/modules/market/orders/orders.service.js` | `tests/orders.integration.test.mjs` | ✅ |
| NFR-05 | V1 | Journalisation structurée avec identifiant de requête | `src/shared/http/logger.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| NFR-06 | V1 | Surveillance des tâches planifiées | `src/jobs/index.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| NFR-07 | V1 | Temps réel en lecture seule | `src/modules/channels/channels.service.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| I18N-01 | V1 | Français comme langue de référence | `src/config/env.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| I18N-02 | V1 | Messages d’erreur localisés | `src/shared/errors/ApiError.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| I18N-03 | V1 | Unités et devises explicites | `src/shared/money.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| MKT-01 | V2 | Annonce invisible avant publication | `src/modules/market/listings/listings.schema.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| MKT-02 | V2 | Vente plafonnée par le stock annoncé | `src/modules/market/listings/listings.routes.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| MKT-03 | V2 | Recherche par culture, prix, zone, certification | `src/modules/market/listings/listings.routes.js` | `tests/listings.integration.test.mjs` | ✅ |
| MKT-04 | V2 | Cycle de vie contrôlé et expiration | `src/modules/market/listings/listings.routes.js` | `tests/listings.integration.test.mjs` | ✅ |
| MKT-05 | V2 | Modération motivée et tracée | `src/modules/market/listings/listings.routes.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| MKT-06 | V2 | Contacter un vendeur sans exposer ses coordonnées | `src/jobs/index.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| REQ-01 | V2 | Demande d’achat sans divulgation des coordonnées | `src/modules/market/requests/requests.schema.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| REQ-02 | V2 | Critères de la demande structurés | `src/modules/market/requests/requests.routes.js` | `tests/logic.test.mjs` | ✅ |
| REQ-03 | V2 | Producteurs compatibles notifiés sans spam | `src/modules/market/requests/requests.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| REQ-04 | V2 | Offre chiffrée, datée, opposable | `src/modules/market/offers/offers.routes.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| REQ-05 | V2 | Matching explicable, jamais un score opaque | `src/modules/market/listings/listings.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| OFF-01 | V2 | Offre émise par un producteur compatible | `src/modules/market/offers/offers.service.js` | `tests/families.integration.test.mjs` | ✅ |
| OFF-02 | V2 | Validité datée de l’offre | `src/modules/market/offers/offers.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| OFF-03 | V2 | Acceptation transforme l’offre en commande | `src/modules/market/offers/offers.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| OFF-04 | V2 | Retrait possible avant décision | `src/modules/market/offers/offers.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| ORD-01 | V2 | Création idempotente | `src/modules/market/orders/orders.routes.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| ORD-02 | V2 | Conditions figées dans un instantané | `src/jobs/index.js` | `tests/jobs.integration.test.mjs` | ✅ |
| ORD-03 | V2 | Machine à états stricte, par rôle et par état | `src/modules/market/orders/orders.routes.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| ORD-04 | V2 | Aucun paiement opéré par la plateforme | `src/modules/market/orders/orders.routes.js` | `tests/orders.integration.test.mjs` | ✅ |
| ORD-05 | V2 | Litige ouvert, instruit et arbitré | `src/modules/market/orders/orders.routes.js` | `tests/orders.integration.test.mjs` | ✅ |
| STK-01 | V2 | Stock dérivé des mouvements, jamais un solde | `src/jobs/index.js` | `tests/families.integration.test.mjs` | ✅ |
| STK-02 | V2 | Pas de stock négatif | `src/modules/market/inventory/inventory.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| TRP-01 | V2 | Transport lié à une commande, offres, preuve de livraison | `src/modules/transport/transport.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| TRA-01 | V2 | Transport rattaché à une commande | `src/modules/transport/transport.routes.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| TRA-02 | V2 | Distance approximative, libellés seuls | `src/modules/transport/transport.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| TRA-03 | V2 | Pas de livraison sans preuve | `src/modules/transport/transport.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| MSG-01 | V2 | Messagerie rattachée à un dossier métier | `src/modules/market/orders/orders.service.js` | `tests/messaging.integration.test.mjs` | ✅ |
| MSG-02 | V2 | Fil inaccessible à un tiers | `src/modules/messaging/messaging.service.js` | `tests/messaging.integration.test.mjs` | ✅ |
| MSG-03 | V2 | Signalement conservé pour la modération | `src/modules/messaging/messaging.routes.js` | `tests/messaging.integration.test.mjs` | ✅ |
| MSG-04 | V2 | Notification temps réel sans polling | `src/modules/messaging/messaging.service.js` | `tests/messaging.integration.test.mjs` | ✅ |
| NOTIF-01 | V2 | Notification in-app et e-mail | `src/modules/notifications/notifications.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| NOTIF-02 | V2 | Aucun doublon (clé de déduplication) | `src/jobs/index.js` | `tests/jobs.integration.test.mjs` | ✅ |
| NOTIF-03 | V2 | Préférences par type et par canal | `src/modules/notifications/notifications.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| NOTIF-04 | V2 | Purge selon la durée de conservation | `src/modules/notifications/notifications.service.js` | `tests/req-v2.integration.test.mjs` | ✅ |
| BIL-01 | V2 | Numérotation séquentielle par organisation et facture PDF | `src/modules/billing/billing.routes.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| BIL-02 | V2 | Conversion uniquement avec un taux daté et sourcé | `src/modules/billing/billing.service.js` | `tests/logic.test.mjs` | ✅ |
| REV-01 | V2 | Avis seulement après livraison | `src/modules/market/reviews/reviews.service.js` | `tests/reviews.integration.test.mjs` | ✅ |
| REV-02 | V2 | Réputation = moyenne et volume | `src/modules/market/reviews/reviews.service.js` | `tests/reviews.integration.test.mjs` | ✅ |
| REV-03 | V2 | Aucune note inventée sans avis | `src/modules/market/reviews/reviews.service.js` | `tests/reviews.integration.test.mjs` | ✅ |
| DISP-01 | V2 | Litige tracé avec preuves | `src/modules/market/orders/orders.service.js` | `tests/orders.integration.test.mjs` | ✅ |
| DISP-02 | V2 | Décision de modération conservée | `src/jobs/index.js` | `tests/jobs.integration.test.mjs` | ✅ |
| MOD-01 | V2 | Modération d’annonce motivée | `src/modules/market/listings/listings.service.js` | `tests/listings.integration.test.mjs` | ✅ |
| MOD-02 | V2 | Modération d’avis sans destruction de preuve | `src/modules/market/reviews/reviews.routes.js` | `tests/reviews.integration.test.mjs` | ✅ |
| COOP-10 | V2 | Offre groupée avec répartition traçable | `src/modules/cooperatives/cooperatives.controller.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-04 | V2 | Règles agronomiques versionnées et validées par un tiers | `src/modules/soil/intelligence.service.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-05 | V2 | Compatibilité culture à quatre niveaux | `src/modules/soil/intelligence.service.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-06 | V2 | Rotation pluriannuelle proposée puis statuée | `src/modules/soil/intelligence.service.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-07 | V2 | Plan agricole issu du calendrier validé | `src/modules/soil/intelligence.service.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| SOIL-08 | V2 | Réponse « pourquoi ? » sourcée | `src/modules/soil/intelligence.service.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-09 | V2 | Aucune conclusion sans données | `src/modules/soil/intelligence.service.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SYNC-01 | V3 | Travail hors-ligne rejouable | `src/modules/sync/sync.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| SYNC-02 | V3 | Idempotence par opération | `src/modules/sync/sync.service.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| SYNC-03 | V3 | Conflits détectés, jamais écrasés | `src/modules/sync/sync.service.js` | `tests/families.integration.test.mjs` | ✅ |
| SYNC-04 | V3 | Rapport de conflits consultable | `src/modules/sync/sync.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| SYNC-05 | V3 | Pull incrémental par curseur | `src/modules/sync/sync.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| AI-01 | V3 | Consentement avant analyse d’image | `src/modules/ai/ai.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| AI-02 | V3 | Toute sortie porte un avertissement | `src/modules/ai/ai.service.js` | `tests/policies.integration.test.mjs` | ✅ |
| AI-03 | V3 | Confiance affichée, jamais implicite | `src/modules/ai/ai.routes.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| AI-04 | V3 | Version de prompt et de modèle traçables | `src/modules/ai/ai.routes.js` | `tests/policies.integration.test.mjs` | ✅ |
| AI-05 | V3 | Escalade humaine possible | `src/modules/ai/ai.service.js` | `tests/policies.integration.test.mjs` | ✅ |
| AI-06 | V3 | Quotas anti-abus | `src/modules/ai/ai.service.js` | `tests/policies.integration.test.mjs` | ✅ |
| AI-10 | V3 | Copilote ancré sur les données et documents en brouillon | `src/modules/ai/ai.routes.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| WX-01 | V3 | Météo sourcée et horodatée, alertes contextualisées à la culture | `src/modules/weather/weather.service.js` | `tests/families.integration.test.mjs` | ✅ |
| WEA-01 | V3 | Aucune météo inventée | `src/modules/weather/weather.service.js` | `tests/families.integration.test.mjs` | ✅ |
| WEA-02 | V3 | Donnée météo datée et sourcée | `src/modules/weather/weather.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| WEA-03 | V3 | Alertes météo explicables | `src/modules/weather/weather.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| PRC-01 | V3 | Prix agricoles : produit, marché, date, devise, unité, source | `src/modules/prices/prices.service.js` | `tests/families.integration.test.mjs` | ✅ |
| PRC-02 | V3 | Aucun prix universel : zone et date toujours visibles | `src/modules/prices/prices.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| PRC-03 | V3 | Sources distinctes, jamais mélangées sans étiquette | `src/modules/prices/prices.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| PRI-01 | V3 | Chaque prix est daté et sourcé | `src/modules/prices/prices.service.js` | `tests/families.integration.test.mjs` | ✅ |
| PRI-02 | V3 | Série de prix avec méthode affichée | `src/modules/prices/prices.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| PRI-03 | V3 | Marchés sans relevé signalés | `src/modules/prices/prices.routes.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| TRC-01 | V3 | Lot traçable avec code normalisé | `src/modules/traceability/traceability.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| TRC-02 | V3 | Journal de lot append-only et rappel | `src/modules/traceability/traceability.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| TRC-03 | V3 | Page publique de lot limitée aux champs publiés | `src/modules/public/public.service.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| CERT-01 | V3 | Déclaré n’est pas vérifié | `src/modules/certifications/certifications.service.js` | `tests/families.integration.test.mjs` | ✅ |
| CERT-02 | V3 | Vérification réservée à l’administration | `src/modules/certifications/certifications.routes.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| CERT-03 | V3 | Expiration prise en compte partout | `src/modules/certifications/certifications.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| IOT-01 | V3 | Clé d’appareil hachée, affichée une fois | `src/modules/iot/iot.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| IOT-02 | V3 | Clé révocable et rotative | `src/modules/iot/iot.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| IOT-03 | V3 | Seuils vers alertes, aucune action automatique | `src/jobs/index.js` | `tests/jobs.integration.test.mjs` | ✅ |
| IOT-04 | V3 | Mesures non interpolées (trous signalés) | `src/modules/iot/iot.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| GEO-01 | V3 | Données satellite, drone et laboratoire rattachées à la parcelle | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| DRN-01 | V3 | Levé drone rattaché à la parcelle par un opérateur déclaré | `src/modules/geodata/geodata.service.js` | `tests/req-v3.integration.test.mjs` | ✅ |
| GEO-02 | V3 | Provenance distincte par source | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| GEO-03 | V3 | Écriture laboratoire réservée au partenaire | `src/modules/geodata/geodata.routes.js` | `tests/families.integration.test.mjs` | ✅ |
| USSD-01 | V3 | Canal USSD pas à pas, sans état opérateur | `src/modules/channels/channels.routes.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| WA-01 | V3 | Webhook WhatsApp signé | `src/app.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| SOIL-10 | V3 | Fusion multi-sources, priorité laboratoire | `src/integrations/geospatial.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| SOIL-11 | V3 | Capteur puis satellite puis photo puis déclaré | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| SOIL-12 | V3 | Valeurs concurrentes conservées en alternatives | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| SOIL-13 | V3 | Profil de sol fusionné exposé | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| SOIL-14 | V3 | Rendement en fourchette avec incertitude | `src/integrations/geospatial.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| PRJ-01 | V4 | Projet public seulement après revue | `src/modules/projects/projects.service.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| PRJ-02 | V4 | Provenance champ par champ | `src/modules/projects/projects.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| PRJ-03 | V4 | Pas d’auto-vérification | `src/modules/projects/projects.service.js` | `tests/families.integration.test.mjs` | ✅ |
| PRJ-04 | V4 | Aucune promesse de rendement | `src/modules/investors/hub.routes.js` | `tests/families.integration.test.mjs` | ✅ |
| PRJ-05 | V4 | Revue administrative motivée | `src/modules/projects/projects.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| INV-01 | V4 | Profil investisseur vérifié | `src/modules/investors/investors.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| INV-02 | V4 | MFA obligatoire pour les données sensibles | `src/modules/investors/hub.routes.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| INV-03 | V4 | Accès data room conditionné à la vérification | `src/modules/investors/hub.routes.js` | `tests/intelligence.integration.test.mjs` | ✅ |
| DR-01 | V4 | Data room fermée par défaut | `src/modules/dataroom/dataroom.routes.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| DR-02 | V4 | Demande d’accès justifiée et bornée | `src/config/env.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| DR-03 | V4 | Décision du porteur avec expiration | `src/modules/dataroom/dataroom.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| DR-04 | V4 | Téléchargement désactivé par défaut | `src/modules/dataroom/dataroom.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| DR-05 | V4 | Journal d’accès append-only | `src/modules/dataroom/dataroom.routes.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| DD-01 | V4 | Checklist de due diligence structurée | `src/modules/duediligence/duediligence.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| DD-02 | V4 | Vérification professionnelle nominative | `src/modules/duediligence/duediligence.service.js` | `tests/families.integration.test.mjs` | ✅ |
| DD-03 | V4 | Due diligence jamais publique | `src/modules/duediligence/duediligence.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| RPT-01 | V4 | Rapports horodatés par le serveur | `src/modules/reporting/reporting.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| RPT-02 | V4 | Impact avec source par indicateur | `src/modules/reporting/reporting.service.js` | `tests/families.integration.test.mjs` | ✅ |
| RPT-03 | V4 | Aucune réécriture d’un rapport publié | `src/modules/reporting/reporting.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| FUND-01 | V4 | Consentement préalable matérialisé | `src/modules/funding/funding.routes.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| FUND-02 | V4 | Transmission impossible sans consentement | `src/modules/funding/funding.routes.js` | `tests/families.integration.test.mjs` | ✅ |
| FUND-03 | V4 | Aucune activité financière régulée | `src/modules/funding/funding.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| SOIL-15 | V4 | Zonage de parcelle et recommandations par zone (bonne / moyenne / problème) | `src/modules/precision/precision.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| PREC-01 | V4 | Zones de gestion versionnées et sourcées | `src/modules/precision/precision.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| PREC-02 | V4 | Aucune zone sans données | `src/modules/precision/precision.service.js` | `tests/families.integration.test.mjs` | ✅ |
| PREC-03 | V4 | Rapport non validé par défaut | `src/modules/precision/precision.service.js` | `tests/req-v4.integration.test.mjs` | ✅ |
| GLB-01 | V5 | Référentiel pays, devises, unités | `src/modules/countries/countries.routes.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| GLB-02 | V5 | Profils de conformité par pays | `src/modules/countries/countries.routes.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| GLB-03 | V5 | Taux de change datés et sourcés | `src/modules/countries/countries.routes.js` | `tests/families.integration.test.mjs` | ✅ |
| GLB-04 | V5 | Endpoints publics normalisés (/agriculture, /regions, /crops…) | `src/modules/publicapi/publicapi.service.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| PRC-10 | V5 | Appels d’offres avec réponses scellées | `src/modules/tenders/tenders.service.js` | `tests/e2e/channels.e2e.test.mjs` | ✅ |
| EXP-01 | V5 | Incoterm contrôlé | `src/modules/exports/exports.service.js` | `tests/families.integration.test.mjs` | ✅ |
| EXP-02 | V5 | Taux de change daté pour l’export | `src/modules/exports/exports.service.js` | `tests/families.integration.test.mjs` | ✅ |
| EXP-03 | V5 | Certification impossible sans documents | `src/modules/exports/exports.service.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| API-01 | V5 | Clé hachée, affichée une seule fois | `src/middleware/apiKey.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| API-02 | V5 | Clé révocable et expirable | `src/jobs/index.js` | `tests/jobs.integration.test.mjs` | ✅ |
| API-03 | V5 | Finalité approuvée avant usage | `src/middleware/apiKey.js` | `tests/e2e/journeys.e2e.test.mjs` | ✅ |
| API-04 | V5 | Quota et journal d’usage | `src/modules/apiclients/apiclients.routes.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| DATA-01 | V5 | Produits de données publiables seulement si conformes | `src/modules/dataproducts/dataproducts.service.js` | `tests/policies.integration.test.mjs` | ✅ |
| DATA-02 | V5 | k-anonymat strict dans les agrégats | `src/modules/dataproducts/dataproducts.routes.js` | `tests/policies.integration.test.mjs` | ✅ |
| DATA-03 | V5 | Composition et version de règle exposées | `src/modules/dataproducts/dataproducts.service.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| DATA-04 | V5 | Contrat de données obligatoire | `src/modules/dataproducts/dataproducts.routes.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| DATA-10 | V5 | Non-ré-identification (ni min, ni max, ni liste) | `src/modules/dataproducts/dataproducts.service.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| INS-01 | V5 | Indicateurs pays tracés (source, méthode, date) | `src/modules/insights/insights.routes.js` | `tests/families.integration.test.mjs` | ✅ |
| INS-02 | V5 | k-anonymat appliqué aux agrégats pays | `src/modules/insights/insights.service.js` | `tests/families.integration.test.mjs` | ✅ |
| INS-03 | V5 | Aucune donnée personnelle dans l’observatoire | `src/modules/insights/insights.routes.js` | `tests/req-v5.integration.test.mjs` | ✅ |
| SOIL-16 | V5 | Statistiques de sol agrégées, k ≥ 10 | `src/modules/public/public.routes.js` | `tests/e2e/intelligence.e2e.test.mjs` | ✅ |
| BIL-03 | V2 | Numérotation séquentielle par organisation et par type, sans trou | `src/modules/billing/billing.service.js` | `tests/req-extra.integration.test.mjs` | ✅ |
| BIL-04 | V2 | Règlement déclaratif hors plateforme, aucun fonds détenu | `src/modules/billing/billing.service.js` | `tests/req-extra.integration.test.mjs` | ✅ |
| AI-07 | V3 | Revue experte d’une analyse IA : annotation humaine, sortie machine inchangée | `src/modules/ai/ai.routes.js` | `tests/req-extra.integration.test.mjs` | ✅ |
| CERT-04 | V3 | Certifications fiables d’une organisation, séparées du déclaratif | `src/modules/certifications/certifications.service.js` | `tests/req-extra.integration.test.mjs` | ✅ |
| NFR-08 | V3 | Jeu de règles agronomiques opposable seulement après validation par un tiers | `src/modules/soil/intelligence.service.js` | `tests/req-extra.integration.test.mjs` | ✅ |
| NFR-09 | V3 | Minimisation des données transmises à l’IA, consentement explicite | `src/modules/ai/ai.service.js` | `tests/policies.integration.test.mjs` | ✅ |
| NFR-10 | V3 | Disponibilité 99,5 % : dégradation explicite, aucun diagnostic de substitution | `src/integrations/geospatial.js` | `tests/geospatial.integration.test.mjs` | ✅ |
| NFR-11 | V1 | Logs structurés avec identifiant de corrélation | `src/shared/http/requestId.js` | `tests/req-v1.integration.test.mjs` | ✅ |
| FX-01 | V5 | Cotation datée et sourcée, jamais implicite | `src/modules/countries/fx.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| FX-02 | V5 | Cotation refusée si future ou non strictement positive | `src/modules/countries/fx.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
| FX-03 | V5 | Enregistrement de cotation idempotent sur (base, quote, asOf) | `src/modules/countries/fx.service.js` | `tests/families-v1.integration.test.mjs` | ✅ |
