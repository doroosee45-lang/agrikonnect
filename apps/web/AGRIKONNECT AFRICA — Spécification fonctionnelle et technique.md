AGRIKONNECT AFRICA — Spécification fonctionnelle et technique
Module : Espace Super Administration (Super Admin)
Champ	Valeur
Référence	SPEC-SUPER-ADMIN
Version	1.0
Date	2026-10-31
Statut	Validé pour développement
Périmètre	Backend (Node/Express/Prisma/Supabase) · Web (React) · Mobile (React Native/Expo)
Référentiels	CDC V1→V5 §3.2 (rôles) · SEC-03 (gouvernance des rôles) · NFR-01 (MFA) · A.2 (permissions)
Livraison	Code source fichier par fichier en conversation, chemins exacts, tests réels par chaîne complète
0. Analyse de l'architecture existante (état des lieux)
0.1 Ce qui existe déjà (base solide — à consolider, pas à réécrire)
Couche	Existant
Backend — modules	admin, dashboard, users, apiclients, verification, notifications, sync, reporting, countries (config réservée SUPER_ADMIN), alerts, iot, market… (55 modules)
Backend — API admin	GET /admin/dashboard, GET /admin/jobs, POST /admin/jobs/:name/run, GET/PUT /admin/settings, GET /admin/export/farms, + listes/modération
Backend — sécurité	authenticate (Supabase JWT), authorize(permission), requireRole, requireAdmin, anti brute-force (5 échecs → blocage), MFA TOTP maison (secrets chiffrés), audit (AuditLog)
Permissions	Matrice RBAC shared/permissions.js : admin.users, admin.audit, admin.settings (SUPER_ADMIN,ADMIN), admin.dashboard (+MODERATOR), admin.jobs…
Web — pages admin	33 pages dans apps/web/src/pages/admin/ : Dashboard, Users, Settings, AuditLog, ApiClients, Moderation, Verifications, Countries, Rules, Sync, Monitoring…
Mobile — écrans admin	32 écrans dans apps/Mobile/src/app/admin/ : index.tsx, users.tsx, settings.tsx, audit.tsx, monitoring.tsx, api-clients.tsx, sync.tsx…
Base de données	profiles, organizations, memberships (rôles Role[]), audit_logs, settings, api_clients, api_keys, api_usage, resource_usages, notifications, notification_preferences, sync_operations, tokens, verifications, zone_feature_flags, iot_devices, sms_*…
Jobs planifiés	11 tâches (alertes, listings, orders, dataroom, iot, apikeys, recommendations, notifications.purge, disputes.sla…) déjà pilotables via admin.jobs
0.2 Écarts à combler (périmètre de cette spécification)
#	Écart	Traitement
G1	Séparation stricte SUPER_ADMIN / ADMIN non explicite (admin.settings ouvert à ADMIN)	Matrice à deux paliers + garde requireSuperAdmin
G2	Gestion des rôles incomplète : pas d'écran/API d'attribution des rôles de gouvernance (SEC-03)	M2 complet
G3	Dashboard présent mais indicateurs à consolider (KPIs calculés, temps réel, exports)	M1
G4	Supervision dispersée (jobs, services dégradés, sync, monitoring)	M5 : centre de supervision unique
G5	Paramètres globaux : structure par sections, plages de valeurs, journalisation des changements	M3
G6	Audit : lister existe ; recherche avancée, export, intégrité, corrélation d'actions sensibles	M6
G7	MFA obligatoire pour les rôles de gouvernance non encodée comme règle stricte	M6/RG-S1
1. Vision et principes directeurs
Contrôle global exclusif : le Super Admin est le seul rôle à pouvoir configurer la plateforme dans son ensemble (paramètres globaux, rôles de gouvernance, clés de service, feature flags, maintenance).
Séparation stricte des privilèges : aucun autre rôle (ADMIN inclus) ne dispose des capacités « palier 2 » (§2). Aucune élévation de privilège n'est possible depuis l'application hors nomination par un Super Admin.
Moindre privilège : chaque écran/API exige la permission exacte ; aucune permission implicite.
Traçabilité totale : toute action de gouvernance écrit une entrée audit_logs immuable (acteur, action, ressource, avant/après, IP, corrélation).
Zéro donnée fictive : tous les indicateurs sont calculés en base ; les états vides sont des états UI explicites, jamais des valeurs d'exemple.
Chaîne vérifiée : aucune fonctionnalité « terminée » sans validation frontend → backend → API → base → validation → sécurité (§11).
2. Modèle des rôles et matrice de permissions
2.1 Rôles de gouvernance (jamais auto-attribués — SEC-03)
Rôle	Palier	Périmètre
SUPER_ADMIN	2	Plateforme entière : tous les paliers 1 + gouvernance, configuration globale, clés, flags, maintenance, nomination
ADMIN	1	Opérations quotidiennes : utilisateurs standards, modération, vérifications, contenus, rapports
COUNTRY_ADMIN	1	Administration d'un pays (périmètre countryCode), données de référence nationales
DATA_STEWARD	1	Qualité des données, référentiels, corrections tracées
MODERATOR	1	Modération (listings, reports, avis)
VERIFIER	1	Revue des vérifications et due diligence
LAB_PARTNER	1	Résultats d'analyses (lab)
API_CLIENT	1	Accès API public avec quotas (api_clients / api_keys)
2.2 Matrice des capacités (extrait structurant — ✅ = autorisé)
Capacité	SUPER_ADMIN	ADMIN	MODERATOR	AUTRES
Tableau de bord global plateforme	✅	✅ (lecture)	✅ (lecture limitée)	❌
Gestion utilisateurs standards (suspendre, réinitialiser, supprimer logique)	✅	✅	❌	❌
Nommer / révoquer ADMIN, COUNTRY_ADMIN, DATA_STEWARD, MODERATOR, VERIFIER, LAB_PARTNER	✅	❌	❌	❌
Nommer / révoquer un SUPER_ADMIN (transfert de couronne, double validation)	✅	❌	❌	❌
Paramètres globaux (sections platform.*)	✅	lecture	❌	❌
Paramètres par module (activations, seuils métier)	✅	✅ (limité)	❌	❌
Clés API externes / intégrations / secrets (lecture masquée, rotation)	✅	❌	❌	❌
Feature flags par zone (zone_feature_flags)	✅	❌	❌	❌
Jobs planifiés (liste, déclenchement, mise en pause)	✅	✅	❌	❌
Supervision services (état dégradé, santé, connectivité)	✅	✅	❌	❌
Journal d'audit (lecture, recherche, export)	✅	✅ (son périmètre)	❌	❌
Export global de données (farms, users, transactions)	✅	limité	❌	❌
Maintenance (purges, verrous, comptes orphelins, résync)	✅	❌	❌	❌
Paramètres de sécurité (politique MFA, verrouillage, expiration sessions)	✅	❌	❌	❌
2.3 Règles de gestion gouvernance
RG-G1 : toute mutation d'un rôle de palier 2 (ADMIN et supérieurs) exige une session MFA vérifiée (mfaEnabled = true sur le profil, second facteur exigé au login — NFR-01).
RG-G2 : un Super Admin ne peut pas se révoquer lui-même s'il est le dernier Super Admin actif (contrainte applicative vérifiée en transaction SQL).
RG-G3 : la nomination d'un Super Admin exige la saisie du mot de passe courant + code MFA (double validation) et écrit un audit admin.superadmin.granted avec la liste avant/après.
RG-G4 : les rôles sont stockés dans memberships.roles (Role[]) ; un utilisateur peut cumuler des rôles via plusieurs adhésions ; les permissions effectives = union.
RG-G5 : toute suppression d'utilisateur par un admin est logique (profiles.status = 'SUSPENDED' ou DELETED), jamais physique, sauf purge de maintenance SUPER_ADMIN (auditée, réversibilité documentée).
3. Périmètre fonctionnel — 8 modules
Convention : U-x = user story, RG-x = règle de gestion, AC-x = critère d'acceptation.

M1 — Tableau de bord centralisé (Super Admin Dashboard)
Objectif : vue consolidée de la santé et de l'activité de la plateforme, calculée en temps réel.

U-M1-1 : en tant que Super Admin, je vois une vue d'ensemble : comptes (total, actifs, suspendus, vérifiés/non vérifiés), organisations (par type, par pays), activité marché (listings actifs, commandes en cours, volumes déclarés), qualité des données (vérifications en attente, alertes ouvertes), technique (services dégradés, jobs en erreur, usage API).

U-M1-2 : je peux filtrer par pays, par période et par module ; chaque indicateur est cliquable et amène à la liste correspondante (drill-down).

U-M1-3 : je peux exporter la vue (CSV/JSON) — export audité.

Règles de gestion

RG-M1-1 : aucun chiffre figé dans le code ; tout indicateur = agrégation SQL/Prisma à la demande (ou cache ≤ 60 s paramétrable).
RG-M1-2 : les indicateurs affichent la date de calcul ; une donnée simulée est explicitement tiquetée (référence data_mode).
RG-M1-3 : les cartes « santé technique » lisent l'état réel des services (degradedServices, config matérielle, fournisseurs externes) — un service en mode console/simulation est affiché comme tel.
RG-M1-4 : permissions : admin.dashboard (lecture) ; l'export exige admin.users (palier 2 pour export global).
AC-M1 : les totaux affichés correspondent à des requêtes SQL vérifiables ; le drill-down ouvre la liste filtrée ; l'export est tracé dans audit_logs.

M2 — Gestion des utilisateurs, administrateurs, rôles et permissions
U-M2-1 : lister/rechercher les utilisateurs (filtres : rôle, statut, pays, vérification e-mail/téléphone, date, MFA) avec pagination.

U-M2-2 : consulter une fiche utilisateur complète : profil, organisation(s), adhésions/rôles, état de vérification, MFA, dernière connexion, tentatives échouées, historique d'actions auditées.

U-M2-3 (palier 2) : attribuer / retirer un rôle de gouvernance à une adhésion ; créer une adhésion manquante ; changer le type d'organisation.

U-M2-4 : actions opérationnelles (palier 1) : suspendre / réactiver, forcer la déconnexion (révocation de session), demander une réinitialisation de mot de passe, déverrouiller après blocage anti brute-force, marquer e-mail/téléphone vérifié (avec motif).

U-M2-5 (palier 2) : suppression logique d'un compte + export des données personnelles de la personne (portabilité) — audité.

U-M2-6 : la liste des rôles disponibles affiche la matrice de permissions effective du rôle (lecture de PERMISSIONS).

Règles

RG-M2-1 : jamais de modification de mot de passe par un admin (seulement forcer une réinitialisation par e-mail) — aucun secret n'apparaît nulle part.
RG-M2-2 : toute mutation écrit audit_logs avec newValue/previousValue.
RG-M2-3 : RG-G1 à RG-G5 s'appliquent.
AC-M2 : parcours complet testé : création d'un compte test → suspension → réactivation → attribution MODERATOR → vérification dans la matrice → révocation ; audit complet visible dans M6.

M3 — Paramétrage global et configuration des modules
U-M3-1 : consulter/modifier les paramètres globaux par sections : platform (nom, pays actifs, langues, maintenance), security (MFA requis pour gouvernance, verrouillage, expiration sessions, politique de mots de passe), modules (activation de chaque module : market, transport, investissement, IoT, satellite, SMS, IA…), limits (quotas API, tailles de fichiers, durées de conservation), integrations (fournisseurs SMS/e-mail/satellite — valeurs masquées).

U-M3-2 : chaque paramètre porte : clé, type, valeur actuelle, valeur par défaut, plage autorisée, description, section, nécessite redémarrage (oui/non).

U-M3-3 : historique des modifications de paramètres (avant → après, acteur, date) ; retour à la valeur par défaut par paramètre.

Règles

RG-M3-1 : stockage dans la table settings (clé/valeur typée) ; validation par schéma Zod par section ; refus hors plage.
RG-M3-2 : les paramètres security.* et integrations.* sont palier 2 (SUPER_ADMIN) ; modules.* et limits.* sont palier 1.
RG-M3-3 : les valeurs de secrets (clés fournisseurs) sont stockées chiffrées, affichées masquées, et ne sont jamais renvoyées par l'API en clair après enregistrement (rotation = saisie d'une nouvelle valeur).
RG-M3-4 : le mode maintenance affiche un bandeau global et refuse les mutations métier (lecture seule) hors admin.
AC-M3 : modification d'un paramètre → validation → écriture en base → lecture par le backend → effet constaté (ex. module désactivé → route renvoie 403 module_disabled) ; historique rempli.

M4 — Activités, opérations, transactions et données de la plateforme
U-M4-1 : supervision des flux métier : organisations (créations, validations), marché (listings, offres, commandes, litiges), investissement (projets, demandes de financement, accès data room), export/import (commandes d'export, documents), traçabilité (lots, événements, rappels), coopératives (adhésions, volumes).

U-M4-2 : chaque flux propose : liste filtrable, fiche détail, actions de modération (approuver, refuser, suspendre) avec motif, et export.

U-M4-3 : vue « transactions » consolidée (commandes + factures + litiges + escalades) avec états et SLA.

Règles

RG-M4-1 : aucune écriture métier directe depuis l'admin sans passer par les services existants (les règles métier — stock, statuts, SLA — restent dans les modules métier).
RG-M4-2 : toute action de modération est audité et notifie l'acteur concerné (via notifications).
AC-M4 : modération d'un élément réel créé en test (listing, vérification) de bout en bout : action → statut changé → notification → audit.

M5 — Supervision et contrôle des modules et services
U-M5-1 : état en temps réel de chaque service externe : SMS (fournisseur, mode réel/console), e-mail, satellite, capteurs (mode simulation/réel), stockage géospatial, MFA (clé dérivée ou clé propre) — repris du rapport de démarrage backend.

U-M5-2 : état des 11 jobs planifiés : dernière exécution, durée, résultat, prochaine échéance, erreurs ; déclenchement manuel ; pause/reprise.

U-M5-3 : santé technique : uptime API, base de données (connexion, latence), stockage, connectivité Supabase, file temps réel (Socket.IO — connexions actives), compteurs d'usage API (resource_usages, api_usage).

U-M5-4 : alertes de supervision (service dégradé > seuil, job en erreur ×N) visibles dans le dashboard et notifiées aux admins.

Règles

RG-M5-1 : l'état affiché est toujours lu en direct (pas de snapshot figé) ; un service en mode dégradé est présenté avec la cause et la marche à suivre (textes issus de degradedServices).
RG-M5-2 : déclencher un job manuellement est audité (admin.job.run) et limité (pas de double exécution simultanée du même job — verrou).
AC-M5 : l'écran reflète exactement le rapport de démarrage du backend ; le déclenchement manuel d'un job (ex. notifications.purge) exécute réellement la tâche et met à jour la dernière exécution.

M6 — Sécurité, accès, journaux d'activité et audits
U-M6-1 : journal d'audit consultable : recherche (acteur, action, ressource, date, gravité), filtres, pagination, détail avant/après, export.

U-M6-2 : vue « sécurité » : connexions récentes et échecs, comptes verrouillés, sessions actives (jetons), état MFA des comptes de gouvernance (alerte si un compte de gouvernance n'a pas la MFA), clés API actives/expirées.

U-M6-3 (palier 2) : politique de sécurité : MFA obligatoire pour la gouvernance, durée de verrouillage, expiration des sessions/refresh, taille minimale des mots de passe.

U-M6-4 : révocation immédiate de sessions (tous jetons d'un utilisateur — auth.admin.signOut + invalidation refresh).

Règles

RG-S1 : à partir de la mise en service de M6, tout compte de gouvernance (SUPER_ADMIN, ADMIN…) doit avoir la MFA active ; l'API refuse les mutations de gouvernance sinon (code mfa_required).
RG-S2 : audit_logs est en insertion seule (aucun endpoint de modification/suppression ; la rétention est une purge de maintenance SUPER_ADMIN, audité elle-même).
RG-S3 : les journaux ne contiennent jamais de secrets ni de mots de passe (règle existante du projet maintenue).
AC-M6 : parcours de test : 3 échecs de connexion → compte verrouillé → visible dans M6 → déverrouillage par admin → audit complet ; refus d'une mutation de gouvernance sans MFA.

M7 — Notifications, paramètres système et configurations avancées
U-M7-1 : notifications système : création d'annonce interne ciblée (par rôle, par pays), modèles de notifications (seuils d'alerte, escalade, SMS/e-mail), historique d'envois, taux de délivrance (via sms_batch_logs, sms_messages).

U-M7-2 : préférences par défaut par rôle ; canaux actifs (push, e-mail, SMS) selon la configuration des intégrations.

U-M7-3 : configurations avancées : feature flags par zone (zone_feature_flags), politiques d'hébergement par pays (countries.complianceProfile, hosting — déjà réservé SUPER_ADMIN), plages agronomiques (validation par expert, ranges.validate), versions de modèles IA (models.promote).

AC-M7 : annonce ciblée reçue par le compte de test concerné ; effet d'un feature flag constaté sur l'écran ciblé.

M8 — Outils d'administration centralisée
M8-1 Gestion des clients API : création/révocation de clés (api_clients, api_keys), quotas, consultation api_usage (existant — à consolider sous l'admin).
M8-2 Exports : exports planifiés ou à la demande (farms, users, market) avec filtres, format CSV/JSON, traçabilité.
M8-3 Maintenance (palier 2) : purge de données expirées (paramétrée), recherche de comptes orphelins (auth sans profil — sync-profile assisté), résolution de doublons, verrou global.
M8-4 Journal des opérations de sync (sync_operations) : état des synchronisations, relance.
4. UX / UI
4.1 Principes communs (Web + Mobile)
Design system du projet : theme/colors (VERT, TERRE, SURFACES…), theme/typography (presets h1–h3, lead, body, bodyMedium…), theme/space (SPACING, RADIUS.pill, LAYOUT.screenPadding) ; pas de Tailwind.
États systématiques : chargement (skeleton), erreur (message + réessayer), vide (état explicite, aucune donnée fictive), permission refusée (écran 403 explicite).
i18n fr/en via useI18nStore ; dates et nombres localisés.
Accessibilité : contrastes, cibles tactiles ≥ 44 px (mobile), libellés d'écran.
4.2 Web (Desktop)
Layout admin : barre latérale (sections M1→M8), en-tête (recherche globale, compte, MFA badge), fil d'Ariane.
Tableaux : tri, filtres, pagination, actions contextuelles (menus), sélection multiple pour les actions groupées (modération).
Responsive : la barre latérale se replie en tiroir sous 1 024 px ; les tableaux deviennent des cartes en mobile web.
Graphiques du dashboard : composants SVG natifs du projet (pas de dépendance lourde) ; chaque graphe a une alternative tabulaire (accessibilité).
4.3 Mobile (React Native / Expo)
Navigation : app/admin/_layout.tsx (Stack) + index.tsx = hub de navigation par section (cartes M1→M8).
Listes : FlatList + filtres en ChipRow (composants existants) ; détails en écrans empilés (admin/users/[id]…).
Actions sensibles : confirmation modale + rappel du motif ; saisie du code MFA dans un écran dédié.
Transitions : composant Reveal (Reanimated) pour l'apparition des sections ; PublicShell non concerné (espace authentifié).
Haptique sur les actions destructives ; Ionicons pour toutes les icônes.
5. Technique — Frontend
5.1 Web — routes et pages (React Router, apps/web)
Route	Page	Module	Permission front
/admin	admin/Dashboard.tsx	M1	admin.dashboard
/admin/users · /admin/users/:id	admin/Users.tsx (+ détail)	M2	admin.users
/admin/roles	admin/Roles.tsx (nouvelle)	M2	palier 2
/admin/settings	admin/Settings.tsx	M3	admin.settings
/admin/operations	`admin/Marketplace	Orders	…` (existant)
/admin/monitoring	admin/Monitoring.tsx (nouvelle consolidation)	M5	admin.jobs
/admin/jobs	section de Monitoring	M5	admin.jobs
/admin/audit	admin/AuditLog.tsx	M6	admin.audit
/admin/security	admin/Security.tsx (nouvelle)	M6	palier 2
/admin/notifications	admin/Messages.tsx + annonces	M7	admin.users
/admin/advanced	`admin/ApiClients	Sync	DataProducts` (existant)
State : @tanstack/react-query (provider déjà en place via main.tsx) — clés ['admin', …] invalidées après mutation.
Appels API : services/endpoints.ts étendu (adminApi.*), gestion centralisée des erreurs (RequestError, codes mfa_required, forbidden…).
5.2 Mobile — écrans (apps/Mobile/src/app/admin/)
Écran	Module	Correspondance web
index.tsx (hub)	tous	sidebar web
dashboard.tsx (nouveau)	M1	Dashboard.tsx
users.tsx + users/[id].tsx (nouveau détail)	M2	Users.tsx
roles.tsx (nouveau)	M2	Roles.tsx
settings.tsx	M3	Settings.tsx
monitoring.tsx + jobs.tsx (nouveau)	M5	Monitoring.tsx
audit.tsx	M6	AuditLog.tsx
security.tsx (nouveau)	M6	Security.tsx
messages.tsx, notifications.tsx (nouveau)	M7	Messages.tsx
api-clients.tsx, sync.tsx, data-products.tsx	M8	pages correspondantes
(écrans métier existants : marketplace, orders, verifications, moderation, countries, rules, prices, devices, crops, plots, farms, farmers, cooperatives, investors, projects, productions, reports, producers, partners, lots, compliance, agronomic-ranges, ai-usage)	M4/M7/M8	maintenus, alignés sur la même API
State : services/api (client fetch du projet) + hooks useQuery/useMutation existants ; cache invalide après mutation.
Tous les écrans respectent theme/typography|space|colors ; aucun style Tailwind.
6. Technique — Backend
6.1 Architecture (pattern existant strictement conservé)
text

backend/src/modules/<module>/
  <module>.routes.js      // validateur Zod + authorize(permission) + asyncHandler
  <module>.controller.js  // format de réponse success/created/…
  <module>.service.js     // logique + Prisma + audit()
  <module>.schema.js      // schémas Zod
Middlewares : authenticate → authorize('permission') → validate(schema) → handler. Les mutations de gouvernance passent par requireSuperAdmin (nouveau, §8) et requireMfa.

6.2 API — inventaire des endpoints (préfixe /api/v1)
M1 — Dashboard

Méthode	Chemin	Permission	Description
GET	/admin/dashboard?country&from&to	admin.dashboard	KPIs consolidés + séries temporelles
GET	/admin/dashboard/export?format=csv	admin.users	Export de la vue (audité)
M2 — Utilisateurs & rôles

Méthode	Chemin	Permission	Description
GET	/admin/users?q&role&status&country&page&limit	admin.users	Liste paginée
GET	/admin/users/:id	admin.users	Fiche complète (profil, rôles, sécu, activité)
PATCH	/admin/users/:id/status	admin.users	Suspendre / réactiver (motif requis)
POST	/admin/users/:id/unlock	admin.users	Déverrouiller (anti brute-force)
POST	/admin/users/:id/force-logout	admin.users	Révoquer les sessions
POST	/admin/users/:id/verify-email · /verify-phone	admin.users	Marquer vérifié (motif, audité)
GET	/admin/roles	admin.users	Rôles + matrice de permissions
POST	/admin/users/:id/roles	palier 2	Attribuer un rôle de gouvernance (MFA requis)
DELETE	/admin/users/:id/roles/:role	palier 2	Révoquer (RG-G2 : dernier super admin protégé)
DELETE	/admin/users/:id	palier 2	Suppression logique (audité)
GET	/admin/users/:id/export	palier 2	Export portabilité (audité)
M3 — Paramètres

Méthode	Chemin	Permission	Description
GET	/admin/settings	admin.settings	Toutes les sections (secrets masqués)
PUT	/admin/settings	admin.settings	Mise à jour validée par section
GET	/admin/settings/history?key	admin.settings	Historique des changements
POST	/admin/settings/:key/reset	palier 2	Retour à la valeur par défaut
M4 — Opérations : réutilise les endpoints métier existants (/market/*, /exports/*, /investors/*, /traceability/*…) avec permissions admin (déjà câblées admin.users / MODERATION) + :
| POST | /admin/operations/:entity/:id/moderate | admin.users | Approuver / refuser / suspendre (motif) |

M5 — Supervision

Méthode	Chemin	Permission	Description
GET	/admin/monitoring/services	admin.jobs	État des services externes (live)
GET	/admin/jobs	admin.jobs	Jobs : état, dernières exécutions
POST	/admin/jobs/:name/run	admin.jobs	Déclenchement manuel (verrou + audit)
POST	/admin/jobs/:name/pause · /resume	palier 2	Pause / reprise
GET	/admin/monitoring/health	admin.jobs	DB, stockage, temps réel, usage API
M6 — Sécurité & audit

Méthode	Chemin	Permission	Description
GET	/admin/audit?action&actor&resource&from&to&page	admin.audit	Recherche avancée
GET	/admin/audit/export	admin.audit	Export (audité)
GET	/admin/security/overview	admin.audit	Connexions, verrous, MFA des gouvernants, sessions
GET	/admin/security/policy	palier 2	Politique de sécurité
PUT	/admin/security/policy	palier 2	Modifier la politique (MFA requis)
M7 — Notifications & avancé

Méthode	Chemin	Permission	Description
POST	/admin/notifications/broadcast	admin.users	Annonce ciblée (rôle/pays)
GET	/admin/notifications/history	admin.users	Historique d'envois + états
GET/PUT	/admin/flags	palier 2	Feature flags par zone
GET/POST/DELETE	/admin/api-clients…	palier 2 (clés)	Clients API (consolidation apiclients)
M8 — Maintenance

Méthode	Chemin	Permission	Description
POST	/admin/maintenance/purge	palier 2	Purge paramétrée (audité)
GET	/admin/maintenance/orphans	palier 2	Comptes auth sans profil
POST	/admin/maintenance/orphans/:id/sync	palier 2	Synchroniser (assiste sync-profile)
6.3 Conventions API
Validation Zod systématique ; erreurs ApiError (codes HTTP + message utilisateur) ; asyncHandler partout.
Pagination : page, limit (max 100), réponse { items, total, page, limit }.
Toute mutation de gouvernance : audit({ action: 'admin.…', resource, resourceId, previousValue, newValue, req }).
7. Base de données
7.1 Tables existantes mobilisées (aucune redéfinition)
profiles · organizations · memberships (roles Role[]) · audit_logs · settings · api_clients · api_keys · api_usage · resource_usages · notifications · notification_preferences · sync_operations · tokens · verifications · zone_feature_flags · countries (complianceProfile, hosting) · iot_devices · sms_messages / sms_batch_logs / sms_consents · idempotency_keys.

7.2 Extensions (1 migration à créer — admin_governance)
Table / objet	But
admin_action_log (vue sur audit_logs — pas de table)	Rien de nouveau si audit_logs suffit → aucune table ajoutée sauf si besoin avéré en développement
settings.history	Journal des changements de paramètres : colonnes previous_value, changed_by ajoutées à une table settings_revisions (insertion seule)
Index	Index complémentaires sur audit_logs(action, created_at), memberships(roles) (GIN) pour les recherches du dashboard
Principe : le minimum de schéma ; les compteurs existants (resource_usages, api_usage) et audit_logs portent l'essentiel. Toute migration ajoutée sera livrée avec son rollback documenté.

8. Sécurité
Contrôle	Implémentation
Authentification	Supabase Auth (JWT) — existant
MFA gouvernance	requireMfa : refuse les mutations palier 2 si profiles.mfaEnabled = false (code mfa_required, HTTP 403)
Garde Super Admin	requireSuperAdmin = authorize + contrôle roles.includes('SUPER_ADMIN') + session MFA vérifiée
Séparation des privilèges	Matrice §2 encodée dans shared/permissions.js (extensions admin.roles, admin.security, admin.flags, admin.maintenance réservés SUPER_ADMIN)
Anti brute-force	Existant (5 échecs → lockedUntil) ; écran M6 de déverrouillage
Journalisation	audit_logs insert-only ; actions de gouvernance avec avant/après ; corrélation requestId
Secrets	Jamais en clair (API les renvoie masqués) ; rotation des clés Supabase/Twilio/SMTP documentée ; MFA_ENCRYPTION_KEY propre obligatoire hors dev
Sessions	Révocation via auth.admin.signOut + refresh invalidés ; expiration paramétrable (security.*)
API	Rate limiting (authLimiter existant étendu aux routes admin), validation Zod, RBAC sur chaque route, isolation tenant (resolveTenant) maintenue
Données personnelles	Export portabilité audité ; suppression logique ; purge = palier 2 + audit
9. Exigences non fonctionnelles
Performance : listes paginées (index utilisés) ; dashboard avec agrégations ciblées et cache court (≤ 60 s) ; aucune requête N+1 (Prisma include maîtrisé).
Disponibilité : l'espace admin dégrade proprement (un service externe en panne n'empêche pas l'accès aux écrans concernés ; message explicite).
Observabilité : logs structurés existants ; chaque action admin tracée ; jobs exposés (M5).
Internationalisation : fr/en ; formats localisés.
Compatibilité : navigateurs modernes (web) ; iOS/Android (Expo SDK du projet).
10. Contrat API — schémas clés (extraits Zod)
JavaScript

// M2 — attribution de rôle (palier 2)
grantRoleSchema = z.object({
  role: z.enum(GOVERNANCE_ROLES),        // ADMIN, MODERATOR, COUNTRY_ADMIN, DATA_STEWARD, VERIFIER, LAB_PARTNER, SUPER_ADMIN
  organizationId: z.string().optional(), // défaut : organisation principale de l'utilisateur
  mfaCode: z.string().trim().min(6).max(14), // RG-G1/G3
  reason: z.string().trim().min(3).max(200),
});

// M3 — mise à jour des paramètres
updateSettingsSchema = z.object({
  section: z.enum(['platform', 'security', 'modules', 'limits', 'integrations']),
  values: z.record(z.string(), z.unknown()),   // validé ensuite par le schéma de la section
  mfaCode: z.string().optional(),              // exigé pour security.* / integrations.*
});

// M5 — déclenchement de job
runJobSchema = z.object({ reason: z.string().trim().min(3).max(200) });

// M7 — annonce ciblée
broadcastSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  targetRoles: z.array(z.string()).optional(),
  targetCountries: z.array(z.string().length(2)).optional(),
  channels: z.array(z.enum(['inapp', 'email', 'sms'])).default(['inapp']),
});
11. Stratégie de tests et définition de « terminé »
Par fonctionnalité, la chaîne complète est vérifiée : écran → requête → route → contrôleur → service → base → réponse → affichage. Une étape non prouvée = fonctionnalité non terminée.
Tests exécutés uniquement (jamais annoncés sans exécution) :
npm test (backend — unitaires et logique) ;
npm run contre-epreuves ;
e2e (B6) séparés des unitaires ;
npx tsc --noEmit (web et mobile) ; npm run build (web).
Écrans non pilotés (pas de navigateur/simulateur dans l'environnement de build) : compile-verified only, explicitement signalé (B6).
Sécurité : chaque endpoint palier 2 est testé en négatif (401 sans jeton, 403 sans permission, mfa_required sans MFA).
Audit final : rapport de conformité point par point contre cette spécification.
12. Roadmap itérative et livraison fichier par fichier
Livraison : code complet dans la conversation, un fichier par chemin exact, précédé de son objectif et suivi de la preuve de vérification. Aucun ZIP.

Itération	Contenu	Fichiers principaux (chemins exacts)	Preuve
I1 — Fondations	Permissions palier 2, gardes requireSuperAdmin/requireMfa, migration settings_revisions	backend/src/shared/permissions.js, backend/src/middleware/authorize.js, backend/prisma/migrations/…_admin_governance/migration.sql	npm test + tsc + test négatif des gardes
I2 — M1 Dashboard	API dashboard + pages web/mobile	backend/src/modules/admin/admin.*.js, apps/web/src/pages/admin/Dashboard.tsx, apps/Mobile/src/app/admin/dashboard.tsx	npm test + tsc + build web
I3 — M2 Users & rôles	API utilisateurs/rôles + écrans	admin.service.js (users), apps/web/src/pages/admin/Users.tsx, Roles.tsx, apps/Mobile/src/app/admin/users.tsx, roles.tsx	chaîne complète de test M2
I4 — M3 Paramètres + M8 jobs/flags	Settings sections + historique + flags	admin.schema.js, admin.service.js, Settings.tsx ×2, api-clients	RG-M3 tests + tsc
I5 — M5 Supervision + M6 Audit/Security	Monitoring consolidé, audit avancé, politique sécu	Monitoring.tsx, jobs.tsx, AuditLog.tsx, Security.tsx ×2	M5/M6 tests négatifs inclus
I6 — M7 Notifications + M4 modération	Broadcast, historique, modération unifiée	notifications admin, messages.tsx ×2, operations	parcours M4/M7
I7 — Audit final	Contre-épreuves, build, rapport de conformité	RAPPORT-CONFORMITE-SUPER-ADMIN.md	contre-epreuves + tous les builds
Chaque itération respecte : analyse des dépendances → développement → tests réels → correction → preuve → livraison des fichiers.

13. Glossaire
Terme	Définition
Palier 1	Capacités opérationnelles (ADMIN et assimilés)
Palier 2	Capacités de gouvernance exclusives SUPER_ADMIN
GOVERNANCE_ROLES	ADMIN, SUPER_ADMIN, MODERATOR, COUNTRY_ADMIN, DATA_STEWARD, VERIFIER, LAB_PARTNER
MFA	Second facteur TOTP (implémentation maison, secrets chiffrés — mfa.service.js)
Audit	Entrée immuable audit_logs (acteur, action, ressource, avant/après)
