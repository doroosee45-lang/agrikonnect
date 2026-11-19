# AUDIT COMPLET PROFILE & SETTINGS — AGRIKONNECT AFRICA (FULLSTACK)

**Scope :** Web + Mobile + Backend  
**Date :** 2026-11-18  
**État :** Audit préalable sans modification  

---

## EXECUTIVE SUMMARY

AgriKonnect Africa implémente des espaces PROFILE et SETTINGS fragmentés à travers trois architectures :

### **État actuel** :

| Domaine | WEB | MOBILE | BACKEND | État |
|---------|-----|--------|---------|------|
| **PROFILE** | ✅ Routes multiples | ✅ Routes multiples | ✅ APIs fonctionnelles | 🟡 Fragmenté |
| **SETTINGS** | ✅ Minimal | ✅ Partiel + bugué | ✅ APIs principalement réunies | 🔴 Incomplet |
| **Navigation** | ✅ Cohérente | 🟡 Mélangée | — | 🔴 Confuse |
| **Harmonisation** | — | — | — | 🔴 Absente |

### **Problèmes clés identifiés** :

1. **3 pages PROFILE** : `/farmer/profile`, `/organization/profile`, `/investment/profile` avec structures différentes
2. **SETTINGS fragmentée** : Pages disjointes (`/farmer/settings`, `/app/profile`, `/notifications/preferences`, `/auth/mfa`)
3. **Mobile Settings bugué** : Button "Save" vide, language non-persistée serveur, MFA read-only
4. **APIs existantes mais mal utilisées** : Backend prêt pour plus de champs, frontend utilise 10% des possibilités
5. **Navigation incohérente** : Liens settings erronés, pages orphelines (ex: SMS consent)
6. **Pas de Settings pour ORGANIZATION/INVESTMENT** : Seul FARMER a settings mobile ; web partiellement

---

## SECTION 1 : ARCHITECTURE EXISTANTE

### 1.1 — ROUTES ET PAGES WEB

#### PROFILE Routes (5 variantes) :

| Route | Fichier | Contenu | Éditable | État |
|-------|---------|---------|----------|------|
| `/farmer/profile` | `farmer/Profile.tsx` | firstName + lastName + email/phone/badges | ✅ Oui | ✅ Fonctionnel |
| `/organization/profile` | `organization/Profile.tsx` | Org name + description + roles | ✅ Oui | ✅ Fonctionnel |
| `/investment/profile` | `investment/Profile.tsx` | READ-ONLY : firstName + lastName + email | ❌ Non | 🟡 Incomplet |
| `/app/profile` | `app/Profile.tsx` | Synthèse complète (identity + completeness + counts) | ✅ Oui | ✅ Fonctionnel |
| `/public/farmers-:slug` | `public/FarmProfile.tsx` | Profil public agriculteur | ❌ Non | ✅ Consultation |

#### SETTINGS Routes (3 variantes) :

| Route | Fichier | Contenu | État |
|-------|---------|---------|------|
| `/farmer/settings` | `farmer/Settings.tsx` | Langue + compte info | 🟡 Minimal |
| `/admin/settings` | `admin/Settings.tsx` | Paramètres plateforme (READ) | ✅ Consultation |
| ✗ MISSING | — | ORGANIZATION settings | ❌ Absent |
| ✗ MISSING | — | INVESTMENT settings | ❌ Absent |

### 1.2 — ROUTES ET PAGES MOBILE

#### PROFILE Routes (5 variantes) :

| Route | Fichier | Contenu | Éditable | État |
|-------|---------|---------|----------|------|
| `/farmer/profile.tsx` | Mobile/farmer/ | firstName + lastName + email/phone/badges | ✅ Oui | ✅ Fonctionnel |
| `/farmer/public-profile.tsx` | Mobile/farmer/ | Consulter son profil public | ❌ Non | ✅ Consultation |
| `/organization/profile.tsx` | Mobile/organization/ | Org name + description | ✅ Oui | ✅ Fonctionnel |
| `/investment/profile.tsx` | Mobile/investment/ | firstName + lastName | ✅ Oui | ✅ Fonctionnel |
| `/profil.tsx` | Mobile/app/ | Synthèse complète (PUBLIC SHELL) | ✅ Partiel | 🟡 Mixte |

#### SETTINGS Routes (Fragmentée) :

| Route | Fichier | Contenu | État |
|-------|---------|---------|------|
| `/farmer/settings.tsx` | Mobile/farmer/ | Langue + notifications + MFA (bugué) | 🔴 Bugué |
| `/notifications/preferences.tsx` | Mobile/notifications/ | Config vraie preferences (fonctionnelle) | ✅ Fonctionnel |
| `/notifications/sms-consent.tsx` | Mobile/notifications/ | Consentement SMS | ✅ Consultation |
| `/auth/mfa.tsx` | Mobile/auth/ | Setup/verify MFA | ✅ Fonctionnel |
| ✗ MISSING | — | ORGANIZATION settings | ❌ Absent |
| ✗ MISSING | — | INVESTMENT settings | ❌ Absent |

### 1.3 — BACKEND APIS

#### Profile APIs :

```
GET  /me                      → Profil auth + completeness + counts
PATCH /me                     → Update: firstName, lastName, phone, whatsapp, locale
GET  /me/permissions          → Rôles et permissions
POST /me/password             → Changer mot de passe

GET  /organizations           → Lister orgs
GET  /organizations/:id       → Détail org
PATCH /organizations/:id      → Update org: name, description

GET  /investors/me            → Profil investisseur
PUT  /investors/me            → Create/update profil investisseur
```

#### Settings APIs :

```
GET  /notifications/preferences        → Lister prefs
PUT  /notifications/preferences        → Sauvegarder prefs (par type × canal)

GET  /auth/mfa/status                  → Status MFA
POST /auth/mfa/setup                   → Démarrer setup
POST /auth/mfa/confirm                 → Confirmer + activer
POST /auth/mfa/disable                 → Désactiver

(ABSENT)                               → Dedicated security settings endpoint
(ABSENT)                               → Privacy/consent preferences endpoint
```

---

## SECTION 2 : INVENTAIRE DÉTAILLÉ A/B/C

### A — FONCTIONNEL ET IMPLANTÉ

#### A.1 — PROFILE FARMER

**WEB :** `/farmer/profile` (farmer/Profile.tsx)
- Affiche : firstName, lastName, email, phone, badges vérification
- Édite : firstName, lastName
- API : `authApi.updateMe()`
- État : ✅ **Fonctionne correctement**

**MOBILE :** `/farmer/profile.tsx`
- Affiche : firstName, lastName, email, phone, badges vérification
- Édite : firstName, lastName
- API : `authApi.updateMe()`
- État : ✅ **Fonctionne correctement**

#### A.2 — PROFILE ORGANIZATION

**WEB :** `/organization/profile` (organization/Profile.tsx)
- Affiche : name, description, type, slug, création, rôles
- Édite : name, description
- API : `organizationApi.update()`
- État : ✅ **Fonctionne correctement**

**MOBILE :** `/organization/profile.tsx`
- Affiche : name, description, type, pays
- Édite : name, description
- API : `organizationApi.update()`
- État : ✅ **Fonctionne correctement**

#### A.3 — PROFILE INVESTMENT

**WEB :** `/investment/profile` (investment/Profile.tsx)
- Affiche : firstName, lastName, email (READ)
- Édite : ❌ Aucun
- État : 🟡 **Incomplet** (read-only)

**MOBILE :** `/investment/profile.tsx`
- Affiche : firstName, lastName, email, phone, badges
- Édite : firstName, lastName
- API : `authApi.updateMe()`
- État : ✅ **Fonctionne**

#### A.4 — LANGUAGE SELECTION

**WEB :** `/farmer/settings` (farmer/Settings.tsx)
- Boutons : FR / EN
- Stockage : i18n store local + ✅ PATCH /me avec `locale`
- État : ✅ **Fonctionne, persiste serveur**

**MOBILE :** `/farmer/settings.tsx`
- Boutons : SUPPORTED_LOCALES
- Stockage : i18n store local + ❌ **PAS** PATCH /me
- État : 🔴 **Bugué** : langue perd au rechargement

#### A.5 — NOTIFICATIONS PREFERENCES (vrai)

**MOBILE :** `/notifications/preferences.tsx`
- Affiche : Matrice type × canal
- Édite : Oui, via mutation `notificationApi.preferences()`
- État : ✅ **Fonctionne correctement**

#### A.6 — MFA SETUP/VERIFY

**MOBILE & WEB :** `/auth/mfa*` routes
- Affiche : Status MFA
- Édite : Setup, confirm, disable via APIs dédiées
- État : ✅ **Fonctionne correctement** (mais orpheline dans settings mobile)

---

### B — EXISTANT MAIS PARTIEL OU NON VÉRIFIÉ

#### B.1 — FARMER SETTINGS (Mobile)

**Fichier :** `Mobile/app/farmer/settings.tsx`

**Problèmes** :
```tsx
// Ligne 65 : Button Save appelle onPress={() => {}}  — VIDE
<Button label={t('common.save')} variant="primary" onPress={() => {}} />

// Notifications/MFA/Digest : useState sans mutation
const [notifications, setNotifications] = useState(true);
const [digest, setDigest] = useState(false);
const [mfa, setMfa] = useState(false);
// → Ces toggles ne sauvent rien
```

**État** : 🔴 **Non-fonctionnel** (UI mockée)

#### B.2 — APP PROFILE (Web)

**Fichier :** `web/pages/app/Profile.tsx`

**Contenu** :
- Affiche : firstName, lastName, email, phone, whatsapp, permissions, counts, organizations
- Édite : firstName, lastName, phone, whatsapp
- API : `authApi.updateMe()`

**État** : ✅ **Fonctionne** (mais c'est une PAGE SECONDAIRE, pas la page principale farmer/profile)

**Confusion** : Deux pages "profile" différentes, same user, different data/routes

#### B.3 — NOTIFICATIONS SETTINGS (Mobile)

**Fichier :** `Mobile/app/farmer/settings.tsx`

**Contenu** :
- Affiche : toggles Push, Weekly digest
- Édite : useState, PAS de mutation
- État : 🔴 **Non-fonctionnel**

**Vrai lieu** : `/notifications/preferences.tsx` (fonctionne correctement)

**Confusion** : Deux pages notifications différentes, contenu dupliqué/mélangé

#### B.4 — MFA SETTINGS (Mobile)

**Fichier :** `Mobile/app/farmer/settings.tsx`

**Contenu** :
```tsx
<Row label={t('ui.doubleAuthentification2fa')} value={mfa} onValueChange={setMfa} />
// → Toggle READ-ONLY, pas d'API call
```

**Vrai lieu** : `/auth/mfa.tsx` (setup/verify réel)

**État** : 🔴 **Partiel** : toggle informationnel seulement, aucun lien vers config réelle

---

### C — ABSENT / NON IMPLANTÉ

#### C.1 — ORGANIZATION SETTINGS

**État** : ❌ **Absent sur les deux plateformes**

**Needed** :
- Notifications ORGANIZATION preferences
- Langue ORGANIZATION (si multi-language par org)
- Sécurité ORGANIZATION (MFA pour admins org)
- Membres + permissions (si settings plutôt que page séparée)

#### C.2 — INVESTMENT SETTINGS

**État** : ❌ **Absent sur les deux plateformes**

**Needed** :
- Notifications INVESTMENT preferences
- Accès data room : consentements
- Préférences investisseur (secteurs, pays, ticket, devise)

#### C.3 — PROFILE PRO COMPLÈTES

**État** : ❌ **Absent**

**Needed** (pour FARMER) :
- Poste/fonction
- Domaine expertise
- Spécialité
- Biographie professionnelle
- Années d'expérience
- Certifications/qualifications
- Photo profil
- Exploitations responsables
- Projet actuels

**Backend Ready** : `PATCH /me` accepte plus que firstName/lastName (prêt à extend)

#### C.4 — SETTINGS SÉCURITÉ COMPLÈTES

**État** : 🟡 **Partiel** (MFA existe, resto absent)

**Needed** :
- Mot de passe : form change password (backend API existe : `POST /me/password`)
- Sessions actives : list + revoke (backend : ABSENT)
- Logout all devices : (backend : ABSENT)
- Authentification : historique tentatives (backend : ABSENT)
- Appareils de confiance : (backend : ABSENT)

#### C.5 — SETTINGS CONFIDENTIALITÉ

**État** : 🟡 **Partiel** (SMS consent existe, resto absent)

**Needed** :
- Export données : (backend : ABSENT)
- Suppression compte : (backend `DELETE /me` existe, UI absent)
- Consentements (marketing, etc.) : (backend partiellement present, UI fragmentée)
- Préférences de communication (email, SMS, app)

#### C.6 — PUBLIC PROFILE HARMONISÉ

**État** : 🟡 **Partial** (pages multiples, pas d'harmonisation)

**Needed** :
- URLs uniformes pour voir profil d'autre utilisateur (ex: `/profiles/:userId`)
- Affichage des exploitations publiques
- Affichage de la biographie
- Affichage des certifications

#### C.7 — SETTINGS LANGUAGE PER ROLE

**État** : ✅ Exists (PATCH /me), 🔴 Mobile bugué

**Problem** : Language not persisted on MOBILE after logout

---

## SECTION 3 : ANALYSE COMPARATIVE WEB VS MOBILE

### 3.1 — Fonctionnalités disponibles Web mais absentes Mobile

| Fonctionnalité | WEB | MOBILE | Raison |
|---|---|---|---|
| Organization Profile édition | ✅ | ✅ | Parity OK |
| Investment Profile | ✅ READ | ✅ EDIT | Mobile plus complet |
| Admin Settings | ✅ | ✅ | Parity OK |
| Settings langue | ✅ | 🔴 Bugué | Mobile a bug |
| Notifications édition | ❌ | ✅ | Mobile seulement (page séparée) |
| App Profile secondaire | ✅ | ✅ | Parity OK |

### 3.2 — Fonctionnalités absentes BOTH

| Fonctionnalité | WEB | MOBILE | Priority |
|---|---|---|---|
| Organization Settings | ❌ | ❌ | 🟠 Moyen |
| Investment Settings | ❌ | ❌ | 🟠 Moyen |
| Security (password, sessions) | ❌ | ❌ | 🔴 Critique |
| Privacy/Consent | ✅ SMS only | ❌ | 🟠 Moyen |
| Professional Profile (job, bio, certs) | ❌ | ❌ | 🟠 Moyen |
| Avatar/Photo upload | ❌ | ❌ | 🟠 Moyen |
| Data export | ❌ | ❌ | 🟠 Moyen |

### 3.3 — Problèmes d'UX/Navigation

| Problème | WEB | MOBILE | Localisation |
|---|---|---|---|
| Liens settings erronés | — | 🔴 OUI | FarmerHeader, AppHeader |
| Pages orphelines (SMS consent) | — | 🔴 OUI | `/notifications/sms-consent` |
| Button Save vide | — | 🔴 OUI | farmer/settings.tsx:65 |
| Toggles UI non-fonctionnels | — | 🔴 OUI | farmer/settings.tsx:30-32 |
| Language non-persistée serveur | — | 🔴 OUI | farmer/settings.tsx (not PATCH) |
| Deux routes "profile" confuses | 🟡 OUI | 🟡 OUI | `/app/profile` vs role-based |
| Deux pages notifications | — | 🔴 OUI | `/farmer/settings` vs `/notifications/preferences` |

