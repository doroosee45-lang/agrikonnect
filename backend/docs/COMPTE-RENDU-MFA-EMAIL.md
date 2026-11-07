# Compte rendu — vérifications post-écran 1 (MFA, codes de secours, lien d'e-mail)

**Date :** 2026-10-27
**Périmètre :** les 4 points demandés après la livraison de l'écran 1 (vérification
d'adresse + double authentification, web et mobile).

> ⚠️ **Les écrans web et mobile sont vérifiés par compilation uniquement**
> (`tsc --noEmit`, 0 erreur des deux côtés). Aucun navigateur ni émulateur n'a
> piloté ces pages dans cet environnement. Ce qui est prouvé ici, c'est le
> **backend de bout en bout** (recettes e2e sur PostgreSQL + stub GoTrue) et la
> **structure du code des écrans** (tests de scan). Le rendu effectif ne l'est
> pas — voir §4.

---

## 1. Connexion avec MFA — **verrouillage réel, corrigé**

### Le défaut

`ApiError.unauthorized()` n'acceptait **qu'un seul paramètre** :

```js
static unauthorized(message = 'Authentification requise') {
  return new ApiError(401, message, { code: 'UNAUTHORIZED' });
}
```

L'appel de la connexion passait pourtant un second argument
(`src/modules/auth/auth.service.js:256`) :

```js
throw ApiError.unauthorized('Code de double authentification requis', {
  mfaRequired: true,
  method,
});
```

JavaScript **ignore silencieusement** l'argument surnuméraire. Aucune erreur,
aucun avertissement. Conséquence en cascade :

| Étape | Attendu | Réel |
| --- | --- | --- |
| `body.details` | `{ mfaRequired: true, method }` | absent |
| `RequestError.mfaRequired` (`types.ts:61`) | `true` | `false` |
| `pendingMfa` (`store/auth.ts`) | posé | jamais posé |
| Champ de saisie du code | affiché | **jamais affiché** |

**Un compte ayant activé la MFA ne pouvait plus se connecter** — ni sur le web,
ni sur le mobile. Le code client était correct ; le défaut était uniquement
côté backend.

Le même piège existait sur `ApiError.forbidden()`, utilisée par
`mfa.service.js:292` avec `{ mfaRequired: true }`.

### Le correctif

`unauthorized` et `forbidden` acceptent désormais `details`
(`src/shared/errors/ApiError.js`).

### La preuve

`tests/e2e/mfaLogin.e2e.test.mjs` — **6 tests**, exécutés sur PostgreSQL + stub
GoTrue :

1. sans code → **401** et `details.mfaRequired === true` ;
2. avec un code TOTP valide → session délivrée ;
3. avec un code faux → refus, aucune session ;
4. **anti-énumération** : un mauvais mot de passe ne révèle pas que la MFA est
   active (même statut, même forme de réponse) ;
5. les codes de secours sont renvoyés **une seule fois** et ne sont **pas**
   ré-exposés par `/auth/mfa/status` ;
6. un code de secours ouvre une session.

Avant le correctif, le test 1 échouait sur `le corps doit porter details`.
Après : **6/6**.

**Contre-épreuve :** `unauthorized` remis à un seul paramètre ⇒ 3 tests
échouent, dont un qui localise la ligne fautive
(`src/modules/auth/auth.service.js:256`). Restauré ⇒ 14/14.

### Garde-fou ajouté

`tests/errorCodeContract.test.mjs` (3 tests en plus, 14 au total) compare, pour
**chaque appel du dépôt**, le nombre d'arguments passés au nombre de paramètres
déclarés par la fabrique. Ce test a été écrit **après** avoir corrigé le
défaut ; il a immédiatement détecté deux faux positifs que son propre parseur
produisait (virgules à l'intérieur de gabarits, virgule de fin), ce qui a
conduit à l'écrire correctement plutôt qu'à l'affaiblir.

---

## 2. Codes de secours — **l'API en renvoyait, les écrans les jetaient**

### L'API répondait déjà

`mfa.service.js#confirm` renvoie :

```js
return {
  mfaEnabled: true,
  backupCodes,
  warning: 'Conservez ces codes hors ligne : ils ne seront plus jamais affichés.',
};
```

Seules les **empreintes** sont stockées (`backupCodesHashes`) ; la trace d'audit
ne porte que le **nombre** de codes.

### Le défaut côté écrans

Les deux écrans vidaient simplement l'état :

```js
onSuccess: () => { setSetup(null); setCode(''); }
```

Le type client masquait même la donnée : `mfaConfirm: (code) => api.post<{ enabled: true }>(…)`.

**Aucune voie de récupération** : un utilisateur perdant son téléphone restait
définitivement dehors.

### Le correctif

- **Types corrigés** sur les deux clients (`{ mfaEnabled, backupCodes, warning }`).
- **Web** (`pages/auth/Mfa.tsx`) : bloc dédié `role="alert"`, fond
  `goldSurface` / texte `onGoldSurface` (encre-900 sur terre-400, 6,12:1),
  copie dans le presse-papiers, bouton « J'ai conservé mes codes ».
- **Mobile** (`app/auth/mfa.tsx`) : même bloc en `Card`. **Pas de copie dans le
  presse-papiers** : l'application n'a aucune dépendance de presse-papiers
  installée et en ajouter une pour cet écran sort du périmètre. L'écran demande
  de recopier sur support hors ligne.
- L'avertissement affiché **vient de l'API** (`secours.warning`), pas d'un texte
  recopié : si le backend change la formulation, l'écran suit.
- `setSecours(null)` est la **seule** sortie : aucun bouton de ré-affichage.

### Le test structurel demandé

`tests/mfaBackupCodes.test.mjs` — **6 tests** :

| Test | Ce qu'il prouve |
| --- | --- |
| rendu | les deux écrans lisent `backupCodes`, les rendent en position d'enfant JSX, et reprennent `warning` de l'API |
| sortie unique | exactement **une** fermeture `setSecours(null)` |
| **non journalisés** | aucun `console.*` ne porte `backupCodes`, `secours` ou `codeSecours` |
| non persistés | aucun `localStorage` / `AsyncStorage` / `SecureStore` / MMKV |
| serveur | `backupCodes` n'est renvoyé **que** par `confirm`, et les empreintes sont bien stockées |
| audit | la trace porte `backupCodes.length`, jamais la liste |

**Contre-épreuve :** le rendu `{codeSecours}` remplacé par `{'••••'}` sur le web
⇒ le test 1 échoue. Restauré ⇒ 6/6.

---

## 3. Lien de l'e-mail de vérification — **trois URL cassées, corrigées**

### Les URL réellement construites

Avant la correction, trois URL étaient construites en dur. **Aucune** ne
correspondait à une route du client web :

| Construit côté backend | Route web réelle | Résultat |
| --- | --- | --- |
| `${PUBLIC_WEB_URL}/verify-email` | `/auth/verify-email` | **404** |
| `${PUBLIC_WEB_URL}/reset-password` | `/auth/reset` | **404** |
| `${PUBLIC_WEB_URL}/farm/:slug` | `/public/farms/:slug` | **404** |

Le routeur web se termine par `<Route path="*" element={<AppNotFound />} />`.
Un chemin faux ne produit donc **aucune erreur** : l'e-mail part, le lien
s'ouvre, l'utilisateur arrive sur « page introuvable », et le jeton n'a plus
nulle part où être saisi. La troisième ligne casse en plus l'URL canonique et
l'`og:url` des profils publics de ferme.

### Valeurs observées après correction

Capturées sur le stub GoTrue pendant la recette e2e :

```
POST /auth/v1/resend?redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fverify-email
```

soit, une fois décodé :

```
http://localhost:5173/auth/verify-email
http://localhost:5173/auth/reset
http://localhost:5173/public/farms/ferme-kivu
```

`PUBLIC_WEB_URL` vaut `http://localhost:5173` par défaut
(`config/env.js:62`, `.env.example:92`).

### Où finit `emailRedirectTo` — vérifié, pas supposé

`supabase.auth.resend()` **n'envoie pas** cette valeur dans le corps. Dans
`@supabase/auth-js` 2.109.0 :

- `GoTrueClient.resend()` la passe à `_request({ redirectTo })` ;
- `lib/fetch.js:105-107` en fait un **paramètre de requête** `?redirect_to=…`.

Le corps reçu ne contient que
`{ email, type, gotrue_meta_security, code_challenge, code_challenge_method }`.

La première version du stub cherchait la valeur dans le corps et obtenait
systématiquement `null` — le test concluait alors à tort que l'API n'envoyait
aucune URL. C'est l'affichage du corps **et** de l'URL reçue qui a levé
l'ambiguïté.

### Correctif

`src/shared/links.js` (nouveau) centralise les chemins et construit les URL :
`lienVerificationEmail()`, `lienMotDePasseOublie()`, `lienProfilFerme(slug)`.
Les 6 sites d'appel (`auth.service.js` ×3, `public.service.js` ×3) l'utilisent ;
plus aucune URL web n'est construite en dur ailleurs.

`lienWeb()` encode les segments (`ferme mbongi/2` → `ferme%20mbongi%2F2`),
retire une barre oblique finale de `PUBLIC_WEB_URL`, et **lève** si un segment
dynamique manque — plutôt que d'imprimer `/public/farms/:slug` dans un QR code.

### Tests

`tests/webLinks.test.mjs` (5) + `tests/e2e/verifyEmail.e2e.test.mjs` (6).

**Contre-épreuvres :** `/auth/verify-email` remis à `/verify-email` ⇒ le test
structurel échoue **et** propose la bonne route ; la recette e2e échoue sur
`« /verify-email » n'est pas une route du client web`. Restauré ⇒ 5/5 et 6/6.

### Deux tests existants validaient le défaut

`tests/intelligence.integration.test.mjs` et `tests/req-v1.integration.test.mjs`
attendaient `/farm/ferme-kivu`. Ils passaient donc en attestant d'un lien mort.
Corrigés vers `/public/farms/ferme-kivu`.

### Le commentaire « vérifié à l'arrivée » — corrigé

`pages/auth/VerifyEmail.tsx` affirmait que le jeton de l'URL est « prérempli et
vérifié à l'arrivée ». C'est faux : il n'y a **aucun** `useEffect`, et
`verifier.mutate()` n'est appelé que par le bouton (ligne 109). L'import de la
page est `{ useState }` : `useEffect` n'y apparaît que dans le commentaire
explicatif. Le commentaire
décrit maintenant le comportement réel, avec la raison : un simple
préchargement de page ne doit pas consommer un jeton à usage unique, et
l'utilisateur doit pouvoir corriger un jeton tronqué avant l'envoi.

### Lien profond mobile — état réel

`app.json` déclare `scheme: "agrikonnect"`, mais **ni** `ios.associatedDomains`
**ni** `android.intentFilters`. Une URL `https://` ouvre donc le **navigateur**,
pas l'application. Les écrans mobiles
(`auth/verify-email.tsx`, `auth/reset-password.tsx`, `auth/mfa.tsx`) existent et
sont atteignables **dans** l'app, mais l'e-mail n'y mène pas.

Ce constat est **verrouillé par un test** (`tests/webLinks.test.mjs`, test 5) :
si quelqu'un configure un jour les domaines associés, le test échouera et
signalera que ce compte rendu doit être mis à jour.

---

## 4. Ce qui n'est **pas** vérifié

Conformément à la demande, la liste explicite :

| Non vérifié | Pourquoi | Ce qui l'est malgré tout |
| --- | --- | --- |
| **Rendu du QR code sur mobile** (`AppImage` avec data URI) | aucun émulateur dans cet environnement | la data URI est produite côté serveur (`QRCode.toDataURL`) et testée ; le type `qrDataUri` est déclaré |
| **Flux MFA complet avec une vraie application d'authentification** | pas d'authentificateur TOTP réel ici | les codes sont générés par `currentCode(secret)` **du serveur lui-même**, pas réimplémentés — le test prouve le contrat, pas l'interopérabilité |
| **Rendu des écrans web et mobile** | aucun navigateur (Playwright absent) | `tsc --noEmit` 0 erreur des deux côtés + tests de scan structurel |
| **Corps exact de l'e-mail** | produit par le mailer GoTrue, hors de ce dépôt | l'`redirect_to` transmis est capturé et confronté aux routes réelles |
| **Configuration GoTrue réelle** | `SITE_URL` et `GOTRUE_MAILER_URLPATHS_CONFIRMATION` n'apparaissent **ni** dans `.env.example` **ni** dans `docs/DEPLOYMENT.md` | — |
| **Envoi réel d'un e-mail** | le stub GoTrue expose le jeton au lieu de l'envoyer | le jeton est ensuite consommé par `POST /auth/verify-email` |

Le dernier point de la colonne centrale mérite une attention particulière :
**même avec la bonne URL transmise, GoTrue peut en envoyer une autre** si sa
propre configuration diffère. Ce n'est pas vérifiable ici.

---

## 5. Comptes

| Vérification | Résultat |
| --- | --- |
| `npm test` | **1021 / 1021** |
| — unitaires purs | **808** |
| — e2e (`tests/e2e/`) | **213** |
| `npm run verify` | **EXIT 0** — 376 opérations du contrat, aucune route fantôme |
| 10 scripts `check*` | **10/10 OK** |
| `geoai` (`python3 -m pytest -q`) | **134 passed + 11 subtests** |
| `tsc --noEmit` web | **0 erreur** |
| `tsc --noEmit` mobile | **0 erreur** |
| `check-frontend-contract.mjs` | 380 routes · 276 appels clients · **0 appel sans route** · 104 routes sans client |
| OpenAPI régénéré | 303 chemins · 376 opérations · 45 tags |

**26 tests ajoutés** : 3 (`errorCodeContract`) + 6 (`mfaBackupCodes`) +
5 (`webLinks`) + 6 (`mfaLogin.e2e`) + 6 (`verifyEmail.e2e`).
Avant : 995 (794 + 201). Après : **1021 (808 + 213)**.

Les `API_USAGE_WRITE_FAILED` visibles dans la sortie de `verify` sont
**attendus** : `tests/apiUsageWrite.test.mjs` exige que ce marqueur soit tracé.

---

## 6. Fichiers touchés

### Backend

| Fichier | Nature |
| --- | --- |
| `src/shared/errors/ApiError.js` | `unauthorized` et `forbidden` acceptent `details` |
| `src/shared/links.js` | **nouveau** — chemins web centralisés |
| `src/modules/auth/auth.service.js` | 3 URL via `links.js` |
| `src/modules/public/public.service.js` | 3 URL via `links.js` |
| `src/docs/openapi.json` | régénéré |
| `tests/errorCodeContract.test.mjs` | +3 tests |
| `tests/mfaBackupCodes.test.mjs` | **nouveau**, 6 tests |
| `tests/webLinks.test.mjs` | **nouveau**, 5 tests |
| `tests/e2e/mfaLogin.e2e.test.mjs` | **nouveau**, 6 tests |
| `tests/e2e/verifyEmail.e2e.test.mjs` | **nouveau**, 6 tests |
| `tests/e2e/support/fake-gotrue.mjs` | `POST /resend`, jetons d'adresse, capture de `redirect_to` |
| `tests/e2e/support/harness.mjs` | 2 helpers (`stubEmailToken`, `stubEmailRedirectTo`) |
| `tests/intelligence.integration.test.mjs` | assertion corrigée |
| `tests/req-v1.integration.test.mjs` | 2 assertions corrigées |

### Web

| Fichier | Nature |
| --- | --- |
| `src/services/endpoints.ts` | type `mfaConfirm` conforme à l'API |
| `src/store/auth.ts` | `details` → `secondFacteurRequis` (nom trompeur) |
| `src/pages/auth/Mfa.tsx` | bloc codes de secours |
| `src/pages/auth/VerifyEmail.tsx` | commentaire « vérifié à l'arrivée » corrigé |

### Mobile

| Fichier | Nature |
| --- | --- |
| `src/services/api/endpoints.ts` | type `mfaConfirm` conforme à l'API |
| `src/store/auth.ts` | `details` → `secondFacteurRequis` |
| `src/app/auth/mfa.tsx` | bloc codes de secours |
