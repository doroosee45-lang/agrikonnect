# AUDIT COMPLET : PROFILE ET SETTINGS — APPLICATION REACT NATIVE

**Date d'audit :** 18 novembre 2026  
**Statut :** Rapport d'audit initial — AUCUNE MODIFICATION  
**Objectif :** Inventorier l'existant, identifier les lacunes, proposer une organisation cohérente

---

## TABLE DES MATIÈRES

1. [RÉSUMÉ EXÉCUTIF](#résumé-exécutif)
2. [ARCHITECTURE ACTUELLE](#architecture-actuelle)
3. [INVENTAIRE DÉTAILLÉ](#inventaire-détaillé)
4. [ANALYSE COMPARATIVE](#analyse-comparative)
5. [CONFUSIONS ET DOUBLONS IDENTIFIÉS](#confusions-et-doublons-identifiés)
6. [PROPOSITIONS D'ARCHITECTURE](#propositions-darchitecture)
7. [PLAN D'INTERVENTION](#plan-dintervention)

---

## RÉSUMÉ EXÉCUTIF

### État actuel

L'application React Native expose deux entités d'accès utilisateur distinctes :

- **PROFILE** : Pages `/farmer/profile`, `/organization/profile`, `/investment/profile`
- **SETTINGS** : Page `/farmer/settings` uniquement

### Observations clés

1. **PROFILE et SETTINGS partagent le même conteneur visuel** : même composant `FarmerHeader` / `AppHeader`, même style d'UI
2. **PROFILE est TRÈS RÉDUIT** : seul le prénom et nom sont éditables (`.updateMe()`)
3. **Les données professionnelles manquent** : aucune édition du poste, département, expertise, fonction
4. **SETTINGS ne sauvegarde rien** : les toggles (notifications, MFA, langue) ne persist pas — bouton "Enregistrer" appelé avec `onPress={() => {}}`
5. **Routes de navigation confuses** : `/profil` = page publique ; `/farmer/profile`, `/farmer/settings` = pages métier
6. **Données complètes existantes dans `/profil`** : identité, organisations, permissions, sécurité — mais NON éditables

### Dysfonctionnements confirmés

- **Notifications** : non implémentées (fichiers `/farmer/settings.tsx` ligne 27-29 — toggles `useState` mais pas de mutation)
- **Langue** : sauvegardée dans le store i18n, NON envoyée au serveur (`/me` PATCH ne contient pas `locale`)
- **MFA** : affichée en lecture seule sur `/profil`, configuration sur `/auth/mfa/*`, but no link in settings
- **Mot de passe** : route `/me/password` existe mais aucun formulaire mobile
- **Photo de profil** : aucun téléchargement
- **Profil public** : `/farmer/public-profile` affiche seulement exploitations publiées, pas editable

---

## ARCHITECTURE ACTUELLE

### Hiérarchie des routes

```
Mobile
├── /profil (PUBLIC SHELL)
│   ├─ Affichage identité, complétude, organisations (READ-ONLY)
│   ├─ Lien vers /farmer ou /organization selon le rôle
│   └─ Affiche permissions effectives
│
├── /farmer
│   ├── /(tabs) → 5 onglets (accueil, exploitations, parcelles, productions, sols)
│   ├── /profile → Édition firstName, lastName UNIQUEMENT
│   ├── /settings → Langue, notifications (non sauvegardés), MFA (read-only)
│   ├── /public-profile → Affichage profil public (exploitations listées)
│   ├── /verification → Statut de vérification (READ-ONLY)
│   ├── /certifications → Liste des certifications (READ-ONLY)
│   ├── /sync → État synchronisation hors ligne (READ-ONLY)
│   └── [autres : alerts, devices, inventory, notifications, reviews, etc.]
│
├── /organization
│   ├── /overview → Tableau de bord (READ-ONLY + raccourcis)
│   ├── /profile → Édition nom, description de l'organisation
│   ├── /members → Liste adhésions + rôles (READ-ONLY)
│   ├── /verification → Statut de vérification (READ-ONLY)
│   └── [autres : farms, orders, offers, production, transport, etc.]
│
├── /investment
│   ├── /profile → Édition firstName, lastName (MÊME CODE QUE FARMER)
│   ├── /index → Tableau de bord
│   └── [autres : followed, requests, etc.]
│
└── /admin
    ├── /dashboard → Métriques, comptes, audit, tâches (READ-ONLY)
    ├── /settings → Paramètres serveur (READ-ONLY)
    └── [autres modules : users, compliance, audit, etc.]
```

### Pages PROFILE par rôle

| Rôle | Route | Conteneur | Éditable | Données |
|------|-------|-----------|----------|---------|
| FARMER | `/farmer/profile` | FarmerHeader | firstName, lastName | Identité perso |
| ORGANIZATION (admin/member) | `/organization/profile` | AppHeader | name, description | Identité org |
| INVESTOR | `/investment/profile` | AppHeader | firstName, lastName | Identité perso |

### Pages SETTINGS par rôle

| Rôle | Route | Conteneur | Sections | État |
|------|-------|-----------|----------|------|
| FARMER | `/farmer/settings` | FarmerHeader | Langue, notifications, MFA | PARTIEL (aucune sauvegarde) |
| ORGANIZATION | — | — | — | ABSENT |
| INVESTOR | — | — | — | ABSENT |
| ADMIN | `/admin/settings` | AppHeader | Paramètres serveur (lecture) | READ-ONLY |

---

## INVENTAIRE DÉTAILLÉ

### A — EXISTANT ET FONCTIONNEL

#### A.1 — Identité personnelle (FARMER & INVESTOR)

**Route :** `/farmer/profile` (ligne 1-67)  
**API :** `authApi.updateMe({ firstName, lastName })`  
**État :** ✅ FONCTIONNEL  
**Preuves :**
- useState pour firstName, lastName
- useMutation vers authApi.updateMe()
- Validation trim() et sauvegarde
- UI : Input + Button Save
- Affichage statut email/téléphone + badges vérification

**Limitation :** Seul nom/prénom ; aucune autre info professionnelle

---

#### A.2 — Identité organisation

**Route :** `/organization/profile` (ligne 1-55)  
**API :** `organizationApi.update(id, { name, description })`  
**État :** ✅ FONCTIONNEL  
**Preuves :**
- Charge l'org depuis activeOrganizationId
- Édition nom + description
- useMutation + onSuccess refetch

---

#### A.3 — Profil public de l'exploitant

**Route :** `/farmer/public-profile` (ligne 1-70)  
**API :** Read-only : `farmApi.list()` + `authApi.me()`  
**État :** ✅ FONCTIONNEL  
**Affiche :** 
- Prénom, nom, pays
- Exploitations publiées (listées)
- Badges vérification email/téléphone

---

#### A.4 — Vérification (read-only)

**Route :** `/farmer/verification` + `/organization/verification`  
**API :** `verificationApi.mine()`  
**État :** ✅ FONCTIONNEL  
**Affiche :**
- Niveau de vérification (LEVEL)
- Statut (PENDING, APPROVED, REJECTED)
- Date révision + motif

---

#### A.5 — Certifications (read-only)

**Route :** `/farmer/certifications`  
**API :** `certificationApi.list()`  
**État :** ✅ FONCTIONNEL  
**Affiche :**
- Type, numéro de référence, émetteur
- Date d'expiration
- Statut (VALIDATED, EXPIRED, etc.)

---

#### A.6 — Synchronisation hors ligne

**Route :** `/farmer/sync`  
**API :** `syncApi.collections()` + `syncApi.pull()`  
**État :** ✅ FONCTIONNEL  
**Affiche :**
- Nombre collections
- Changements sur 7 jours
- Curseur de synchronisation

---

#### A.7 — Membres de l'organisation

**Route :** `/organization/members`  
**API :** `organizationApi.get(id)` → `memberships`  
**État :** ✅ FONCTIONNEL (READ-ONLY)  
**Affiche :**
- Membres actifs
- Rôles par membre
- Statut adhésion
- Consentements

---

#### A.8 — Profil global connecté (/profil)

**Route :** `/profil` (page publique shell)  
**API :** `authApi.me()` + `authApi.permissions()` + `authApi.mfaStatus()`  
**État :** ✅ TRÈS COMPLET (READ-ONLY)  
**Affiche :**
- Identité (nom, prénom, pays)
- Complétude du dossier (% + critères)
- Compteurs (exploitations, parcelles, productions)
- Organisations + rôles
- Permissions réelles
- Statut MFA
- Session token rotation info
- Boutons : accès space métier, déconnexion

---

### B — EXISTANT MAIS PARTIEL OU NON VÉRIFIÉ

#### B.1 — Langue (FARMER SETTINGS)

**Route :** `/farmer/settings` (ligne 25-32)  
**API :** Lecture depuis i18n store ; aucune persistance serveur  
**État :** ⚠️ PARTIEL — Interface locale seulement  
**Code :**
```tsx
const { locale, setLocale } = useI18n();
// PressableScale pour choisir langue (fr, en, etc.)
// setLocale() → i18n store UNIQUEMENT
// aucun PATCH /me avec { locale }
```
**Problème :** Choix perdu au rechargement app (sauf si localStorage persistent)  
**Pas de test mobile visible**

---

#### B.2 — Notifications (FARMER SETTINGS)

**Route :** `/farmer/settings` (ligne 26-29)  
**État :** ⚠️ NON FONCTIONNEL — UI mockée  
**Code :**
```tsx
const [notifications, setNotifications] = useState(true);
const [digest, setDigest] = useState(false);
// Row component → Switch
// Button Save → onPress={() => {}} // VIDE
```
**Route réelle :** `/notifications/preferences` existe (via `/app/notifications/preferences.tsx`)  
**API :** `notificationApi.preferences()` + `notificationApi.setPreferences()`  
**Lacune :** Pas de navigation vers cette page dans settings farmer  
**Confusion :** Deux systèmes de notifications distincts

---

#### B.3 — MFA / Double authentification

**Affichage :**
- `/profil` : statut + badge sécurité (READ-ONLY)
- `/farmer/settings` : toggle désactivé + statut (READ-ONLY)

**Configuration :**
- Routes réelles : `/auth/mfa/status`, `/auth/mfa/setup`, `/auth/mfa/confirm`, `/auth/mfa/disable`
- Aucun lien depuis settings mobile vers `/auth/mfa/*`

**État :** ⚠️ FRAGMENTÉ — Configuration absente du settings métier

---

#### B.4 — Mot de passe

**API :** `authApi.changePassword({ currentPassword, newPassword, mfaCode? })`  
**Route :** Aucune page mobile  
**État :** ⚠️ ABSENT DE L'INTERFACE — Endpoint backend prêt mais aucun formulaire

---

#### B.5 — Photo de profil

**État :** ❌ ENTIÈREMENT ABSENT  
**Preuves :**
- Aucune upload photo dans `/farmer/profile`
- Avatar généré depuis initiales (letter avatar)
- Aucun endpoint photo dans authApi
- Backend type `MeResult` ne mentionne pas `avatar`

---

### C — ABSENT / NON IMPLANTÉ

#### C.1 — Profil professionnel détaillé (FARMER)

**Manquent :**
- Poste / fonction
- Département / service
- Domaine d'expertise
- Spécialité
- Biographie professionnelle
- Expérience
- Certifications (éditables du profil)

**API :** Aucun endpoint de PATCH pour ces champs  
**UI :** Aucun formulaire  
**Besoin :** Critique pour PROFILE identité pro

---

#### C.2 — Paramètres personnalisés (FARMER & ORGANIZATION)

**Manquent :**
- Thème / apparence (seulement langue)
- Préférences d'affichage
- Son / vibrations
- Rappels par défaut

**État :** ❌ ABSENT

---

#### C.3 — SETTINGS pour ORGANIZATION

**Route :** Aucune  
**Besoin :** Paramètres orga (langue, notifications orga-wide, etc.)  
**État :** ❌ ABSENT

---

#### C.4 — SETTINGS pour INVESTOR

**Route :** Aucune  
**État :** ❌ ABSENT

---

#### C.5 — Gestion des sessions actives

**Besoin :** Lister/révoquer sessions  
**API :** Aucune visible  
**État :** ❌ ABSENT

---

#### C.6 — Confidentialité et consentements

**Besoin :** Gérer consentements RGPD, usage données, SMS  
**Route existante :** `/notifications/sms-consent.tsx`  
**But :** Accepter/retirer consentement SMS  
**Lacune :** Pas accessible via SETTINGS métier ; page standalone  
**État :** ⚠️ FONCTIONNEL mais ORPHELIN

---

#### C.7 — Téléchargement/suppression de compte

**Besoin :** Export données, droit à l'oubli  
**État :** ❌ ABSENT

---

## ANALYSE COMPARATIVE

### Confusion : `/profil` vs `/farmer/profile` vs `/farmer/settings`

| Chemin | Shell | Rôle | Contenu | Éditable | Accès |
|--------|-------|------|---------|----------|-------|
| `/profil` | PublicShell | PUBLIC | Identité, orga, perms, sécurité | ❌ | Via menu public |
| `/farmer/profile` | FarmerHeader | FARMER | firstName, lastName | ✅ Partiel | Depuis `/farmer/(tabs)` |
| `/farmer/settings` | FarmerHeader | FARMER | Langue (oui), Notif, MFA (non) | ⚠️ Partiel | Depuis `/farmer/(tabs)` |
| `/farmer/public-profile` | FarmerHeader | FARMER | Profil public (exploits) | ❌ | Depuis `/farmer/(tabs)` |

**Analyse :**
- **Trois pages nommées « profile »** → confusion architecture
- `/profil` = page de SYNTHÈSE complète (affichage + navigation)
- `/farmer/profile` = page d'ÉDITION réduite (nom+prénom)
- `/farmer/public-profile` = page de VIS (comment on me voit)
- **SETTINGS fragmenté** : certaines pref sous PROFILE, certaines orphelines

---

### Données visibles par page

```
/profil (PUBLIC SHELL)
├─ Identité (READ) ✅
├─ Complétude (READ) ✅
├─ Compteurs (READ) ✅
├─ Organisations + rôles (READ) ✅
├─ Permissions (READ) ✅
└─ Statut MFA (READ) ✅

/farmer/profile (EDIT)
├─ firstName ✅
├─ lastName ✅
├─ Email (READ) ✅
├─ Téléphone (READ) ✅
└─ Badges verif (READ) ✅

/farmer/settings (CONFETTI)
├─ Langue (LOCAL ONLY) ⚠️
├─ Notifications toggle (NO SAVE) ❌
├─ MFA toggle (READ-ONLY) ❌
└─ Statut email/phone (READ) ✅
```

---

## CONFUSIONS ET DOUBLONS IDENTIFIÉS

### 1. Notifications : TROIS systèmes disjoints

- `/farmer/settings` : toggles mockés (ne sauvent rien)
- `/notifications/index` : liste notifications in-app
- `/notifications/preferences` : véritables préférences (par canal × type)

**Problème :** Utilisateur croit configurer depuis SETTINGS mais rien n'est sauvegardé

---

### 2. Profil public : DEUX pages différentes

- `/farmer/public-profile` : exploitations publiées (mobil-spécifique)
- `/public-site/profil` : aperçu complet (web)

**Problème :** Incohérence entre mobile et web

---

### 3. MFA : Configuration ABSENTE de SETTINGS

- `/profil` : affichage du statut
- `/auth/mfa/*` : configuration réelle
- `/farmer/settings` : toggle de lecture seule

**Problème :** Aucun lien pour activer/désactiver 2FA depuis settings

---

### 4. Langue : Sauvegarde INCOHÉRENTE

- Stockée localement (i18n store + localStorage)
- **Jamais envoyée au serveur** (aucun PATCH /me avec `locale`)
- Notifications/emails en français par défaut côté serveur

**Problème :** Préférence perdue si session sur autre appareil

---

### 5. Photo de profil : INEXISTANTE

- Avatar généré depuis initiales
- Aucune upload
- Différent du web (qui permet upload)

**Problème :** Identité visuelle réduite mobile vs web

---

## PROPOSITIONS D'ARCHITECTURE

### Vision cible : PROFILE = Identité pro ; SETTINGS = Préférences app

---

### FARMER

#### `/farmer/profile` → PROFILE professionnel

**Objectif :** Identité professionnelle complète du paysan

**Sections proposées :**

1. **Identité personnelle** (READ or EDIT selon contexte)
   - Prénom, nom
   - Email + badge verif
   - Téléphone + badge verif
   - Photo de profil (UPLOAD)

2. **Profil professionnel** (NEW — today ABSENT)
   - Poste / fonction
   - Type d'exploitation (culture primaire)
   - Année d'expérience
   - Certifications (liste READ)

3. **Localisation & organisation** (READ)
   - Pays, province
   - Organisations rattachées + rôles

4. **Vérification & complétude** (READ)
   - Niveau de vérification
   - % complétude profil
   - Critères manquants

5. **Profil public** (READ or EDIT)
   - Biographie professionnelle (NEW — today ABSENT)
   - Exploitations listées comme « publiques »
   - Visibilité toggle par exploitation

---

#### `/farmer/settings` → SETTINGS applicatif

**Objectif :** Configuration app + préférences utilisateur

**Sections proposées :**

1. **Préférences app**
   - Langue ✅ (TODAY: local only → FIX to persist server)
   - Thème / apparence (NEW)
   - Notifications push (MOVE from list to real prefs)

2. **Notifications** (CONSOLIDATE)
   - Lien vers `/notifications/preferences` complètes (par canal × type)
   - Résumé des préférences courantes

3. **Sécurité & compte**
   - Mot de passe (NEW → form)
   - MFA / 2FA (LINK to `/auth/mfa/status`, setup modal ou page)
   - Sessions actives (NEW)
   - Consentement SMS (MOVE from orphan page)

4. **Confidentialité**
   - Téléchargement données (NEW)
   - Suppression compte (NEW)
   - RGPD rights (NEW)

---

### ORGANIZATION

#### `/organization/profile` → PROFILE organisation

**Sections proposées :**

1. **Identité organisation** ✅
   - Nom, type, pays ✅
   - Description  ✅
   - Logo / photo (NEW)

2. **Responsable légal** (NEW)
   - Contact légal
   - Email légal

3. **Coordonnées contact** (NEW)
   - Téléphone
   - Adresse

4. **Vérification** (READ)
   - Niveau organisatio

n
   - Statut vérification

5. **Membres** (READ-ONLY via separate page)
   - Link to `/organization/members`

---

#### `/organization/settings` (NEW PAGE)

**Objectif :** Paramètres orga-wide

**Sections :**

1. **Préférences orga**
   - Langue par défaut
   - Notifications orga
   - Thème

2. **Rôles & permissions** (READ-ONLY)
   - Aperçu rôles définis
   - Permissions par rôle

3. **Sécurité**
   - MFA obligatoire pour membres (NEW)
   - Sessions actives (READ)

---

### INVESTOR

#### `/investment/profile` → PROFILE investisseur

**Sections identiques à FARMER** (car identité personnelle identique)

#### `/investment/settings` (NEW)

**Sections identiques à FARMER**

---

## PLAN D'INTERVENTION

### PHASE 1 : CORRECTIONS IMMÉDIAT (BUGS)

**Durée estimée :** 2-3 jours

1. **Notifications FARMER SETTINGS**
   - [FIX] `/farmer/settings` : Button Save → appel vrai mutation
   - [DELETE] Mock toggles
   - [ADD] Lien vers `/notifications/preferences` (page complète)

2. **Langue persistance**
   - [ADD] PATCH /me avec `{ locale: ...}` on `setLocale()`
   - [VERIFY] Server stores locale
   - [ADD] i18n hydration from /me au démarrage

3. **MFA dans SETTINGS**
   - [ADD] Lien "Configurer 2FA" vers `/auth/mfa/status`
   - [IMPROVE] UI statut MFA

---

### PHASE 2 : STRUCTURE CIBLE (Restructuration)

**Durée estimée :** 1 semaine

1. **Renommer/clarifier routes**
   - `/farmer/profile` reste pour édition identité base
   - Créer `/farmer/profile/professional` (NEW) pour poste, expertise, etc.
   - Créer `/farmer/profile/public` (NEW) pour biographie publique

2. **Consolider SETTINGS FARMER**
   - Restructurer `/farmer/settings` en sections
   - Ajouter forms MFA, mot de passe
   - Lier page SMS consent

3. **Créer SETTINGS ORGANIZATION** (NEW)
   - Copier structure FARMER
   - Adapter à niveau org

4. **Créer SETTINGS INVESTOR** (NEW)
   - Copier structure FARMER

---

### PHASE 3 : NOUVELLES FONCTIONNALITÉS

**Durée estimée :** 2-3 semaines

1. **Photo de profil**
   - [ADD] Upload avatar utilisateur
   - [ADD] API endpoint media
   - [DISPLAY] Photo au lieu initiales

2. **Profil professionnel détaillé** (FARMER & INVESTOR)
   - [ADD] Fields : poste, domaine, expérience, bio
   - [ADD] API PATCH /me ou /me/professional
   - [UI] Formulaire édition

3. **Mot de passe**
   - [ADD] Formulaire `/farmer/settings` ou `/settings/security`
   - [USE] API `authApi.changePassword()`

4. **Sessions actives**
   - [ADD] API endpoint lister sessions
   - [ADD] UI revoke action
   - [DISPLAY] Dans settings sécurité

5. **Téléchargement/suppression compte**
   - [ADD] API export/delete
   - [ADD] Formulaires avec confirmation

---

### PHASE 4 : TESTS & POLISH

**Durée estimée :** 1 semaine

- Tests unitaires nouvelles forms
- Tests E2E flow profile + settings
- Responsive mobile
- Accessibilité

---

## RECOMMANDATIONS PRIORITAIRES

### 🔴 CRITIQUE (Bugs production)

1. **Notifications SETTINGS ne sauvent rien** → Utilisateurs croient configurer
2. **Langue non persistée serveur** → Notifications en mauvaise langue
3. **MFA non accessible depuis SETTINGS** → Confusion sécurité

### 🟡 IMPORTANT (Architecture)

1. **Photo de profil manquante** → Différence web/mobile
2. **Profil professionnel absent** → PROFILE incomplet vs cahier des charges
3. **SETTINGS fragmenté** → Routes orphelines (SMS, notifications)

### 🟢 NICE-TO-HAVE (UX)

1. Thème / apparence
2. Sessions actives
3. Export données
4. Suppression compte

---

## DEPENDENCIES & RISQUES

### Dépendances externes

- API Backend prête pour : updateMe(), mfaStatus/setup/confirm, changePassword, SMS consent
- API Backend **manquante pour :** profil pro détaillé, photo, sessions, export

### Risques de régression

- **Modifier `/farmer/settings`** → vérifier que langue et aucune autre pref ne se perd
- **Créer `/farmer/profile/professional`** → tester lien depuis `/profil` et overview
- **Ajouter forms sécurité** → tester MFA avec/sans active

---

## CONCLUSION

L'application React Native expose une **dichotomie profonde** entre :
- `/profil` : SYNTHÈSE complète, READ-ONLY
- `/farmer/profile` : ÉDITION microscopique (nom+prénom)
- `/farmer/settings` : INTERFACE mockée non fonctionnelle

**Réorganisation nécessaire :**
1. **Fixer les bugs immédiat** (notifications, langue, MFA)
2. **Restructurer logiquement** : PROFILE = identité pro ; SETTINGS = appli + sécurité
3. **Implanter manquements** : photo, profil pro, mot de passe, sessions
4. **Maintenir cohérence** web ↔ mobile

**Pas de régression attendue** si plan appliqué progressivement avec tests.

---

**FIN DE L'AUDIT**
