# RAPPORT -- PARCOURS D'AUTHENTIFICATION & UX/UI
## AgriConnect Africa -- conformité au cahier des charges UX/UI (sections 1 à 13)

Date : 2026-11-05 - Projet : agrikonnect-africa-final (Windows Git Bash UCRT64)
Périmètre : chaîne inscription -> vérification d'adresse e-mail -> connexion -> atterrissage par rôle
Verdict global : CONFORME -- campagne de tests (section 10 du cahier) exécutée le 2026-11-05, tous résultats réels ci-dessous, aucune anomalie ouverte.

---

## 1. Périmètre et parcours couverts

- Inscription en 7 étapes (type de compte -> informations -> adresse e-mail et mot de passe -> vérification -> configuration -> préférences -> atterrissage), avec séparation web/mobile.
- Connexion, vérification d'adresse e-mail, réinitialisation de mot de passe.
- Atterrissage après inscription : Situation A (profil incomplet) -> assistant de configuration par rôle (écrans existants) puis espace métier ; Situation B -> espace direct. La configuration n'est jamais re-demandée.
- Navigation croisée "Visiter le site public" / "Retour à mon espace", session jamais perdue (stockage web/mobile partagé).
- Complétude du profil par rôle (backend, non bloquant) -- tranche C.
- Tranches livrées : tranche 0 (modules/routing métier) - tranche A (web) - tranche B (mobile) - tranche C (complétude par rôle).

## 2. Fichiers inspectés

Frontend web : App.tsx, contexts/AuthContext.tsx, store/auth.ts, pages/auth/Login.tsx, Register.tsx, VerifyEmail.tsx, components/layout/Header.tsx, lib/modules.js, redirections internes des écrans publics.
Frontend mobile : app/_layout.tsx, app/auth/login.tsx, register.tsx, verify-email.tsx, src/store/auth.ts, components/app/AppHeader.tsx, farmer/FarmerHeader.tsx, public-site/Navbar.tsx, Hero.tsx, CTA.tsx, app.config.js, redirections internes de tous les écrans.
Backend : src/modules/users/users.routes.js, users.controller.js, users.service.js, src/modules/modules.js, tests/e2e/journeys.e2e.test.mjs, tests/e2e/completenessByRole.e2e.test.mjs, tests/e2e/support/harness.mjs, package.json (scripts de test), .env (lecture seule).
Grilles de tests : apps/web/scripts/redirects.test.mjs, apps/Mobile/scripts/redirects.test.mjs.

## 3. Problèmes identifiés

1. Redirections post-authentification disperses et incohérentes selon les écrans (souvent vers le site public ou une page générique), sans règle commune par rôle -- contraire à la section 2 du cahier.
2. Absence des libellés "Visiter le site public" / "Retour à mon espace" (section 3).
3. Atterrissage après vérification d'adresse e-mail non garanti (parfois retour à la page de vérification elle-même).
4. Identifiants de redirection codés en dur dans certains écrans (priorité donnée à un identifiant plutôt qu'au rôle réel -- section 9).
5. Complétude du profil : mêmes critères pour tous les rôles (critères de fermier demandés à un investisseur) -- section 4.
6. Variantes de code machine par rapport au miroir de référence (Register avec 9 types de compte, Header avec menu mobile, Navbar étendue) : traitées par coutures chirurgicales, jamais par reconstruction.
7. Mobile, rôle TRANSPORTER : aucun espace métier dédié (absence constatée, signalée à l'utilisateur AVANT toute modification ; décision validée : écran /profil avec retours contextuels).
Aucune fuite de rôle côté client n'a été trouvée (le rôle est lu depuis l'API GET /me / Supabase).

## 4. Fichiers modifiés (empreintes md5 finales)

Web :
- apps/web/src/lib/redirects.ts (module central) -- 784c44abf0d401f58e4a4959b7afc3ce
- apps/web/scripts/redirects.test.mjs (grille 29) -- 3df097a799a216af6b5e400bbce492ce
- apps/web/src/pages/auth/Login.tsx -- d0ec598dd4f10d360ca3b4645528a446
- apps/web/src/pages/auth/Register.tsx -- 0f90b916fa2d95bc48ba6f7b45f497d1
- apps/web/src/pages/auth/VerifyEmail.tsx -- 89180d05981c444ae78e7330b1a0de45
- apps/web/src/components/layout/Header.tsx -- 28577ee1d7e43cbe9b1bb477e66ed16c

Mobile :
- apps/Mobile/src/lib/redirects.ts -- ef65d6486fea6cfbd2f508b471802e70
- apps/Mobile/scripts/redirects.test.mjs -- 8a974f5692255ecff6dab52ecb4d3cd8
- apps/Mobile/src/app/auth/login.tsx -- 63f48bd1af211a1d94d18d9ec71b8543
- apps/Mobile/src/app/auth/register.tsx -- f1c25b7d923372c40f1f40338c94e351
- apps/Mobile/src/app/auth/verify-email.tsx -- 30fcc2f0efc84f527b62507f5fa2b256
- apps/Mobile/src/components/app/AppHeader.tsx -- 26a53f0f32e6fe79675332e701fe7a26
- apps/Mobile/src/components/farmer/FarmerHeader.tsx -- b802b810a45ac9b1f876b5e8f9a45f01
- apps/Mobile/src/components/public-site/Navbar.tsx -- 99fe2c30c23b9393c65d5b31db676b8c

Backend :
- backend/src/modules/users/users.service.js -- 99810ffcf95376800b22dd7f192f6959
- backend/package.json -- 78a5b923b59371c99bc4123c2644048d
- backend/tests/e2e/completenessByRole.e2e.test.mjs (nouveau) -- ca57d1a8d9cf2b632ead5cc728cb8a43

Méthode : coutures chirurgicales auto-applicatives (scripts de déploiement versionnés fix-trancheA1 ... fix-trancheC1V2, verrou md5 interne + ancres uniques), code utilisateur existant jamais remplacé, fichier .env figé et base de données inchangés.

## 5. Tables de redirections

### 5.1 Web -- getUserInitialRoute (apps/web/src/lib/redirects.ts)

| Rôle | Destination |
|---|---|
| SUPER_ADMIN | /admin/dashboard |
| ADMIN | /admin/dashboard |
| MODERATOR | /admin/dashboard (permission admin.dashboard requise, sinon écran sûr) |
| FARMER | /farmer |
| COOPERATIVE_ADMIN | /organization |
| COOPERATIVE_MEMBER | /organization |
| AGRICULTURAL_COMPANY | /organization |
| BUYER | /market/app |
| SUPPLIER | /market/app |
| TRANSPORTER | /app/transport |
| AGRONOMIST | /reviewer/missions |
| LAB_PARTNER | /reviewer/missions |
| INVESTOR | /investment |
| SUPPORT_AGENT | /app/agent |
| API_CLIENT | /developers |
| PUBLIC_USER | /app |

Règles communes : compte suspendu ou sans rôle -> écran sûr ; adresse e-mail non vérifiée -> /app/verification ; multi-rôles -> priorité ROLE_PRIORITY ; contexte multi-organisations -> activeOrganizationId (paramètre ou stockage local agrikonnect.activeOrganizationId) ; rôle identifié mais identité incomplète (Situation A) -> configuration : FARMER -> /farmer/profile, rôles d'organisation -> /organization/profile, INVESTOR -> /investment/profile, défaut -> /app/profile.
Écrans sûrs : /app/profile (profil) - /app/verification (attente de vérification). Entrées : connexion -> /auth/login, inscription -> /auth/register.

### 5.2 Mobile (table validée avec l'utilisateur le 2026-11-05)

| Rôle | Destination |
|---|---|
| SUPER_ADMIN / ADMIN / MODERATOR | /admin/dashboard (MODERATOR : permission admin.dashboard requise) |
| FARMER | /farmer |
| COOPERATIVE_ADMIN / COOPERATIVE_MEMBER / AGRICULTURAL_COMPANY | /organization |
| BUYER / SUPPLIER | /marketplace |
| TRANSPORTER | /profil (aucun espace mobile dédié -- voir section 10) |
| AGRONOMIST / LAB_PARTNER | /reviewer/missions |
| INVESTOR | /investment |
| SUPPORT_AGENT | /agent/consent |
| API_CLIENT | /developers |
| PUBLIC_USER | /notifications |

Écrans sûrs : /profil. Configuration : /farmer/profile, /organization/profile, /investment/profile, défaut /profil. Connexion -> /auth/login. Le paramètre "next" explicite reste respecté.

## 6. Espaces réutilisés (aucun espace créé)

Aucun écran ni tableau de bord créé. Correspondance rôle -> écran existant : admin/dashboard (AdminDashboard, routes /admin/* protégées RBAC) - farmer (Home farmer, /farmer) - organization (Dashboard organisation, /organization) - market (MarketApp, /market/app web -- /marketplace mobile) - transport (TransportApp, /app/transport web ; mobile -> /profil) - reviewer (ReviewerMissions, /reviewer/missions) - investment (InvestmentDashboard, /investment) - agent (AgentDashboard, /app/agent web ; mobile -> /agent/consent) - developers (/developers) - public (Accueil web /app ; mobile /notifications pour PUBLIC_USER).
Assistant de configuration (Situation A) : réutilisation des écrans de configuration existants (étapes 5 et 6 de l'inscription) présentés dans l'ordre par rôle.

## 7. Interfaces ajoutées

- Libellé "Visiter le site public" : web Header (barre de navigation bureau + menu mobile, lien contextuel vers la racine publique) ; mobile AppHeader et FarmerHeader (icône globe -> ouverture de l'accueil public). Navigation seule : aucune fermeture de session, ni sur web ni sur mobile.
- Libellé "Retour à mon espace" : web Header (même lien, libellé contextuel, destination = route initiale de l'utilisateur) ; mobile Navbar (barre + menu mobile).
- Comportement : session et contexte (organisation active) préservés ; le retour depuis le public réutilise la même destination que getUserInitialRoute.
- Les liens publics existants "Visiter le site public" (CTA, pied de page) et "Retour à mon espace" ont été conservés.

## 8. Sécurité

- Rôle lu depuis la source fiable : GET /me -> user.organizations[].roles (côté serveur, Supabase/JWT) ; aucune saisie ni préférence client ne définit le rôle.
- Compte suspendu ou sans rôle : écran sûr (/app/profile web, /profil mobile), aucune redirection vers un espace métier.
- Vérification d'adresse e-mail obligatoire avant l'atterrissage métier ; e-mails distincts pour la confirmation d'inscription et la connexion.
- RBAC préservé : aucune élévation (MODERATOR sans permission admin.dashboard -> écran sûr) ; aucune route existante déplacée, aucune permission modifiée.
- Réinitialisation de mot de passe vérifiée : soumission sans jeton -> 400, avec jeton valide -> 200 (validation par zod).
- Secrets : clé de service saisie de façon masquée (jamais dans le chat), fichier .env inchangé ; rotation d'identifiants planifiée en fin de configuration (checklist en une fois).

## 9. Tests exécutés et résultats réels (campagne du 2026-11-05)

| Vérification | Résultat |
|---|---|
| Grille de redirections web (apps/web/scripts/redirects.test.mjs) | 29/29 -- échecs 0 |
| Grille de redirections mobile (apps/Mobile/scripts/redirects.test.mjs) | 29/29 -- échecs 0 |
| Suite backend complète (npm test) | 1358/1358 -- échecs 0 |
| dont complétude par rôle (tests/e2e/completenessByRole.e2e.test.mjs) | 4/4 |
| Parcours de session e2e (journeys.e2e.test.mjs : connexion, persistance, déconnexion) | 17/17 -- échecs 0 |
| Vérification de types web (tsc) | 0 erreur |
| Vérification de types mobile (tsc) | 0 erreur |
| Build web (vite build) | OK -- 6,79 s |
| Invariants de parcours (21 contrôles : câblages getUserInitialRoute, zéro redirection interdite, libellés, écrans sûrs) | 21/21 OK |

Couverture : les 10 redirections de rôles (tables section 5), la persistance de session (connexion -> actualisation -> déconnexion, test e2e), le parcours post-vérification d'adresse e-mail, l'absence de redirection vers le site public, les permissions (MODERATOR), le multi-organisations (priorité de rôle + contexte actif) et les cas de sécurité (suspendu, sans rôle).
Vérification manuelle à l'écran (section 10 du cahier) : à réaliser par l'utilisateur avec des comptes réels -- voir section 10.

## 10. Restes et recommandations

1. Vérification manuelle à l'écran : les 10 redirections de rôles avec un compte réel par rôle, plus les Situations A (profil incomplet -> assistant de configuration) et B (atterrissage direct) ; les tests automatisés couvrent la logique, pas le rendu.
2. Rôle TRANSPORTER sur mobile : aucun espace dédié -- décision actée : /profil avec retours contextuels. Si un espace transport mobile est créé plus tard, une seule constante à changer dans apps/Mobile/src/lib/redirects.ts (verrouillée par la grille de 29 tests).
3. Rôles "à venir" (section 7 du cahier) : ajouter une ligne dans la table du module de redirections et un cas dans la grille de tests, sans autre modification.
4. Rotation finale des identifiants (clé de service, comptes de test) : checklist à exécuter en une fois à la fin de toutes les configurations, comme convenu.
5. Complétude du profil : critères par rôle appliqués et non bloquants ; en cas d'évolution des règles métier, mettre à jour la liste des rôles producteurs dans backend/src/modules/users/users.service.js et le test e2e dédié.
6. Les divergences de variante machine (Header avec menu mobile = 2 occurrences de libellés, Register avec 9 types de compte) sont normales : les empreintes de la section 4 sont celles de la machine.

Historique : blocs de livraison numérotés un par message, verrou md5 à la copie, scripts auto-applicatifs à ancres uniques, tests jamais déclarés sans exécution ; sorties de terminal complètes conservées dans le fil de travail.
