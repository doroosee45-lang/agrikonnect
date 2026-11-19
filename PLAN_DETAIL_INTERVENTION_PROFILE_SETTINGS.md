# PLAN DÉTAILLÉ D'INTERVENTION — PROFILE & SETTINGS

**État :** Approuvé après audit  
**Exécution :** À valider avant modification du code

---

## PHASE 1 : CORRECTIONS IMMÉDIATES (Bugs)

### 1.1 — FIX: Notifications FARMER SETTINGS (non-persistance)

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx`

**Problème :**
```tsx
// Ligne 51 : Button → onPress={() => {}} // VIDE
<Button label={t('common.save')} variant="primary" onPress={() => {}} />
```

**Intervention :**

| Étape | Composant | Action | Fichier | Raison |
|-------|-----------|--------|---------|--------|
| 1 | Save mutation | Créer mutation réelle | settings.tsx | Remplacer `onPress={() => {}}` |
| 2 | API call | `notificationApi.setPreferences()` | endpoints.ts | Vérifier existence |
| 3 | État local | Mapper toggles → prefs format | settings.tsx | Input format API |
| 4 | Ui Feedback | Toast/message succès | settings.tsx | Confirm persistence |
| 5 | Tests | Tester mutation + server | tests/ | Verify roundtrip |

**Pseudo-code avant :**
```tsx
const save = useMutation({
  mutationFn: () => ???, // VIDE
  onSuccess: () => setNotifications, // NE PERSISTE RIEN
});
```

**Pseudo-code après :**
```tsx
const save = useMutation({
  mutationFn: () => notificationApi.setPreferences([
    { type: 'order.status', channel: 'PUSH', enabled: notifications },
    { type: 'order.status', channel: 'EMAIL', enabled: digest },
    { type: 'order.status', channel: 'SMS', enabled: mfa },
    // ... ou utiliser mapping réel depuis API
  ]),
  onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
});
```

**Effort :** 2h  
**Risque :** Bas (feature isolated)

---

### 1.2 — FIX: Langue persistance serveur

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx` + `apps/Mobile/src/i18n/index.ts`

**Problème :**
- `setLocale()` → i18n store seulement
- Aucun PATCH /me avec `{ locale }`
- Notifications serveur restent en français

**Intervention :**

| Étape | Composant | Action | Fichier |
|-------|-----------|--------|---------|
| 1 | i18n store | Ajouter `setLocaleAndPersist()` | i18n/index.ts |
| 2 | Mutation | Créer mutation `updateLocale` | settings.tsx |
| 3 | PATCH /me | Vérifier backend accepte `locale` | endpoints.ts + backend |
| 4 | Hydration | Charger `locale` depuis /me au boot | _layout.tsx |
| 5 | Tests | Vérifier persistence cross-session | tests/ |

**Pseudo-code :**
```tsx
// i18n/index.ts
export function setLocaleAndPersist(code: string) {
  setLocale(code);
  authApi.updateMe({ locale: code }); // NEW
}

// settings.tsx
const updateLocale = useMutation({
  mutationFn: (code: string) => authApi.updateMe({ locale: code }),
  onSuccess: () => setLocale(code), // AFTER server confirms
});

// PressableScale.onPress → updateLocale.mutate(code)
```

**Backend check :**
- `authApi.updateMe()` accepte-t-il `locale` ?
- `/me` retourne-t-il `locale` ?

**Effort :** 3h  
**Risque :** Bas si backend prêt

---

### 1.3 — FIX: MFA dans SETTINGS → Lien vers `/auth/mfa/status`

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx`

**Problème :**
- Toggle MFA READ-ONLY : `onValueChange={setMfa}` mais `save` est vide
- Aucun lien pour configurer

**Intervention :**

| Étape | Composant | Action |
|-------|-----------|--------|
| 1 | UI | Remplacer toggle par Card cliquable |
| 2 | Navigation | Ajouter Button → `/auth/mfa/status` |
| 3 | Affichage | Charger vrai statut MFA via `authApi.mfaStatus()` |
| 4 | Texte | Mettre à jour message → invite setup si disabled |
| 5 | Tests | Vérifier lien fonctionne |

**Pseudo-code :**
```tsx
// Remplacer Row mfa par :
const mfaStatus = useQuery({
  queryKey: ['auth', 'mfa', 'status'],
  queryFn: () => authApi.mfaStatus(),
});

<Card tone={mfaStatus.data?.enabled ? 'white' : 'pale'}>
  <View style={styles.row}>
    <View style={styles.mfaBody}>
      <Text preset="bodyMedium">{t('ui.doubleAuthentification')}</Text>
      <Text preset="caption" color={COLORS.slateGray}>
        {mfaStatus.data?.enabled 
          ? t('ui.activee') 
          : t('ui.desactiveeRecommandee')}
      </Text>
    </View>
  </View>
  <Button
    label={mfaStatus.data?.enabled ? t('ui.modifier') : t('ui.activer')}
    variant="outline"
    size="sm"
    onPress={() => router.push('/auth/mfa/status')}
  />
</Card>
```

**Effort :** 2h  
**Risque :** Bas

---

## PHASE 2 : RESTRUCTURATION LOGIQUE

### 2.1 — RESTRUCTURE: `/farmer/profile` → Sections clarifiées

**Fichier :** `apps/Mobile/src/app/farmer/profile.tsx`

**Objectif :** Transformer page réduite (nom+prénom) en profil professionnel complet

**Sections NEW :**
1. Identité personnelle (TODAY: nom+prénom) → STAY
2. Informations professionnelles (NEW) → poste, domaine, expérience
3. Vérification & complétude (NEW) → statut verification, % complet
4. Profil public (NEW) → biographie, exploit publiques

**Intervention :**

| Section | Action | Fichier | Effort |
|---------|--------|---------|--------|
| Ident. perso | Restructurer Card existante | profile.tsx | 1h |
| Profil pro | NEW Form (poste, domaine, etc.) | profile.tsx + types | 4h |
| Verif. | READ : charger `/me` data | profile.tsx | 1h |
| Public | NEW Form : biographie + toggles exploit | profile.tsx | 3h |

**Structure proposée :**
```tsx
export default function FarmerProfile() {
  // === IDENTITY ===
  <Section title={t('ui.identitePersonnelle')}>
    <Card> firstName, lastName, photo, email, phone </Card>
  </Section>

  // === PROFESSIONAL ===
  <Section title={t('ui.profilProfessionnel')}>
    <Card> poste, domaine, expérience, bio </Card>
  </Section>

  // === VERIFICATION ===
  <Section title={t('ui.verification')}>
    <Card> niveau, statut, critères manquants (READ) </Card>
  </Section>

  // === PUBLIC PROFILE ===
  <Section title={t('ui.profilPublic')}>
    <Card> biographie publique, exploitations listées </Card>
  </Section>
}
```

**API à ajouter :**
- Backend: PATCH /me avec `{ jobTitle, domain, experience, publicBio, ... }`
- Ou scinder en `/me/professional` PATCH séparé

**Effort total :** 9h  
**Risque :** Moyen (nouveau contenu)  
**Test :** Vérifier aucun data perte, fields optionnels

---

### 2.2 — NEW: `/farmer/settings` → Sections organisées

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx`

**Objectif :** Transformer page confetti en settings cohérent + link vers MFA/notifications

**Sections :**

```
1. PREFERENCES APP
   ├─ Langue (TODAY: buggy → FIX per 1.2)
   └─ Thème (NEW)

2. NOTIFICATIONS
   ├─ Résumé prefs (READ)
   └─ Button → /notifications/preferences (page complète)

3. SECURITE & COMPTE
   ├─ MFA (TODAY: buggy → FIX per 1.3)
   ├─ Mot de passe (NEW → form)
   ├─ Sessions actives (NEW)
   └─ Consentements SMS (NEW → moved from orphan)

4. CONFIDENTIALITE
   ├─ Export données (NEW)
   └─ Supprimer compte (NEW)
```

**Pseudo-code :**
```tsx
export default function FarmerSettings() {
  return (
    <Section>
      {/* PREFS APP */}
      <Card>
        <LanguageSelector {...} />
        <ThemeSelector {...} /> {/* NEW */}
      </Card>

      {/* NOTIFICATIONS */}
      <Card>
        <PreferencesPreview {...} /> {/* READ */}
        <Button → /notifications/preferences />
      </Card>

      {/* SECURITE */}
      <Card>
        <MFACard {...} /> {/* FIX: add button to /auth/mfa */}
        <PasswordForm {...} /> {/* NEW */}
        <SessionsList {...} /> {/* NEW */}
        <SMSConsentForm {...} /> {/* NEW: moved from orphan */}
      </Card>

      {/* CONFIDENTIALITE */}
      <Card>
        <ExportButton {...} /> {/* NEW */}
        <DeleteAccountButton {...} /> {/* NEW */}
      </Card>
    </Section>
  );
}
```

**Effort :** 12h (incluant nouvelles forms)  
**Risque :** Moyen

---

### 2.3 — NEW: `/organization/settings` PAGE

**Fichier :** `apps/Mobile/src/app/organization/settings.tsx` (NEW)

**Sections :**
1. Préférences orga (langue, notifications)
2. Rôles & permissions (READ)
3. Sécurité (MFA, sessions)

**Copier structure `/farmer/settings` + adapter contexte organization**

**Effort :** 6h (réutilisation) + 2h intégration = 8h  
**Risque :** Bas (template)

---

### 2.4 — NEW: `/investment/settings` PAGE

**Fichier :** `apps/Mobile/src/app/investment/settings.tsx` (NEW)

**Sections :** Identiques à `/farmer/settings`

**Effort :** 6h (copie + test)  
**Risque :** Bas

---

### 2.5 — REORGANIZE: Routes de navigation

**Fichiers :**
- `apps/Mobile/src/components/farmer/FarmerHeader.tsx`
- `apps/Mobile/src/components/app/AppHeader.tsx`

**Objectif :** Liens cohérents vers PROFILE + SETTINGS

**Modifications :**

| Composant | Action | Raison |
|-----------|--------|--------|
| FarmerHeader | Bouton settings → `/farmer/settings` | TODAY: pointe `/profil` (confusion) |
| AppHeader | Ajouter bouton settings vers page orga/invest | Navigation manquante |

**Pseudo-code :**
```tsx
// FarmerHeader
<IconButton 
  icon="settings-outline" 
  onPress={() => router.push('/farmer/settings')} 
  accessibilityLabel={t('ui.parametres')} 
/>

// AppHeader (organization/investment)
<IconButton 
  icon="settings-outline" 
  onPress={() => router.push(`${context}/settings`)} // /organization/settings or /investment/settings
  accessibilityLabel={t('ui.parametres')} 
/>
```

**Effort :** 1h  
**Risque :** Bas

---

## PHASE 3 : NOUVELLES FONCTIONNALITÉS

### 3.1 — Photo de profil (upload avatar)

**Fichiers :**
- `apps/Mobile/src/app/farmer/profile.tsx`
- `apps/Mobile/src/services/api/endpoints.ts`
- Backend: media upload endpoint (si absent)

**Pseudo-code :**
```tsx
// profile.tsx
<ImagePickerButton 
  onSelect={(mediaId) => {
    updateMe.mutate({ avatarMediaId: mediaId });
  }}
/>
```

**Effort :** 4h (image picker + upload)  
**Risque :** Moyen (nouveau endpoint possible)

---

### 3.2 — Mot de passe

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx` ou NEW `/farmer/settings/security.tsx`

**Pseudo-code :**
```tsx
<PasswordForm 
  onSubmit={(current, newPw) => {
    authApi.changePassword({ 
      currentPassword: current, 
      newPassword: newPw,
      mfaCode: mfaRequired ? userInput : undefined
    });
  }}
/>
```

**Effort :** 3h  
**Risque :** Bas

---

### 3.3 — Sessions actives

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx`

**Besoin API :** GET /auth/sessions (liste) + DELETE /auth/sessions/:id (revoke)

**Pseudo-code :**
```tsx
const sessions = useQuery({
  queryKey: ['auth', 'sessions'],
  queryFn: () => authApi.sessions(),
});

sessions.data.map(session => (
  <Card>
    <Text>{session.device} · {session.location}</Text>
    <Button 
      label={t('ui.revoquer')} 
      onPress={() => authApi.revokeSession(session.id)} 
    />
  </Card>
));
```

**Effort :** 2h (UI) + backend DEV (si absent)  
**Risque :** Dépend backend

---

### 3.4 — Export données + suppression compte

**Fichier :** `apps/Mobile/src/app/farmer/settings.tsx`

**Pseudo-code :**
```tsx
<Button 
  label={t('ui.telechargerMesDonnees')} 
  onPress={() => authApi.exportData()} 
/>

<Button 
  label={t('ui.supprimerMonCompte')} 
  onPress={() => { /* confirmation modal */ authApi.deleteAccount(); }}
/>
```

**Effort :** 2h (UI) + backend DEV (si absent)  
**Risque :** Dépend backend

---

## FICHIERS À MODIFIER / CRÉER

### À MODIFIER (existants)

| Chemin | Raison | Phase |
|--------|--------|-------|
| `apps/Mobile/src/app/farmer/settings.tsx` | Fixer bugs + restructurer | 1 + 2 |
| `apps/Mobile/src/app/farmer/profile.tsx` | Ajouter sections pro + public | 2 |
| `apps/Mobile/src/i18n/index.ts` | Ajouter persistance locale | 1 |
| `apps/Mobile/src/components/farmer/FarmerHeader.tsx` | Lien settings correct | 2 |
| `apps/Mobile/src/components/app/AppHeader.tsx` | Lien settings pour orga/invest | 2 |

### À CRÉER (nouveaux)

| Chemin | Raison | Phase |
|--------|--------|-------|
| `apps/Mobile/src/app/organization/settings.tsx` | NEW Settings orga | 2 |
| `apps/Mobile/src/app/investment/settings.tsx` | NEW Settings invest | 2 |
| `apps/Mobile/src/components/forms/PasswordForm.tsx` | Form réutilisable | 3 |
| `apps/Mobile/src/components/forms/ProfileProfessionalForm.tsx` | Form profil pro | 2 |
| `apps/Mobile/src/components/settings/SecurityCard.tsx` | Card MFA + sessions | 2 |
| `apps/Mobile/src/components/settings/NotificationsCard.tsx` | Card notif + lien | 2 |
| `apps/Mobile/src/components/settings/PrivacyCard.tsx` | Card export + delete | 3 |

### À VÉRIFIER/COMPLÉTER (Backend)

| Endpoint | Statut | Phase |
|----------|--------|-------|
| PATCH /me avec `{ locale }` | ❓ Vérifier | 1 |
| PATCH /me avec `{ locale, jobTitle, domain, ...}` | ❌ Creer ? | 2 |
| PUT /auth/sessions/:id/revoke | ❌ Creer | 3 |
| GET /auth/sessions | ❌ Creer | 3 |
| POST /data/export | ❌ Creer | 3 |
| POST /auth/delete-account | ❌ Creer | 3 |

---

## TIMELINE GLOBALE

| Phase | Durée | Dépendance |
|-------|-------|-----------|
| Phase 1 (bugs) | 1 semaine | Aucune |
| Phase 2 (struct) | 1 semaine | Phase 1 ✅ |
| Phase 3 (features) | 1-2 semaines | Phase 2 ✅ + backend |

**Total :** 3-4 semaines (1 développeur)

---

## CRITÈRES D'ACCEPTANCE

### Phase 1

- [ ] Notifications farmer settings → mutatent + server persists
- [ ] Langue → PATCH /me + server responds
- [ ] MFA → Button vers `/auth/mfa/status` fonctionne

### Phase 2

- [ ] `/farmer/profile` → 4 sections visibles + formes fonctionnelles
- [ ] `/organization/settings` → nouvelle page fonctionnelle
- [ ] `/investment/settings` → nouvelle page fonctionnelle
- [ ] Navigation → settings buttons pointent bonnes routes
- [ ] Zero data loss = old data still visible + editable

### Phase 3

- [ ] Upload photo → avatar change immédiatement
- [ ] Mot de passe → form fonctionne + route API respond
- [ ] Sessions → liste + revoke action
- [ ] Export/delete → confirmations, non-reversible warnings

---

## TESTS RECOMMANDÉS

```gherkin
Feature: Profile - Identity Management
  Scenario: User updates name
    Given user on /farmer/profile
    When I update firstName to "Jean"
    Then API updates firstName
    And /me returns new firstName

Feature: Settings - Notifications
  Scenario: User saves notification preferences
    Given user on /farmer/settings
    When I toggle notification → SMS
    And click Save
    Then API setPreferences called
    And preferences persisted

Feature: Settings - Language
  Scenario: User changes language
    Given locale = 'fr'
    When I select locale 'en'
    Then i18n switches to 'en'
    And PATCH /me called with locale
    And server stores preference
    And next session loads 'en'

Feature: Settings - MFA
  Scenario: User navigates to MFA setup
    Given user on /farmer/settings
    When I click "Configurer 2FA"
    Then navigate to /auth/mfa/status
    And can enable/disable MFA
```

---

## POINTS DE VIGILANCE

### Risques majeurs

1. **Data loss** : Vérifier ancien data conservé lors restructure `/farmer/profile`
2. **Navigation** : Tester liens depuis tous contextes (tabs, profil public, etc.)
3. **Multi-language** : Vérifier traductions nouvelles clés i18n

### À tester systématiquement

- Cross-device behavior (preferences sur appareil A, charger sur appareil B)
- Offline mode (settings cached? Sync OK?)
- Permissions (FARMER ne peut pas accéder `/organization/settings`)
- Performance (pas de N+1 queries)

---

## SIGN-OFF VALIDATIONS AVANT DÉMARRAGE

**À valider par PM :**
- [ ] Acceptation architecture cible
- [ ] Priorité des phases
- [ ] Budget backend (endpoints manquants)

**À valider par Tech Lead :**
- [ ] Faisabilité timeline
- [ ] Pas de conflits avec tâches parallèles
- [ ] Choix tech (forms, navigation, etc.)

**À valider par QA :**
- [ ] Jeux de test complets
- [ ] Critères acceptance

---

**FIN DU PLAN D'INTERVENTION**
