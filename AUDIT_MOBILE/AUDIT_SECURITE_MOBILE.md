# Audit de sécurité — Application mobile AGRIKONNECT AFRICA

**Référence :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md).

**Méthode :**
- lecture du code ;
- introspection de la configuration native générée (`expo config --type introspect`, copie isolée, en mémoire) ;
- `npm audit` sur une copie du lockfile ;
- reproduction isolée du défaut de rejeu.

Aucun secret n'est reproduit dans ce document.

Convention : **[IMPL]** = protection réellement implémentée ; **[À FAIRE]** = protection absente ou insuffisante ; **[BACKEND]** = contrôle qui doit impérativement rester côté serveur.

---

## 1. Synthèse

| Domaine | Niveau | Points clés |
|---|---|---|
| Stockage local | À AMÉLIORER | **[IMPL]** Les jetons sont dans SecureStore et exclus des sauvegardes Android. **[À FAIRE]** Profil complet stocké, survie au Keychain iOS, `localStorage` sur l'export web |
| Session et jetons | **NON CONFORME** | Rejeu cassé (C01), déconnexion sur coupure réseau (E10), cache non purgé (E09), pas de refresh proactif |
| Contrôle d'accès UI | **NON CONFORME** | Aucune garde de rôle (E05), toutes les routes sont exposées en lien profond |
| Communications | **NON CONFORME** | URL HTTP `localhost` par défaut, `NSAllowsArbitraryLoads: true` sur iOS, pas d'épinglage (E11, F12) |
| Permissions | **NON CONFORME** | 8 permissions Android et 4 textes d'usage iOS sans fonctionnalité associée (M13) |
| Dépendances | À AMÉLIORER | 11 vulnérabilités (3 élevées), 13 paquets en retard sur le SDK (M15) |
| Liens profonds | À AMÉLIORER | Schéma personnalisé seul, `next` non validé (M09, F07), routes admin ouvrables |
| Journalisation | CONFORME | Un seul `console.error` (boundary), aucun jeton ni corps de requête journalisé |
| Secrets dans le bundle | CONFORME | Aucune clé ni aucun secret. Seules `EXPO_PUBLIC_API_BASE_URL` et `EXPO_PUBLIC_REALTIME_URL` sont injectées (`.env.example` : valeurs vides) |
| XSS / injection | CONFORME | React Native n'interprète pas de HTML. Aucun `WebView`, `eval` ou `dangerouslySetInnerHTML` |
| Captures d'écran | NON IMPLÉMENTÉ | Aucune protection (`FLAG_SECURE` ou équivalent) sur les écrans sensibles (codes de secours MFA, clés API affichées une seule fois) |

---

## 2. Stockage des données

| Donnée | Emplacement | Preuve | Évaluation |
|---|---|---|---|
| Jeton d'accès | SecureStore (natif) / `localStorage` (web) | `session.ts:42`, `secure-storage.ts:12-15,23-27` | **[IMPL]** Keychain/Keystore. **[À FAIRE]** Sur le web, il est exposé au JS de la page |
| Jeton de rafraîchissement | Idem | `session.ts:43` | Idem. Durée longue, donc impact plus fort en cas de vol |
| Profil utilisateur (JSON complet avec organisations) | SecureStore | `session.ts:100-103`, `store/auth.ts:44,78,159` | **[À FAIRE]** Minimiser. SecureStore signale les valeurs > 2 048 octets (hypothèse de dépassement : MOB-F06) |
| Locale | SecureStore | `i18n/index.ts:63,68` | Non sensible (SecureStore inutilement coûteux) |
| Organisation active | `globalThis.localStorage` | `redirects.ts:121-137` | Natif : sans effet (MOB-M18). Web : persistée, jamais purgée |
| Cache TanStack | Mémoire | `services/query.ts:26-39` | **[À FAIRE]** Purge à la déconnexion (MOB-E09) |
| Identifiants MFA en attente | Mémoire Zustand (`pendingMfa`) | `store/auth.ts:26,122` | Acceptable : mémoire seule, purgée à `clearPendingMfa` et à `logout` |
| Codes de secours MFA, clés API, clés d'appareil IoT | Affichés une seule fois | `auth/mfa.tsx`, `developers/index.tsx`, `sensors.tsx` | **[À FAIRE]** Bloquer la capture d'écran, et ne pas proposer de copie sans avertissement |

**Sauvegardes Android (introspection) :**
- `android:allowBackup="true"` ;
- `fullBackupContent="@xml/secure_store_backup_rules"` et `dataExtractionRules="@xml/secure_store_data_extraction_rules"` : SecureStore est exclu **[IMPL]**.

**iOS :** les éléments du Keychain survivent à la désinstallation. Une réinstallation peut donc retrouver une session. **[À FAIRE]** purger au premier lancement (MOB-F06).

**Erreurs de stockage :** `secure-storage.ts:28-30,40-42` absorbe silencieusement les échecs. L'application continue en mémoire sans le signaler (acceptable, mais à journaliser).

---

## 3. Authentification et session

| Contrôle | Implémentation | Statut |
|---|---|---|
| Connexion et MFA TOTP | `authApi.login` avec `mfaCode`, `RequestError.mfaRequired` | **[IMPL]** |
| Refresh rotatif à vol unique | `session.ts:73-97` | **[IMPL]** mais **défaillant** au rejeu (C01) |
| Rejeu après refresh | `http.ts:93-118` | **CRITIQUE** : données vides, permissions perdues au démarrage |
| Coupure réseau pendant le refresh | `session.ts:88-90` | **ÉLEVÉ** : déconnexion (E10) |
| Démarrage hors ligne | `store/auth.ts:86-91` : repli `authenticated` sur le profil en cache avec `permissions: []` | À AMÉLIORER : statut « authentifié » sans permissions, ce qui mène à des destinations erronées |
| Déconnexion | `store/auth.ts:145-154` : serveur, puis jetons, puis profil | **[À FAIRE]** Purger le cache, le contexte d'organisation et le socket (E09) |
| Expiration proactive | `isFresh()` existe mais n'est jamais appelé ; `restore()` met `expiresAt=null` | **[À FAIRE]** |
| Verrouillage local (biométrie, code) | Absent | NON IMPLÉMENTÉ (recommandé pour les profils administrateur et investisseur) |
| Inscription | Rôles AGRONOMIST et SUPPORT_AGENT proposés (`platform.ts:136-146`) | **ÉLEVÉ** (E13) + **[BACKEND]** |

---

## 4. Contrôle d'accès

**Fait vérifié :**
- `SessionGate` (`_layout.tsx:98-133`) protège 14 racines sur le seul critère « authentifié » ;
- `AuthGate` (154 écrans) applique le même critère ;
- `can()` et `hasAnyRole()` ne sont utilisés qu'une fois (`admin/users/[id].tsx:38-39`).

**Conséquences :**
- tout utilisateur connecté peut ouvrir n'importe quel écran (`agrikonnect://admin/security`, `…/admin/users/ID`) ;
- les données restent protégées par le backend (403), mais la structure des écrans d'administration et les actions disponibles sont visibles.

| Contrôle | Front mobile | Doit être garanti par le backend |
|---|---|---|
| Accès aux écrans d'un espace | **[À FAIRE]** RoleGate (E05) | — |
| Accès aux données et actions | Aucun (et ce n'est pas son rôle) | **[BACKEND]** `authorize(...)` + `resolveTenant` (en place, constaté sur les modules consultés) |
| Choix du rôle à l'inscription | Filtrer l'interface (E13) | **[BACKEND]** Liste blanche des rôles en libre-service |
| Contexte d'organisation | En-tête `X-Organization-Id` (inopérant sur natif, M18) | **[BACKEND]** Vérifier l'appartenance (`middleware/tenant.js`) |
| Données publiques | `/public/*` | **[BACKEND]** Arrondi des coordonnées, k-anonymat |

---

## 5. Communications réseau

| Point | Preuve | Statut |
|---|---|---|
| URL par défaut | `http://localhost:4000/api/v1` (`config.ts:17-21`, `app.json:57`) | **ÉLEVÉ** (E11) |
| ATS iOS | Introspection : `NSAllowsArbitraryLoads: true` + exception localhost | **ÉLEVÉ** : HTTP en clair accepté vers tout domaine, jetons compris |
| HTTP en clair Android | Introspection : pas de `usesCleartextTraffic` dans `<application>` → bloqué en release (comportement Android 9+, build release non exécuté) | Divergence entre plateformes : Android échoue là où iOS transmet en clair |
| TLS / épinglage | Aucun | FAIBLE (F12), à décider selon le modèle de menace |
| Socket.IO | `transports: ['websocket']`, jeton dans le handshake (`realtime.ts:67-75`) | **[IMPL]**. Le jeton n'apparaît pas dans l'URL. Il est figé à la connexion (M01) |
| Téléchargements | `Linking.openURL(adminApi.exportFarms())` (`admin/reports.tsx:28`) | URL ouverte dans le navigateur système sans jeton (M10). Ne pas y mettre de jeton en paramètre de requête |
| Délais | 15 s, 20 s et 60 s | **[IMPL]** |

---

## 6. Configurations Android et iOS (introspection, fait vérifié)

### Android

| Élément | Valeur générée | Évaluation |
|---|---|---|
| package | `africa.agrikonnect.mobile` | OK |
| Permissions | INTERNET, **SYSTEM_ALERT_WINDOW**, VIBRATE, **READ_EXTERNAL_STORAGE**, **WRITE_EXTERNAL_STORAGE**, **CAMERA**, **ACCESS_FINE_LOCATION**, **ACCESS_COARSE_LOCATION** | 6 en gras sont sans usage (M13). SYSTEM_ALERT_WINDOW et stockage externe proviennent du modèle par défaut : les bloquer (`android.blockedPermissions`) |
| Intent filters | MAIN/LAUNCHER + VIEW/BROWSABLE `agrikonnect://` | Pas d'App Links vérifiés (`autoVerify`) : n'importe quelle application peut revendiquer le schéma |
| allowBackup | `true`, règles excluant SecureStore | OK |
| supportsRtl | `true` | Sans incidence (pas de RTL prévu) |
| enableOnBackInvokedCallback | `false` | Retour prédictif désactivé |
| minSdk / targetSdk / Kotlin / Gradle | Non présents dans la configuration | **NON VÉRIFIABLE** : défauts du SDK 58. `expo prebuild` jetable nécessaire |

### iOS

| Élément | Valeur générée | Évaluation |
|---|---|---|
| bundleIdentifier | `africa.agrikonnect.mobile` | OK |
| NSAppTransportSecurity | `NSAllowsArbitraryLoads: true` | **À corriger** (E11) |
| Textes d'usage | Caméra, photos, localisation (`app.json:16-18`) + **NSFaceIDUsageDescription** (plugin secure-store) | Sans fonctionnalité associée (M13) |
| URL schemes | `agrikonnect`, `africa.agrikonnect.mobile` | Pas de liens universels (Associated Domains absents : `entitlements: {}`) |
| Orientations | iPhone : portrait. **iPad : 4 orientations**, `UIRequiresFullScreen: false` | F02 |
| Version iOS minimale, Podfile, signature, capacités | Non présents | **NON VÉRIFIABLE** : pas de dossier `ios/`, pas d'`eas.json` |

---

## 7. Liens profonds

- Le schéma `agrikonnect` (`app.json:7`) plus Expo Router rendent **chaque fichier de `src/app` ouvrable par URL**, y compris `/admin/*`.
- `SessionGate` impose la connexion, mais pas le rôle (E05).
- **Paramètre `next` (`login.tsx:16,54`) :**
  - il est réutilisé sans validation ;
  - il est construit avec `useSegments` (`_layout.tsx:121`), ce qui produit des chemins `[id]` littéraux (M09) ;
  - la possibilité de passer une URL externe à `router.replace` est une **hypothèse** à vérifier (F07).
- **Paramètres sensibles :**
  - `reset-password` n'exploite pas encore de jeton par lien (M20) ;
  - une fois implémenté, le jeton ne devra jamais être journalisé, et la route devra l'effacer de l'historique (`router.replace`).
- **Recommandation :** liens universels (iOS) et App Links vérifiés (Android) pour les liens d'e-mail, plus une liste blanche des routes ouvrables depuis l'extérieur.

---

## 8. Dépendances (fait vérifié)

**`npm audit --omit=dev`** : 11 vulnérabilités (1 faible, 7 modérées, 3 élevées).

| Paquet | Sévérité | Chargé à l'exécution dans l'application ? |
|---|---|---|
| follow-redirects (via axios) | Élevée : en-têtes sensibles et identifiants suivant les redirections | **Oui**, client HTTP |
| zod | Élevée : épuisement mémoire | Non : dépendance déclarée mais jamais importée dans `src/` |
| @expo/cli (glob, zod, metro-config) | Élevée | Non : outil de build |
| glob, minimatch, deepmerge, node-forge, @expo/config* | Modérée / faible | Non : outillage |

**`expo install --check`** : 13 paquets en retard sur les versions attendues par le SDK 58 :
- `expo` 58.0.21 → ~58.0.25 ;
- `expo-router` 58.0.28 → ~58.0.31 ;
- `expo-secure-store` 58.0.2 → ~58.0.3 ;
- `react-native-safe-area-context` 5.10.1 → ~5.11.1 ;
- `react-native-screens` 4.30.0 → ~4.30.1 ;
- et 8 autres modules `expo-*`.

**Dépendances natives :** toutes proviennent de l'écosystème Expo ou Software Mansion (reanimated, gesture-handler, screens, svg, worklets). Aucun module natif tiers non maintenu n'a été identifié.

---

## 9. Fuites de données possibles

| ID | Scénario | Réf. |
|---|---|---|
| L1 | Appareil partagé : l'utilisateur B voit le cache de A | MOB-E09 |
| L2 | URL HTTP en production iOS : jetons et données en clair | MOB-E11 |
| L3 | Export web : jetons lisibles par tout script (`localStorage`) | §2 |
| L4 | Capture d'écran ou aperçu multitâche des codes MFA et des clés API | §1 |
| L5 | Écrans « publics » qui affichent des commandes privées d'un utilisateur connecté | MOB-E07 / A11 |
| L6 | Réinstallation iOS : session restaurée depuis le Keychain | MOB-F06 |

---

## 10. Vulnérabilités identifiées : récapitulatif

| ID | Vulnérabilité | Criticité | Plateforme |
|---|---|---|---|
| MOB-C01 | Rejeu après refresh qui casse session et permissions | CRITIQUE | A+I+W |
| MOB-E05 | Absence de garde de rôle dans l'interface | ÉLEVÉ | A+I |
| MOB-E09 | Cache non purgé à la déconnexion | ÉLEVÉ | A+I+W |
| MOB-E10 | Déconnexion forcée sur erreur réseau | ÉLEVÉ | A+I |
| MOB-E11 | HTTP par défaut, ATS permissif | ÉLEVÉ | I (A : échec) |
| MOB-E12 | Interrupteur 2FA factice | ÉLEVÉ | A+I |
| MOB-E13 | Rôles sensibles en libre-service | ÉLEVÉ | A+I+W |
| MOB-M01 | Jeton de socket figé | MOYEN | A+I |
| MOB-M09 | `next` non validé, construit depuis `useSegments` | MOYEN | A+I |
| MOB-M10 | Téléchargement authentifié via le navigateur | MOYEN | A+I |
| MOB-M13 | Permissions excessives | MOYEN | A+I |
| MOB-M15 | Dépendances vulnérables ou en retard | MOYEN | A+I |
| MOB-M18 | Contexte d'organisation non géré sur natif / persistant sur le web | MOYEN | A+I+W |
| MOB-F06 | Profil volumineux en SecureStore, persistance du Keychain | FAIBLE | A+I |
| MOB-F07 | Redirection `next` vers une URL externe (hypothèse) | FAIBLE | A+I |
| MOB-F12 | Pas d'épinglage TLS | FAIBLE | A+I |
| — | Pas de protection contre la capture d'écran (codes MFA, clés) | FAIBLE | A+I |

Les corrections et leur ordre figurent dans [PLAN_CORRECTION_REACT_NATIVE.md](PLAN_CORRECTION_REACT_NATIVE.md) (phases 0 et 1 pour la sécurité).
