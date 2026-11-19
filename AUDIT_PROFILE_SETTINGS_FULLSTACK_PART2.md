# AUDIT COMPLET PROFILE & SETTINGS — AGRIKONNECT AFRICA (PART 2)

---

## SECTION 4 : CONFUSIONS ET PROBLÈMES MAJEURS

### 4.1 — Confusion #1 : Deux PROFILE Farmer différentes

**WEB** :
- `/farmer/profile` = page principale FARMER (firstName, lastName only, éditable)
- `/app/profile` = page synthèse utilisateur + org + counts (aussi éditable)

**MOBILE** :
- `/farmer/profile.tsx` = page principale FARMER (firstName, lastName, éditable)
- `/profil.tsx` = page publique synthèse (PUBLIC SHELL)

**Problème** : Un utilisateur peut éditer profil à deux endroits différents, avec données légèrement différentes.

**Risque régression** : Modifier `/farmer/profile` peut oublier de syncer `/app/profile`.

---

### 4.2 — Confusion #2 : Notifications Settings vs Preferences

**MOBILE** :
- `/farmer/settings.tsx` → Toggles Push, Digest (UI mockée, ne persiste pas)
- `/notifications/preferences.tsx` → Config réelle (type × canal, fonctionne)

**Problème** : L'utilisateur voit deux pages pour le même concept, l'une ne marche pas.

**Risque** : User clicks in `/farmer/settings` → pense avoir sauvegardé → rien ne persiste.

---

### 4.3 — Confusion #3 : MFA dans Settings vs Auth

**MOBILE** :
- `/farmer/settings.tsx` → Toggle MFA (READ-ONLY, pas de lien vers setup)
- `/auth/mfa.tsx` → Vraie page setup/verify (fonctionne)

**Problème** : User lit "MFA désactivée" dans settings → clique toggle → rien ne se passe → aucun lien vers config réelle.

**Risque** : User pense MFA ne marche pas, abandon.

---

### 4.4 — Confusion #4 : Language non-persistée Mobile

**WEB** : `farmer/Settings.tsx` → `setLocale('fr')` + `PATCH /me { locale }`
```tsx
onClick={() => setLocale('fr')}
// + implicit PATCH dans backend
```

**MOBILE** : `farmer/settings.tsx` → `setLocale('fr')` SEULEMENT
```tsx
onPress={() => setLocale(option.code)}
// PAS DE PATCH /me
```

**Problème** : Language change en app, mais ne persiste pas serveur.

**Risque** : Logout → rechargement app → revient à FR (default backend).

---

### 4.5 — Confusion #5 : Navigation Settings

**FarmerHeader** (Mobile):
```tsx
<IconButton 
  icon="settings-outline" 
  onPress={() => router.push('/profil')}  // ❌ WRONG
/>
```

**AppHeader** (Mobile):
```tsx
// Probablement pointe vers `/organization/profile` ou absent
```

**Problème** : Button "settings" ne pointe pas vers `/farmer/settings` ou role-appropriate settings.

---

## SECTION 5 : PROPOSITIONS D'ARCHITECTURE CIBLE

### 5.1 — PROFILE STRUCTURE

**Objectif** : Chaque rôle a UN profil principal, consulté et édité au même endroit.

#### FARMER PROFILE

**Route** : `/farmer/profile` (WEB + MOBILE)

**Sections** :
1. **Identité personnelle** (edit)
   - Prénom, nom
   - Email + phone + whatsapp
   - Photo profil (NEW)
   - Badges vérification

2. **Profil professionnel** (edit, NEW)
   - Poste/fonction
   - Domaine expertise
   - Spécialité
   - Années d'expérience
   - Certifications (NEW)
   - Biographie professionnelle

3. **Exploitations & responsabilités** (READ)
   - Fermes associées (liste)
   - Rôle dans organisations
   - Projets actuels

4. **Complétude & vérification** (READ)
   - % complétude profil
   - Statut vérifications
   - Éléments manquants

**Navigation** :
- Accessible via : TAB, Menu, Header
- Lien vers Settings : Button "Paramètres" en bas

---

#### ORGANIZATION PROFILE

**Route** : `/organization/:id/profile` (WEB + MOBILE, NEW)

**Sections** :
1. **Identité organisation** (edit)
   - Nom, description
   - Type, slug, pays
   - Logo (NEW)
   - Contact légal

2. **Rôles & membres** (READ)
   - Rôles de l'utilisateur courant
   - Nombre de membres

3. **Vérification** (READ)
   - Statut KYC/vérification

**Navigation** :
- Accessible via : Organization TAB, Menu
- Lien vers Settings (NEW) : Button "Paramètres orga"

---

#### INVESTMENT PROFILE

**Route** : `/investment/profile` (WEB + MOBILE)

**Sections** :
1. **Identité investisseur** (edit)
   - Prénom, nom
   - Email + phone
   - Préférences investisseur (secteurs, pays, ticket)

2. **Accès à la data room** (READ)
   - Consentements
   - Statut accès

**Navigation** :
- Accessible via : Investment TAB, Menu
- Lien vers Settings (NEW) : Button "Paramètres investisseur"

---

### 5.2 — SETTINGS STRUCTURE

**Objectif** : Paramètres centralisés par rôle, répartis en 4-5 sections logiques.

#### FARMER / ORGANIZATION / INVESTMENT SETTINGS

**Réunies en UN SEUL espace Settings** par rôle (NEW pages pour org/invest)

**Route** :
- `/farmer/settings` (WEB + MOBILE)
- `/organization/:id/settings` (WEB + MOBILE, NEW)
- `/investment/settings` (WEB + MOBILE, NEW)

**Sections** :

1. **APPLICATION PREFERENCES**
   - Langue (salvagé, fonctionnel)
   - Thème/apparence (NEW)
   - Notifications globales (toggle app-wide)

2. **NOTIFICATIONS DÉTAILLÉES**
   - Card : "Préférences de notification"
   - Résumé prefs (READ)
   - Button : "Configurer notification" → `/notifications/preferences.tsx`

3. **SÉCURITÉ & COMPTE**
   - MFA : Card avec statut + Button → `/auth/mfa/status` (NEW link)
   - Mot de passe : Form change password (NEW)
   - Sessions actives : List + revoke (NEW backend + UI)
   - SMS consent : Inclus ici (moved from orphan page)

4. **CONFIDENTIALITÉ & DONNÉES**
   - Export données : Button (NEW backend)
   - Suppression compte : Button + confirm modal (NEW UI)
   - Consentements : Synthèse prefs

**Navigation** :
- Accessible via : Header settings button, Menu
- Lien vers Profile : Button "Voir mon profil"

---

#### ADMIN SETTINGS

**Route** : `/admin/settings` (WEB + MOBILE)

**Sections** :
1. Configuration plateforme (READ)
2. Rôles admin (NEW section)
3. Logs & audit (NEW section, si permissions)

---

## SECTION 6 : IDENTIFICATION DES DÉPENDANCES

### 6.1 — Dépendances code à préserver

```
farmer/Profile.tsx
  ├─ authApi.updateMe()
  ├─ authStore.refreshProfile()
  └─ useAuthStore().user

farmer/settings.tsx
  ├─ useI18n() + setLocale() [À fixer: add PATCH]
  ├─ useAuthStore()
  └─ Switch, Toggle, Card (UI réutilisables)

organization/Profile.tsx
  ├─ organizationApi.get() + update()
  └─ queryKeys.organizations

notifications/preferences.tsx [À CONSERVER]
  ├─ notificationApi.preferences()
  └─ Matrice UI réutilisable

auth/mfa.* [À LIER, pas déplacer]
  ├─ authApi.mfaStatus/setup/confirm/disable()
  └─ Rester à /auth/mfa mais lier depuis settings
```

### 6.2 — Dépendances backend à vérifier

```
PATCH /me { locale }
  ✅ Existe (web utilise, mobile pas)
  → À fixer mobile : add PATCH call

PATCH /me { firstName, lastName, phone, whatsapp, ...}
  🟡 Partial (web/mobile utilisent only 2 champs)
  → À tester : acceptance pour poste, domaine, bio

PATCH /me { avatarMediaId }
  ❌ Absent (UI + API à créer)

POST /me/password
  ✅ Exists (UI absent)
  → À implémenter UI

DELETE /me
  ✅ Exists (UI absent)
  → À implémenter UI

GET /auth/sessions + DELETE /auth/sessions/:id
  ❌ Absent (Backend à créer)

POST /data/export
  ❌ Absent (Backend à créer)

PATCH /organizations/:id { name, description, logo... }
  🟡 Partial (name/description OK, logo absent)
  → À tester extension

PUT /investors/me { sectors, countries, ticket, ... }
  ✅ Exists (utilisation minimale)
  → À tester + documenter
```

---

## SECTION 7 : PLAN D'INTERVENTION PRÉCIS

### PHASE 1 : CORRECTIONS IMMÉDIATES (1-2 semaines)

#### 1.1 FIX: Farmer Settings Mobile — Save button + mutations

**Files** : `apps/Mobile/src/app/farmer/settings.tsx`

**Bugs** :
```tsx
// Line 65: Empty onPress
<Button label={t('common.save')} variant="primary" onPress={() => {}} />

// Line 30-32: useState without mutation
const [notifications, setNotifications] = useState(true);
const [digest, setDigest] = useState(false);
const [mfa, setMfa] = useState(false);
```

**Changes** :
1. Remplacer `useState` par `useQuery` (charger prefs actuelles)
2. Créer mutation `updatePreferences` → `notificationApi.preferences()`
3. Mapping UI toggles → API format (type × canal)
4. Toast/snackbar confirmation
5. Test : Mutation + server roundtrip

**Effort** : 3-4h | **Risk** : Bas | **Impact** : Notifications now persist

---

#### 1.2 FIX: Farmer Settings Mobile — Language persistence

**File** : `apps/Mobile/src/app/farmer/settings.tsx` + `i18n/index.ts`

**Bug** :
```tsx
onPress={() => setLocale(option.code)}  // Only local, no PATCH
```

**Changes** :
1. Add mutation `updateLocale` → `authApi.updateMe({ locale })`
2. Modify button: `onPress={() => updateLocale.mutate(code)}`
3. Hydration: Load locale from `/me` at app boot
4. Test: Logout → reload → locale persisted

**Effort** : 2-3h | **Risk** : Très bas | **Impact** : Language persists

---

#### 1.3 FIX: Farmer Settings Mobile — MFA link

**File** : `apps/Mobile/src/app/farmer/settings.tsx`

**Bug** :
```tsx
<Row label={t('ui.doubleAuthentification2fa')} 
     value={mfa} 
     onValueChange={setMfa} />  // READ-ONLY, pas de lien
```

**Changes** :
1. Load real MFA status: `useQuery(...authApi.mfaStatus())`
2. Replace toggle with Card + Button
3. Button → `router.push('/auth/mfa')`
4. Display: "Configurée" (green) ou "Non configurée" (gray)
5. Test: Click button navigates to MFA setup

**Effort** : 1-2h | **Risk** : Bas | **Impact** : MFA discoverable

---

#### 1.4 FIX: Farmer Header — Settings navigation

**File** : `apps/Mobile/src/components/farmer/FarmerHeader.tsx`

**Bug** :
```tsx
onPress={() => router.push('/profil')}  // ❌ Wrong route
```

**Changes** :
1. Change to `/farmer/settings`
2. Test from all contexts (tabs, detail pages, etc.)

**Effort** : 30 min | **Risk** : Très bas | **Impact** : Navigation correct

---

#### 1.5 FIX: Web Farmer Settings — Implicit PATCH

**File** : `apps/web/src/pages/farmer/Settings.tsx`

**Observation** :
- Currently works (locale PATCH works)
- Verify no regression on rebuild

**Changes** : None (verify existing works)

**Effort** : 0 | **Risk** : Verify only | **Impact** : Keep working

---

### PHASE 2 : RESTRUCTURATION & HARMONISATION (2-3 semaines)

#### 2.1 NEW: Organization Settings — WEB + MOBILE

**Files** :
- `apps/web/src/pages/organization/Settings.tsx` (NEW)
- `apps/Mobile/src/app/organization/settings.tsx` (NEW)

**Structure** : Copy farmer/settings + adapt to organization context

**Sections** :
1. Langue orga (if applicable)
2. Notifications orga
3. Sécurité (MFA pour admins)
4. Membres (si prefs plutôt que page séparée)

**Effort** : 6-8h (web + mobile) | **Risk** : Bas (template) | **Impact** : Org settings available

---

#### 2.2 NEW: Investment Settings — WEB + MOBILE

**Files** :
- `apps/web/src/pages/investment/Settings.tsx` (NEW)
- `apps/Mobile/src/app/investment/settings.tsx` (NEW)

**Structure** : Copy farmer/settings

**Effort** : 6-8h | **Risk** : Bas | **Impact** : Investment settings available

---

#### 2.3 RESTRUCTURE: Farmer Profile — Add professional info

**Files** : `apps/web/src/pages/farmer/Profile.tsx` + `apps/Mobile/src/app/farmer/profile.tsx`

**NEW Sections** :
1. Profil professionnel (poste, domaine, spécialité, expérience)
2. Certifications (NEW form)
3. Biographie (NEW textarea)
4. Exploitations (READ: list fermes associées)

**Backend changes required** :
- Verify `PATCH /me` accepts: jobTitle, domain, specialty, yearsExperience, bio, ...
- If not: create new endpoint or extend PATCH

**Effort** : 8-10h (web + mobile) | **Risk** : Moyen (new API fields) | **Impact** : Rich profiles

---

#### 2.4 CONSOLIDATE: Notifications in Settings

**File** : `apps/Mobile/src/app/farmer/settings.tsx` (after 1.1 fix)

**Changes** :
1. Add section : "Préférences de notification"
2. Show summary (e.g. "3 canals, 5 types enabled")
3. Add Button : "Configurer les notifications" → `/notifications/preferences.tsx`
4. Keep `/notifications/preferences.tsx` as detailed config page (don't delete)

**Navigation** : Settings → (summary + link) → Preferences page (detail)

**Effort** : 1-2h | **Risk** : Très bas | **Impact** : Clear navigation

---

#### 2.5 FIX: Orphan SMS Consent page

**File** : `apps/Mobile/src/app/notifications/sms-consent.tsx`

**Changes** :
1. Move content into Settings (Confidentiality section)
2. OR: Link from Settings with Button
3. Delete orphan file OR keep if other routes reference it

**Effort** : 1h | **Risk** : Bas (verify no dangling links) | **Impact** : Cleaned UX

---

#### 2.6 HARMONIZE: Web App Profile → Merge or redirect

**File** : `apps/web/src/pages/app/Profile.tsx`

**Decision** (à valider) :
- Option A : Keep separate (secondary admin view)
- Option B : Redirect to `/farmer/profile` (or role-based)
- Option C : Use `/profil.tsx` publique comme page de synthèse

**Current state** : Duplicates with `/farmer/profile`

**Effort** : 1-2h (refactor + test) | **Risk** : Moyen (navigation) | **Impact** : No confusion

---

### PHASE 3 : NOUVELLES FONCTIONNALITÉS (2-3 semaines)

#### 3.1 NEW: Password change

**Files** : `apps/web/src/pages/farmer/Settings.tsx` + Mobile equivalent

**Component** : NEW `PasswordForm.tsx` (reusable)

**Features** :
- Input: current password, new password, confirm
- Submit → `authApi.changePassword()`
- Validation: strength check, match
- Success: Toast + logout redirect

**Effort** : 3-4h | **Risk** : Moyen (security) | **Impact** : Users can change password

---

#### 3.2 NEW: Profile avatar/photo

**Files** : Profile pages (farmer, organization, investment)

**Features** :
- Image picker (mobile) + file upload (web)
- Upload → mediaApi + get mediaId
- PATCH `/me { avatarMediaId }`
- Display : Avatar next to name

**Backend** : Media upload endpoint (verify exists)

**Effort** : 4-5h | **Risk** : Moyen (upload handling) | **Impact** : Avatar visible everywhere

---

#### 3.3 NEW: Sessions management

**Files** : Settings pages (security section)

**Features** :
- Display: List active sessions (device, location, last login)
- Action: Revoke button per session
- Mutation → `authApi.revokeSession(sessionId)`

**Backend** :
- API: `GET /auth/sessions`, `DELETE /auth/sessions/:id` (create if absent)

**Effort** : 3-4h (UI) + backend DEV | **Risk** : Moyen | **Impact** : Security control

---

#### 3.4 NEW: Data export + Account deletion

**Files** : Settings pages (privacy section)

**Features** :
- Button: "Télécharger mes données" → `authApi.exportData()`
- Button: "Supprimer mon compte" → Confirmation modal → `authApi.deleteAccount()`
- After delete: Redirect to logout + goodbye page

**Backend** :
- API: `POST /data/export` (create if absent)
- Verify: `DELETE /me` exists, understand consequences

**Effort** : 2-3h (UI) + backend DEV | **Risk** : Haut (destructive) | **Impact** : GDPR compliant

---

#### 3.5 NEW: Professional profile completeness

**Features** :
- Display completeness % (identity + professional + exploitations)
- Highlight missing fields
- Quick-edit suggestions

**Effort** : 2-3h (UI) | **Risk** : Bas | **Impact** : Encourage profile completion

---

## SECTION 8 : FICHIERS À MODIFIER / CRÉER

### WEB

| Chemin | Action | Phase | Raison |
|--------|--------|-------|--------|
| `src/pages/farmer/Profile.tsx` | MODIFY | 2 | Add professional sections |
| `src/pages/farmer/Settings.tsx` | VERIFY | 1 | Ensure PATCH locale works |
| `src/pages/organization/Settings.tsx` | CREATE | 2 | NEW |
| `src/pages/investment/Settings.tsx` | CREATE | 2 | NEW |
| `src/pages/app/Profile.tsx` | REVIEW | 2 | Harmonize or redirect |
| `src/components/forms/PasswordForm.tsx` | CREATE | 3 | Reusable form |
| `src/components/forms/ProfileProfessionalForm.tsx` | CREATE | 2 | Reusable form |

### MOBILE

| Chemin | Action | Phase | Raison |
|--------|--------|-------|--------|
| `src/app/farmer/settings.tsx` | FIX | 1 | Save + mutations + language + MFA link |
| `src/app/farmer/profile.tsx` | MODIFY | 2 | Add professional sections |
| `src/app/organization/settings.tsx` | CREATE | 2 | NEW |
| `src/app/organization/profile.tsx` | MODIFY | 2 | Enhance if needed |
| `src/app/investment/settings.tsx` | CREATE | 2 | NEW |
| `src/app/investment/profile.tsx` | MODIFY | 2 | Update professional info |
| `src/app/notifications/sms-consent.tsx` | REVIEW | 2 | Move or link |
| `src/components/farmer/FarmerHeader.tsx` | FIX | 1 | Settings button → correct route |
| `src/components/app/AppHeader.tsx` | MODIFY | 1 | Org/investment settings link |
| `src/components/forms/PasswordForm.tsx` | CREATE | 3 | Reusable form |

### BACKEND

| Endpoint | Status | Phase | Effort |
|----------|--------|-------|--------|
| `PATCH /me { locale, jobTitle, domain, ...}` | Verify | 1-2 | Possibly extend existing |
| `PATCH /me { avatarMediaId }` | ✅ Verify or create | 3 | Confirm exists |
| `POST /me/password` | Verify exists | 1-3 | Use existing |
| `GET /auth/sessions` + `DELETE /auth/sessions/:id` | ❌ CREATE | 3 | New endpoints |
| `POST /data/export` | ❌ CREATE | 3 | New endpoint |
| Verify: `DELETE /me` consequences | Check | 3 | Security audit |

---

## SECTION 9 : CRITÈRES D'ACCEPTANCE

### Phase 1 Completion

- [ ] Farmer settings mobile: notifications persist on PATCH
- [ ] Farmer settings mobile: language persists to server + survives logout
- [ ] MFA: button in settings navigates to `/auth/mfa`
- [ ] Farmer header settings button → `/farmer/settings`
- [ ] No regressions: existing profile edits still work

### Phase 2 Completion

- [ ] `/organization/settings` page exists and works (web + mobile)
- [ ] `/investment/settings` page exists and works (web + mobile)
- [ ] Farmer profile: professional form renders (title, domain, bio, certs)
- [ ] Professional data saves and loads correctly
- [ ] Notifications summary in settings with link to preferences page
- [ ] No dangling SMS consent page (moved or linked)
- [ ] Zero data loss: old profiles still editable

### Phase 3 Completion

- [ ] Password change form functional
- [ ] Avatar upload works (farmer profile displays photo)
- [ ] Sessions list shows active devices
- [ ] Sessions revoke removes from list
- [ ] Export data button downloads user data
- [ ] Delete account button with confirmation (irreversible)
- [ ] All new sections have permission checks (not visible to wrong roles)

---

## SECTION 10 : TESTS DE RÉGRESSION RECOMMANDÉS

```gherkin
Feature: Profile — Farmer Identity
  Scenario: User updates name
    Given user on /farmer/profile
    When I update firstName to "Jean"
    Then API updates user record
    And other pages (/app/profile, /profil) show "Jean"
    And old name never reappears

Feature: Settings — Language
  Scenario: User changes language and logs out
    Given user on /farmer/settings
    When I select locale 'en'
    Then i18n switches to 'en'
    And PATCH /me called with locale
    When I logout and login again
    Then locale is still 'en'

Feature: Settings — Notifications
  Scenario: User configures preferences
    Given user on /farmer/settings
    When I click "Configurer notifications"
    Then navigate to /notifications/preferences
    When I toggle email channel and save
    Then settings page shows updated summary
    And next session loads updated prefs

Feature: Settings — MFA
  Scenario: Disabled user discovers MFA setup
    Given MFA is disabled
    When I go to /farmer/settings
    Then I see "Non configurée"
    When I click "Configurer 2FA"
    Then navigate to /auth/mfa
    And can enable TOTP/backup codes

Feature: Organization — Settings
  Scenario: Org admin updates org settings
    Given user is OWNER on organization X
    When I navigate to /organization/X/settings
    Then I can change org language
    And I can configure org notifications
    When I logout and login as org member
    Then I see same org settings (or appropriate permissions)

Feature: Security — Change Password
  Scenario: User changes password
    Given user on /farmer/settings
    When I click "Changer mot de passe"
    When I enter old + new password
    Then API validates old password
    And new password is set
    And next login uses new password

Feature: Privacy — Export Data
  Scenario: User exports personal data
    Given user on /farmer/settings
    When I click "Télécharger mes données"
    Then download initiated
    When I extract ZIP
    Then it contains: profile.json, farms.json, ...

Feature: Privacy — Delete Account
  Scenario: User deletes account
    Given user on /farmer/settings
    When I click "Supprimer mon compte"
    Then confirmation modal shown
    When I confirm deletion
    Then account is marked as deleted
    And next login fails with "account deleted" message
```

---

## SECTION 11 : POINTS DE VIGILANCE

### Risques majeurs

1. **Data loss** : Vérifier ancien data conservé lors restructure farmer/profile
2. **Language reset** : Si locale load from /me en hydration échoue, utiliser FR comme fallback
3. **Navigation loops** : Settings button → Settings page (ne pas loop sur profil)
4. **Permission checks** : ORGANIZATION/INVESTMENT settings visibles seulement si right role
5. **Multi-device** : Settings changes on device A doivent refléter on device B (use refresh)
6. **Offline mode** : Si app offline, settings toggles ne sauvent pas (clear UX)

### À tester systématiquement

- [ ] Cross-device behavior (settings A, reload B, verify sync)
- [ ] Permission enforcement (FARMER cannot access ORG settings)
- [ ] Performance (no N+1 queries when loading large profiles)
- [ ] Mobile keyboard handling (long form doesn't break UX)
- [ ] Dark mode (if applicable)
- [ ] Accessibility (labels, ARIA, screen reader)

---

## CONCLUSION

AgriKonnect Africa a les **foundations solides** (backend APIs exist, most features work) mais souffre de **fragmentation et bugs** (settings mobile non-fonctionnel, navigation confuse, features incomplètes).

Le plan proposé consolide ces espaces en 3 phases :
1. **Phase 1** (1-2w) : Fix bugs immédiat + navigation
2. **Phase 2** (2-3w) : Restructurer + harmoniser web/mobile + org/investment
3. **Phase 3** (2-3w) : Nouvelles features (password, avatar, sessions, export)

**Résultat final** : PROFILE et SETTINGS clairs, complets, harmonisés et fonctionnels sur web + mobile, tous rôles.

---

**Rapport audit terminé. ✅ Prêt pour validation avant implémentation.**
