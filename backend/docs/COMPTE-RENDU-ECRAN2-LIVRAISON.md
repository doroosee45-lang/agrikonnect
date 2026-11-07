# Compte rendu — préparation de la livraison et écran 2 (recommandations)

**Date :** 2026-10-27

> ⚠️ **Les écrans web et mobile sont vérifiés par compilation uniquement.**
> `tsc --noEmit` renvoie 0 erreur des deux côtés, et des tests de scan
> structurel vérifient ce que le code lit et ne recopie pas. **Aucun navigateur
> ni émulateur n'a piloté ces pages.** Voir §5.

---

## 1. Les cinq préparations demandées

### 1.1 `LISEZMOI-DEMARRAGE.md` (racine)

Guide de démarrage en 12 sections : prérequis (versions réelles vérifiées),
installation des trois projets, création du `.env` avec **la liste de ce qu'il
faut renseigner**, base locale et migrations, lancement des quatre processus,
mode sans service externe, données de démonstration, ce qui ne marche pas sans
configuration, **variables côté Supabase**, vérification de l'archive,
vérifications du projet, dépannage.

Points établis par lecture du code, pas supposés :

- `DATABASE_URL`, `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont les **seules**
  variables dont la validation d'environnement échoue si elles manquent
  (`src/config/env.js`). `SUPABASE_SERVICE_ROLE_KEY` est `optional()` au sens de
  Zod, mais l'inscription passe par `supabaseAdmin.auth.admin.createUser` : sans
  elle, **aucun compte ne peut être créé**. C'est écrit comme tel.
- **PostGIS n'est pas nécessaire** : les géométries sont en `Json`
  (`prisma/schema.prisma:398`) et aucune fonction `ST_*` n'est utilisée. Le
  calcul spatial est fait par `backend/geoai`.
- `--legacy-peer-deps` est requis sur le web et le mobile.

### 1.2 Mode local sans service externe

SMS et e-mail **avaient déjà** un fournisseur `console` par défaut
(`SMS_PROVIDER`, `EMAIL_PROVIDER`). Ce qui manquait, c'était de le **dire**.

Nouveau module `src/shared/startup/degradedServices.js` (fonction pure) +
branchement dans `src/server.js`. Au démarrage, le backend affiche en
`logger.warn` l'état réel de six services, avec pour chacun **la conséquence**
et non le simple réglage :

```
⚠ sms — console
    Aucun SMS ne part. Les messages sont écrits dans les journaux du backend
    (préfixe `[SMS:console]`) : les alertes de seuil et les codes OTP ne sont
    pas délivrés aux agriculteurs.
    → SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + …
```

Le rapport est rendu **vérifié** : le serveur a été lancé
(`PORT=4188 … node src/server.js`) et la sortie capturée — pas seulement
testée en unitaire. `logger.warn` plutôt que `info`, pour survivre à un
`LOG_LEVEL=warn`.

`tests/startupReport.test.mjs` (**10 tests**) vérifie notamment qu'une
configuration de production complète ne produit **aucun** avertissement : un
rapport qui crie en permanence finit ignoré.

### 1.3 Données de démonstration

`backend/scripts/seed-demo.mjs` crée un **compte agriculteur** et un **compte
agronome**, une ferme et une parcelle fictives, et une analyse de sol fictive.

Caractère fictif vérifié par test, pas seulement affirmé : domaine `.test`
(réservé RFC 6761, ne résout jamais), nom de parcelle contenant « fictive »,
analyse portant la mention « FICTIVE », et **tous** les paramètres de sol en
`source: 'declared'` — ni laboratoire, ni capteur.

Le script est **idempotent** (un 409 bascule sur une connexion) et **ne crée
aucune plage agronomique validée** — c'est vérifié par assertion
(`CropAgronomicRange.count({ status: 'VALIDATED' }) === 0`).

**Découverte en le testant :** le moteur refuse toute recommandation hors des
provinces qui ont un calendrier cultural —
`Aucun calendrier cultural pour la province « Kongo-Central ». Provinces
couvertes : Equateur, Bandundu.` La ferme de démonstration est donc en
**Équateur**, avec des coordonnées cohérentes. Placée ailleurs, l'écran de
recommandations serait vide et on conclurait à tort qu'il est cassé.

`scripts/demarrer-local.sh` lance tout d'un coup, dans l'ordre réel :
prérequis → migrations → référentiels → service Python → backend → attente de
`/health` → démonstration → web → mobile. Les deux branches d'échec ont été
exercées (option inconnue → exit 2 ; `.env` absent → exit 1 avec la liste des
variables à renseigner).

### 1.4 Vérification automatique de l'archive

`scripts/verifier-livraison.py` **relit la table centrale** de l'archive (module
`zipfile`) et refuse une livraison contenant `.env`, une clé, `node_modules/` ou
`storage/`. Il scanne aussi le contenu des fichiers texte.

**Auto-test intégré** (`--selftest`) : construit une archive volontairement
polluée dans un répertoire temporaire et vérifie que **9 fuites** sont détectées
et que 3 cas autorisés ne le sont pas. Sans lui, un vérificateur dont le filtre
est cassé affiche « tout va bien » indéfiniment.

Deux calibrages faits sur des cas réels :

1. `tests/e2e/support/harness.mjs` pose `SUPABASE_SERVICE_ROLE_KEY:
   'service-role-key-e2e'`. Exclure ce fichier **par son chemin** ouvrirait un
   trou — quelqu'un pourrait y coller une vraie clé. Le filtre porte donc sur la
   **valeur** : une valeur qui se dit de test est ignorée, une valeur qui n'en
   dit rien est signalée où qu'elle se trouve.
2. Passé sur l'archive précédente, le script ne signale rien. Le `backend/.env`
   présent dans l'espace de travail ne contient que des **placeholders**
   (`"placeholder…"`), pas de clé réelle — vérifié sans l'afficher.

`scripts/construire-livraison.sh` appelle le vérificateur et **s'arrête** si la
vérification échoue.

### 1.5 Variables côté Supabase

`LISEZMOI-DEMARRAGE.md` §8 documente `SITE_URL`, les `Redirect URLs`
(`/auth/verify-email` et `/auth/reset`), les trois clés, et surtout
**l'avertissement sur ce qui n'est pas vérifié** : le corps de l'e-mail est
produit par le mailer de GoTrue, hors de ce dépôt, et peut construire un chemin
différent de celui transmis.

---

## 2. Écran 2 — recommandations

### 2.1 Ce que l'API fournissait déjà, et ce que les écrans en faisaient

| Exigence | Champ de l'API | Avant | Après |
| --- | --- | --- | --- |
| Version du moteur | `engineVersion` | affichée depuis `recommendation.ruleSetVersion` | affichée depuis l'entrée classée |
| Règle de combinaison **et son libellé** | `combinationRuleLabel` | **libellé recopié en dur** | lu dans la réponse |
| Nombre de critères évalués | `evaluatedCount` | **absent des types** | affiché par culture |
| Couverture | `coverage` | affichée seule | affichée **avec** le nombre de critères |
| Statut « indicatif » | `indicative`, `indicativeReasons` | une ligne de texte | bloc dédié, raisons en liste |
| Rappel « adéquation, pas rendement » | `scoreNotice` | **jamais affiché** | affiché tel quel |

### 2.2 Trois défauts réels trouvés dans les écrans livrés

**a) `[object Object]` à l'écran.** Les deux écrans faisaient
`entry.notEvaluated.join(', ')`. L'API renvoie des **objets**
`{ key, label, reason, cause }` — mais les types clients déclaraient
`notEvaluated: string[]`, donc ça **compilait**. L'écran affichait
`critères non évalués : [object Object], [object Object]`.

**b) Libellés de règle recopiés.** Les deux écrans faisaient :

```tsx
{entry.combinationRule === 'MOST_LIMITING' ? ' · facteur le plus limitant' : ''}
{entry.combinationRule === 'MEAN_SATISFIED' ? ' · moyenne des critères' : ''}
```

Juste pour les deux règles connues, et **muet** pour toute autre valeur. Une
règle ajoutée au moteur ne provoquerait aucune erreur : l'écran cesserait
simplement de dire selon quoi le score est calculé.

**c) Le libellé était calculé puis jeté.** `scoreCrop` étend
`describeEngine(engine)` sur chaque culture — donc `combinationRuleLabel`
**existait** sur l'entrée. Le mapping de réponse (`scores: ranked.map(…)`) ne
sélectionnait que `combinationRule`, sans le libellé. C'est ce qui obligeait les
clients à le recopier. Corrigé côté serveur (additif).

### 2.3 Ce qui a été fait

- **`RecommendationMethod.tsx`** sur les deux clients (web :
  `pages/farmer/Plots/`, mobile : `components/farmer/`) — bloc « Méthode de
  calcul » : moteur, libellé et description de la règle, critères évalués,
  mesures utilisées, statut indicatif avec ses raisons, et `scoreNotice` affiché
  **tel quel**.
- **Ligne par culture** : couverture **+** nombre de critères évalués. Avec la
  règle du facteur le plus limitant, un paramètre non mesuré est ignoré : sans
  le nombre de critères, une couverture de 100 % obtenue sur le seul pH
  renseigné se lit comme une évaluation complète.
- **Critères non évalués** : libellé **et raison** par critère, plus de `join`.
- **Types corrigés** sur les deux clients : `NotEvaluatedCriterion[]`,
  `evaluatedCount`, `tooFewCriteria`, `combinationRuleLabel`.

### 2.4 Garde-fou

`tests/recommendationLabels.test.mjs` (**7 tests**) vérifie qu'aucun écran ne
compare `combinationRule` à une constante ni ne recopie un libellé, que
`scoreNotice` n'est recopié nulle part, que les huit champs exigés sont lus sur
les deux clients, que `notEvaluated` n'est jamais concaténé, et que le mapping
de réponse ne laisse plus tomber le libellé.

**Contre-épreuve :** le libellé en dur réintroduit sur le web ⇒ le test échoue
en nommant les deux motifs. Restauré ⇒ 7/7.

### 2.5 Le point de méthode : tout reste indicatif

Aucune plage validée n'étant attendue, la recette e2e du script de démonstration
**fixe cet état dans le code** : sur les données de démonstration, la
recommandation doit renvoyer `indicative: true` avec des raisons non vides, et
porter `scoreNotice`. Si quelqu'un valide un jour des plages et que cette
assertion échoue, c'est le signal attendu — pas une régression à masquer.

---

## 3. Comptes

| Vérification | Résultat |
| --- | --- |
| `npm test` | **1045 / 1045** |
| — **unitaires purs** | **825** |
| — **e2e** (`tests/e2e/`) | **220** |
| `npm run verify` | **EXIT 0** — 376 opérations, aucune route fantôme |
| 10 scripts `check*` | **10/10 OK** |
| `geoai` (`python3 -m pytest -q`) | **134 passed + 11 subtests** |
| `tsc --noEmit` web | **0 erreur** |
| `tsc --noEmit` mobile | **0 erreur** |
| `check-frontend-contract.mjs` | 380 routes · 276 appels clients · **0 appel sans route** · 104 routes sans client |
| OpenAPI régénéré | 303 chemins · 376 opérations · 45 tags |
| `verifier-livraison.py --selftest` | **9 fuites détectées, 3 cas autorisés ignorés** |

**24 tests ajoutés** cette étape : 10 (`startupReport`) + 7
(`recommendationLabels`) + 7 (`seedDemo.e2e`).
Avant : 1021 (808 + 213). Après : **1045 (825 + 220)**.

---

## 4. Fichiers touchés

### Backend

| Fichier | Nature |
| --- | --- |
| `src/shared/startup/degradedServices.js` | **nouveau** — état des services externes |
| `src/server.js` | rapport de démarrage affiché avant l'ouverture du port |
| `src/modules/recommendation/recommendation.service.js` | `combinationRuleLabel`, `combinationRuleDescription`, `scoringModelLabel` ajoutés au mapping `scores` |
| `scripts/seed-demo.mjs` | **nouveau** — données de démonstration fictives |
| `src/docs/openapi.json` | régénéré |
| `tests/startupReport.test.mjs` | **nouveau**, 10 tests |
| `tests/recommendationLabels.test.mjs` | **nouveau**, 7 tests |
| `tests/e2e/seedDemo.e2e.test.mjs` | **nouveau**, 7 tests |

### Racine

| Fichier | Nature |
| --- | --- |
| `LISEZMOI-DEMARRAGE.md` | **nouveau** — guide de démarrage |
| `scripts/verifier-livraison.py` | **nouveau** — vérification d'archive + auto-test |
| `scripts/construire-livraison.sh` | **nouveau** — construction + vérification |
| `scripts/demarrer-local.sh` | **nouveau** — lancement en une commande |

### Web

| Fichier | Nature |
| --- | --- |
| `src/pages/farmer/Plots/RecommendationMethod.tsx` | **nouveau** — méthode de calcul |
| `src/pages/farmer/Plots/Recommendations.tsx` | écran 2 |
| `src/services/types.ts` | `NotEvaluatedCriterion`, `evaluatedCount`, libellés |

### Mobile

| Fichier | Nature |
| --- | --- |
| `src/components/farmer/RecommendationMethod.tsx` | **nouveau** — méthode de calcul |
| `src/app/farmer/plots/[id]/recommendations.tsx` | écran 2 |
| `src/services/api/types.ts` | idem web |

---

## 5. Ce qui n'a été vu à l'écran **par personne**

Liste explicite, demandée pour la livraison. **Rien de ce qui suit n'a été
observé en rendu réel** — ni par moi, ni par quiconque, dans cet environnement.

### 5.1 Écran 2 (cette étape)

| Non vu | Ce qui l'est malgré tout |
| --- | --- |
| Le bloc « Méthode de calcul » **rendu** sur le web et le mobile | les huit champs sont lus dans la réponse (test de scan) ; `tsc` 0 erreur |
| L'alignement des lignes intitulé/valeur, le retour à la ligne sur petit écran | valeurs de style écrites, jamais observées |
| Le rendu réel de `scoreNotice` (longueur du texte, italique) | le texte est repris de l'API, testé côté serveur |
| Le rendu de la liste des critères non évalués | `notEvaluated` n'est plus concaténé (test) ; le rendu n'a pas été vu |
| La lisibilité du statut « indicatif » sur fond `gold` | contraste calculé pour `onGoldSurface`, pas mesuré à l'écran |
| Le comportement avec **beaucoup** de cultures classées (défilement) | aucune donnée de volume n'a été affichée |

### 5.2 Reporté des étapes précédentes

| Non vu | Pourquoi |
| --- | --- |
| **Rendu du QR code MFA sur mobile** (`AppImage` avec data URI) | aucun émulateur |
| **Flux MFA complet avec une vraie application d'authentification** | pas d'authentificateur TOTP réel ; les codes sont produits par `currentCode(secret)` **du serveur lui-même** |
| **Le champ MFA qui apparaît à la connexion** | la chaîne `details.mfaRequired` → `pendingMfa` → champ est prouvée par recette e2e côté serveur et par lecture du code client, mais le champ n'a pas été vu apparaître |
| **Les codes de secours affichés** | le bloc existe et le rendu est testé structurellement ; il n'a pas été vu |
| **La page de vérification d'adresse ouverte depuis un vrai lien d'e-mail** | aucun e-mail réel n'est parti |
| **Les captures d'harmonisation P1** | Playwright/chromium absents de cet environnement |

### 5.3 Limites de vérification générales

| Non vérifié | Détail |
| --- | --- |
| **Corps exact de l'e-mail** | produit par le mailer GoTrue, hors de ce dépôt. L'`redirect_to` transmis est vérifié, pas le message reçu |
| **Configuration GoTrue réelle** | `SITE_URL` et `GOTRUE_MAILER_URLPATHS_CONFIRMATION` ne sont pas dans ce dépôt ; ils sont **à régler sur votre projet Supabase** (§8.1–8.2 du guide) |
| **Envoi réel d'un SMS** | aucun envoi Twilio en RDC n'a été exécuté. `SMS-TWILIO.md` documente les contraintes, pas un essai réussi |
| **Acquisition satellite réelle** | `SATELLITE_PROVIDER=simulated` partout ici |
| **Stockage objet** | le pilote `object` n'a jamais été exécuté contre un vrai panier |
| **`scripts/demarrer-local.sh` de bout en bout** | ses branches d'échec ont été exercées ; le parcours complet nécessite une base PostgreSQL et un projet Supabase réels |
| **Plafond de débit de production (30/min)** | non exécuté, les recettes tournent en `NODE_ENV=test` |
| **Course sur le quota de dépôt géospatial** | documentée dans `GEOSPATIAL-IMPORT.md` §5.5, **non corrigée** |
| **`client_max_body_size 2m`** dans le déploiement documenté | casse le dépôt géospatial en production ; documenté dans `DEPLOYMENT.md` §5.2, **non appliqué** |

### 5.4 À voir de vos yeux, dans l'ordre

1. Connexion avec un compte ayant la MFA active → le champ de code apparaît.
2. Activation de la MFA → le QR s'affiche (surtout sur mobile) et les codes de
   secours s'affichent **une fois**.
3. Un lien de vérification reçu → il ouvre la bonne page, pas la 404.
4. Écran de recommandations sur la parcelle de démonstration → le bloc « Méthode
   de calcul », le statut indicatif et le rappel sont lisibles.
5. Les critères non évalués s'affichent avec leur raison — pas `[object Object]`.

---

### 5.4 Suite

L'**écran 3 (boîte d'alertes)** a sa propre liste, à jour :
`docs/COMPTE-RENDU-ECRAN3-ALERTES.md` §6. Les écarts de §5.2 et §5.3 restent
ouverts et y sont repris pour ce qui concerne l'écran 3.

Deux écarts listés ici ont été **fermés** depuis :

- `alertLabels.js` — créé à l'étape précédente sans être branché ; il est
  désormais branché sur les quatre sorties d'alertes et couvert par 15 tests
  (`tests/alertLabels.test.mjs`), contre-épreuve comprise ;
- `test:e2e` ne listait pas `seedDemo.e2e.test.mjs` — quatre recettes
  (`geospatialImport`, `mfaLogin`, `verifyEmail`, `seedDemo`) ont été ajoutées à
  la liste explicite : **17 fichiers**.
