# Plan de correction — Application mobile AGRIKONNECT AFRICA

**Source :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md), anomalies MOB-C01 à MOB-I07.

**Statut : PROPOSITION.** Aucune correction n'a été réalisée. Le plan ne s'exécute qu'après validation explicite du rapport et du présent document.

Principes d'exécution :
- une branche par phase, et des commits atomiques par anomalie (identifiant MOB-xxx dans le message) ;
- chaque correction est livrée avec son test de validation ;
- aucune modification du backend dans ce plan. Les besoins backend sont listés en §6 comme **prérequis** à arbitrer séparément ;
- ordre imposé : **filets de sécurité → session → navigation → fonctions métier → natif → i18n → qualité.**

---

## Phase 0 — URGENTE (bloquant toute recette), estimée à 5–7 jours

| # | Anomalie | Cause technique | Fichiers | Correction | Dépendances | Risques | Tests |
|---|---|---|---|---|---|---|---|
| 0.1 | MOB-M17 (socle) | Aucun outil de test unitaire ni lint | `package.json`, nouveaux `jest.config.js`, `.eslintrc` | Installer `jest-expo`, `@testing-library/react-native` et `eslint-config-expo`. Ajouter les scripts `test` et `lint` | aucune | Faible (dev seulement) | `npm test` exécute au moins un test |
| 0.2 | **MOB-C01** | `replay()` renvoie l'enveloppe au lieu d'une `AxiosResponse` | `services/api/http.ts:93-122` | `return http.request(config)` (l'intercepteur de requête réinjecte le jeton) et supprimer `replay` | 0.1 | Boucle de 401 : se prémunir avec le drapeau `_retried` (déjà présent) | Test unitaire avec un adaptateur simulé (401 puis 200) : données identiques au cas nominal. Test de démarrage avec jeton expiré : `permissions` non vide |
| 0.3 | **MOB-E10** | `refresh()` purge la session sur toute exception | `services/api/session.ts:79-95`, `http.ts:113-118` | Distinguer `RequestError.status === 0` (réseau, on conserve les jetons) de 400/401 (on purge). Propager une erreur réseau | 0.2 | Jeton révoqué conservé trop longtemps : la purge reste faite sur un 401 du refresh | Mode avion pendant le refresh : session conservée. Refresh révoqué : déconnexion |
| 0.4 | **MOB-E09** | `logout` et session perdue sans purge du cache | `store/auth.ts:55-58,145-154` | `queryClient.clear()`, `realtime.disconnect()`, `setActiveOrganizationId(null)` | 0.2 | Import circulaire store → query : passer par une fonction de rappel enregistrée dans `_layout` | Utilisateur A puis B : aucune donnée de A |
| 0.5 | **MOB-E11** | URL par défaut `localhost`, pas de profils de build, ATS permissif | `lib/config.ts:13-27`, `app.json:56-59`, nouveaux `app.config.ts` et `eas.json` | Profils `development`, `preview` et `production`. Échec explicite si `EXPO_PUBLIC_API_BASE_URL` est absente hors développement. HTTPS exigé en production. `ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads=false` | aucune | Casser le développement local : conserver l'exception localhost en profil `development` seulement | Build preview sans variable : écran d'erreur de configuration. Build avec HTTPS : appels OK sur A et I |
| 0.6 | **MOB-E03** | La barre d'onglets personnalisée itère sur toutes les routes | `app/farmer/_layout.tsx`, `components/farmer/FarmerTabBar.tsx:26-82` | Restructurer en `farmer/_layout.tsx` (Stack) + `farmer/(tabs)/_layout.tsx` (5 onglets) **ou** filtrer `state.routes` sur une liste blanche. Clés `farms/index` et `plots/index` | 0.1 | Déplacement de fichiers : les URL restent identiques avec un groupe `(tabs)` | Test de rendu : 5 onglets exactement. `/farmer/alerts` n'ajoute pas d'onglet |
| 0.7 | **MOB-E12** | Écran Paramètres et boutons sans action | `farmer/settings.tsx:27-61`, `farmer/farms/[id].tsx:55`, `farmer/lots/[id].tsx:47-48` | Paramètres : brancher `notificationApi` (préférences) et `authApi.mfaStatus` avec un lien vers `/auth/mfa`, retirer le bouton « Enregistrer » sans effet. Boutons : naviguer vers `/farmer/plots?farmId=`, fiche publique du lot, QR | aucune | Faible | Chaque interrupteur reflète l'état serveur après relance. Aucun `onPress={() => {}}` dans le code |
| 0.8 | **MOB-E13** (UI) | Rôles AGRONOMIST et SUPPORT_AGENT en inscription libre | `lib/platform.ts:136-146` | Retirer ces deux rôles de `SELF_SERVICE_ROLES` | §6 B1 (backend) pour l'effet complet | Comptes déjà créés : à traiter côté backend | L'inscription ne liste plus ces rôles |

**Critère de sortie de la phase 0 :**
- session stable plus de 30 minutes avec passage en arrière-plan ;
- 5 onglets producteur ;
- un build preview HTTPS fonctionnel sur Android et iOS ;
- tests 0.2 à 0.4 au vert.

---

## Phase 1 — PRIORITAIRE (fonctions cœur et navigation), estimée à 12–16 jours

| # | Anomalie | Cause | Fichiers | Correction | Dépendances | Risques | Tests |
|---|---|---|---|---|---|---|---|
| 1.1 | **MOB-E05** | Gardes limitées à l'authentification | nouveaux `components/auth/RoleGate.tsx` et `PermissionGate.tsx`, layouts d'espace | Garde par espace à partir de `getRoles` et `can()`, redirection vers `getUserInitialRoute`. Le bouton « Espace producteur » de `profil.tsx:240-246` devient « Mon espace » | 0.2 (permissions fiables) | Bloquer à tort un rôle multiple : tester toutes les combinaisons de la matrice | Matrice de 16 rôles × espaces : accès autorisé ou redirection, sans appel 403 |
| 1.2 | **MOB-E04** | Pas de layout ni de menu par espace | `app/admin/_layout.tsx`, `organization/_layout.tsx`, `investment/_layout.tsx`, `reviewer/_layout.tsx`, etc. | Drawer ou onglets + Stack par espace, alimentés par une table de navigation par rôle (équivalent de `space-nav`). Menu d'administration complet | 1.1 | Changement de structure de navigation : recette complète | Script de liens : 0 route orpheline hors pages d'erreur. Parcours manuel par rôle |
| 1.3 | **MOB-E06** | Destination et file réservées aux ADMIN | `lib/redirects.ts:65-102`, `reviewer/missions.tsx:31-33`, `agent/index.tsx:41-43` | Destination AGRONOMIST/LAB_PARTNER vers un écran utilisant des routes accessibles (`aiApi.list` avec statut ESCALATED si la permission `ai.review` le permet). Ajouter VERIFIER, COUNTRY_ADMIN, DATA_STEWARD à `ROLE_PRIORITY`. Mettre à jour `redirects.test.mjs` | 1.1, §6 B2 | Divergence avec le web : appliquer la même table aux deux | Connexion de chaque rôle : 0 réponse 403 à l'atterrissage |
| 1.4 | **MOB-E01** | Géométrie absente, ID saisi | `farmer/plots/create.tsx` | Sélecteur d'exploitation (`farmApi.list`). Géométrie Point (saisie lat/lng validée, puis GPS en 2.1). Validation : nom ≥ 2, surface ≥ 0 | 2.1 pour le GPS (la saisie manuelle suffit pour débloquer) | Coordonnées fausses : bornes −90..90 / −180..180, contrôle du pays | 201 avec Point. 422 affiché par champ en cas de géométrie invalide |
| 1.5 | **MOB-E07** | Écrans publics sur des routes authentifiées | `app/public-site/*`, `app/{annonces,marches,tenders,projets,prices,weather,insights}*`, `components/public-site/Navbar.tsx:35-41` | Pour un visiteur : afficher une invitation à se connecter (sans appel) sur ces rubriques, ou les retirer du menu public. Ne plus présenter les commandes privées sous `public-site/ventes` | §6 B3 si des routes publiques sont voulues | Perte de contenu public : décision produit à prendre | Sans session : 0 appel 401 sur tout le menu public |
| 1.6 | **MOB-M08** | Liens vers des routes inexistantes | `international/tenders.tsx:34`, `marketplace/index.tsx:74,117`, `public-site/index.tsx:19`, `home/HeroCarousel.tsx:97` | Corriger les cibles et créer `/tenders/[id]` si nécessaire. Activer les routes typées d'Expo Router (`experiments.typedRoutes`) pour que `tsc` détecte les liens | aucune | Faible | Script de liens : 0 lien cassé. `tsc` au vert avec les routes typées |
| 1.7 | **MOB-M09** | `next` construit avec `useSegments` ; redirections concurrentes | `app/_layout.tsx:93-134`, `auth/login.tsx:40-54`, `auth/register.tsx:26-32` | `usePathname()` + paramètres de recherche. Une seule redirection post-connexion, dans `SessionGate`. Liste blanche de `next` (chemin interne commençant par `/`, sans schéma) | 1.1 | Boucle de redirection : tests | Lien profond protégé et dynamique, puis connexion : écran cible exact |
| 1.8 | **MOB-M20** | Réinitialisation et MFA inaccessibles | `auth/forgot-password.tsx`, `auth/reset-password.tsx:13-36`, `profil.tsx:203-215` | Lire `token` dans `useLocalSearchParams`, lien depuis « mot de passe oublié » et bouton « Configurer la 2FA » dans le profil | §6 B4 (lien e-mail vers `agrikonnect://`) | Faible | Ouverture du lien e-mail : formulaire prérempli. Activation de la 2FA de bout en bout |
| 1.9 | **MOB-M01** | Jeton de socket figé | `services/realtime.ts:57-75` | `auth` sous forme de fonction, `connect_error` puis refresh et reconnexion, écouteur AppState | 0.2 | Tempête de reconnexions : backoff existant | Socket après expiration du jeton : événements reçus |
| 1.10 | **MOB-M02** (partie 1) | Pas de focus ni d'état réseau | `services/query.ts`, `_layout.tsx` | `focusManager` sur AppState, `onlineManager` sur NetInfo, `OfflineNotice` global | ajout de `@react-native-community/netinfo` | Faible | Avion activé puis désactivé : bandeau, puis rafraîchissement |
| 1.11 | **MOB-M18** | Contexte d'organisation dans `localStorage` | `lib/redirects.ts:121-137`, `http.ts:61-64` | Store Zustand persistant (SecureStore), sélecteur d'organisation visible, purge à la déconnexion (0.4) | 0.4 | Décalage avec le backend sur la règle par défaut | Changement d'organisation : en-tête `X-Organization-Id` envoyé, données filtrées |

---

## Phase 2 — IMPORTANTE (natif, formulaires, i18n), estimée à 22–30 jours

| # | Anomalie | Correction | Fichiers | Dépendances | Risques | Tests |
|---|---|---|---|---|---|---|
| 2.1 | **MOB-E02** (géolocalisation) | `expo-location` avec demande « pendant l'utilisation » au moment du besoin. Gestion du refus (saisie manuelle) et du service coupé. Précision affichée. Polygone par marche autour de la parcelle (optionnel) | `farmer/plots/create.tsx`, `farmer/farms/create.tsx`, hook `useCurrentPosition` | 1.4 | Batterie : pas de suivi continu ni d'arrière-plan | Autorisé, refusé, GPS désactivé, sur A et I |
| 2.2 | **MOB-E02** (photos et fichiers) | `expo-image-picker` (caméra et galerie), compression, téléversement en deux temps `mediaApi.uploadUrl` → PUT → `mediaApi.confirm` | parcelles, lots, vérifications, documents d'export | 0.5 (HTTPS) | Taille et réseau lent : compression et reprise | Photo de 10 Mo en 3G : envoi abouti ou erreur explicite |
| 2.3 | **MOB-E02** (QR) | Scan de QR de lot (`expo-camera`) vers `/public-site/lot/[code]` | `public-site/lot.tsx` | 2.2 | Faible | Scan d'un QR valide ou invalide |
| 2.4 | **MOB-E02 / M21** (push) | `expo-notifications` : jeton, enregistrement de l'appareil, réception au premier plan et en arrière-plan, ouverture d'un lien profond | `_layout.tsx`, préférences | §6 B5 (envoi backend) | Permissions Android 13+ (`POST_NOTIFICATIONS`) | Notification reçue application fermée, tap ouvrant l'écran cible |
| 2.5 | **MOB-M13** | Ne déclarer que les permissions réellement utilisées. `android.blockedPermissions` pour SYSTEM_ALERT_WINDOW et READ/WRITE_EXTERNAL_STORAGE | `app.json` / `app.config.ts` | 2.1 à 2.4 | Faible | Introspection : liste des permissions identique à l'usage |
| 2.6 | **MOB-M02** (partie 2) | Hors-ligne : persistance du cache (`persistQueryClient` + stockage), file de mutations avec ULID (`lib/ulid.ts` existe) rejouée via `/sync` | `services/query.ts`, `services/sync/*` | 1.10, §6 B6 | Conflits : écran `farmer/sync/conflicts` existant | Saisie de production hors ligne, retour réseau : synchronisée, conflit affiché |
| 2.7 | **MOB-E08** | i18n : extraire les environ 2 800 textes par espace (public → auth → producteur → marché → autres), `t()` partout, locale active envoyée à l'inscription, formats via `lib/format` uniquement | tous les écrans | 0.1 (test de clés) | Volume important : découper par espace | Basculer en anglais : 0 texte français visible (contrôle manuel et script) |
| 2.8 | **MOB-M05** | Sélecteurs de culture et de devise, omission des champs vides, pays par défaut issu du profil | 4 formulaires marché | 1.4 | Faible | Annonce sans prix : champ absent côté serveur |
| 2.9 | **MOB-M06** | Validation synchrone dans `submit` (ou zod côté client, déjà en dépendance) | `auth/register.tsx` | aucune | Faible | Premier envoi invalide : aucune requête |
| 2.10 | **MOB-M07** | Composant `ConfirmDialog` pour les révocations, annulations et suppressions | `developers/index.tsx`, `sensors.tsx`, `marketplace/[id].tsx`, admin | aucune | Faible | « Annuler » n'émet aucun appel |
| 2.11 | **MOB-M03** | Gestion du clavier dans `Screen` + `keyboardShouldPersistTaps` | `components/ui/Screen.tsx` | aucune | Effets de bord de mise en page : recette sur 3 tailles d'écran | Dernier champ visible sur iPhone SE et sur Android 5,5" |
| 2.12 | **MOB-M04** | `FlatList` sur les listes de plus de 20 éléments, `Screen scroll={false}`, `Reveal` limité aux 8 premiers éléments | écrans de liste | aucune | Régression visuelle | Profilage : JS > 55 images/s sur un appareil d'entrée de gamme |
| 2.13 | **MOB-M19** | Messagerie : liste inversée paginée, heure, composer au-dessus du clavier, `realtime.setTyping` | `messages/[conversationId].tsx` | 1.9, 2.11 | Faible | 120 messages, saisie visible |
| 2.14 | **MOB-M10** | Téléchargement authentifié (`expo-file-system` + `expo-sharing`) | `admin/reports.tsx`, `precision-report.tsx` | 0.5 | Faible | Export ouvert dans l'application de partage |
| 2.15 | **MOB-M11** | Retirer les jauges constantes ou les calculer. Libellé de période dynamique | 6 fichiers | aucune | Faible | Aucune constante `progressPct` littérale |
| 2.16 | **MOB-M12** | Accessibilité : `accessibilityLabel` par défaut dans `Input`, libellés des `IconButton` et `PressableScale`, cibles de 48 pt, jetons AA (`livingGreen` en texte → VERT[700], bordure de champ ≥ 3:1) | `components/ui/*`, `theme/*` | aucune | Changement visuel léger | Audit TalkBack/VoiceOver. Contrastes ≥ 4,5:1 (texte) et ≥ 3:1 (composants) |

---

## Phase 3 — AMÉLIORATIONS, estimée à 8–12 jours

| # | Anomalie | Correction |
|---|---|---|
| 3.1 | MOB-M15 | `expo install --fix`, mise à jour d'axios (follow-redirects), retrait de `zod` (sauf si utilisé en 2.9), `expo-blur`, `expo-linking` et `space-grotesk`. `npm audit` sans vulnérabilité élevée |
| 3.2 | MOB-M16 | Polices par graisse, icônes Ionicons uniquement, images WebP ≤ 200 Ko |
| 3.3 | MOB-M14 | Fusionner l'arbre public (un seul jeu de routes) |
| 3.4 | MOB-M17 | Tests E2E (Maestro) sur les parcours : connexion, création d'exploitation et de parcelle, annonce, messagerie, déconnexion. Exécution en CI |
| 3.5 | MOB-F01 | Supprimer `fiche.md`, les `*.bak`, `ServicesSection.tsx` et `theme/index.ts` (après vérification) |
| 3.6 | MOB-F02 | Décider du support iPad (désactivation ou mise en page adaptée) |
| 3.7 | MOB-F03, F10 | Pays, devise et locale par défaut issus du profil |
| 3.8 | MOB-F05 | Tests `Intl` sous Hermes, repli |
| 3.9 | MOB-F06 | Profil minimal en SecureStore, purge au premier lancement après réinstallation (iOS) |
| 3.10 | MOB-F08 | Suivi des plantages (Sentry ou équivalent), sans données personnelles |
| 3.11 | MOB-F09 | Menu de débordement dans `AppHeader` |
| 3.12 | MOB-F11 | README aligné sur l'état réel |
| 3.13 | MOB-F12 | Étude d'un épinglage de certificat selon le modèle de menace |

---

## 4. Ordre logique et graphe de dépendances

```
0.1 tests ─┬─> 0.2 rejeu ─┬─> 0.3 réseau/refresh
           │              ├─> 0.4 purge ──> 1.11 contexte org
           │              ├─> 1.1 gardes ──> 1.2 menus ──> 1.3 vérificateur
           │              │                └─> 1.7 next
           │              └─> 1.9 socket
           └─> 0.6 onglets
0.5 config/HTTPS ──> 2.2 médias ──> 2.3 QR
1.4 parcelle (saisie) ──> 2.1 GPS ──> 2.5 permissions
1.10 réseau ──> 2.6 hors-ligne
2.11 clavier ──> 2.13 messagerie
```

## 5. Estimation globale

| Phase | Charge (j·h) |
|---|---:|
| 0 — Urgente | 5–7 |
| 1 — Prioritaire | 12–16 |
| 2 — Importante | 22–30 |
| 3 — Améliorations | 8–12 |
| **Total** | **47–65** |

Hypothèses de l'estimation : un développeur React Native senior ; backend disponible ; prérequis §6 traités en parallèle.

## 6. Prérequis backend (hors périmètre, à arbitrer séparément)

| ID | Besoin | Lié à |
|---|---|---|
| B1 | Retirer AGRONOMIST et SUPPORT_AGENT de `SELF_SERVICE_ACCOUNT_TYPES` (`auth.schema.js:21-30`) ou soumettre ces rôles à validation | MOB-E13 |
| B2 | File de vérification accessible aux experts (permission dédiée ou filtrage par rôle) | MOB-E06 |
| B3 | Routes publiques en lecture (annonces publiées, prix agrégés, appels d'offres publics) si le site public doit les montrer | MOB-E07 |
| B4 | Liens d'e-mail de réinitialisation et de vérification compatibles avec le schéma mobile, ou liens universels / App Links | MOB-M20 |
| B5 | Service d'envoi push (Expo Push, FCM ou APNs) et table des jetons d'appareil | MOB-E02, M21 |
| B6 | Contrat `/sync/push` documenté pour la file hors ligne | MOB-M02 |
| B7 | Export d'administration et PDF de précision via URL signée de courte durée | MOB-M10 |

## 7. Critères de clôture

- [ ] 0 anomalie CRITIQUE ou ÉLEVÉE ouverte.
- [ ] `tsc`, `lint` et les tests unitaires au vert en CI. E2E au vert sur Android et iOS.
- [ ] Script de liens : 0 lien cassé et 0 route orpheline non justifiée.
- [ ] Introspection native : permissions = usage, ATS strict, HTTPS.
- [ ] Bascule en anglais : 0 texte français résiduel sur les parcours principaux.
- [ ] Recette sur appareils : un Android d'entrée de gamme (≤ 3 Go de RAM), un iPhone avec encoche, et une tablette si prise en charge.
- [ ] Mise à jour du README et du rapport (statut de chaque MOB-xxx).
