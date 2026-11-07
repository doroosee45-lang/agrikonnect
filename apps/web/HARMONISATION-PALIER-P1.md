# AGRIKONNECT AFRICA — compte rendu du palier P1 (couleurs)

**Version 3.** Corrige les deux comptages (A1, A2), remplace la formule de fonds de puce par les
valeurs de la palette (B), fiabilise le script de captures (C1, C2, C3) et met à jour la
documentation des jetons (D2). Vos décisions D1 et D2 sont appliquées.

---

## 1. PALIER TRAITÉ

**P1 — Couleurs.** P2, P3, P4 non commencés, et **je ne les commence pas** (votre C3).

**P1 reste ouvert.** Les captures ne sont pas produites : aucun navigateur n'existe dans cet
environnement — vérifié, `chromium`, `chromium-browser`, `google-chrome`, `firefox` absents et
`~/.cache/ms-playwright` vide. Le script est livré et sa partie non-navigateur est testée.

---

## 2. ÉCRANS TRAITÉS

**6 pages web · 5 écrans mobile · 17 composants partagés · 6 fichiers de thème = 34 fichiers.**

| Groupe | Nb | Détail |
| -- | -- | -- |
| Thème | **6** | `apps/web/src/theme/{agrikonnect.ts, tokens.css, index.ts}` · `apps/Mobile/src/theme/{agrikonnect.ts, colors.ts, shadows.ts}` |
| Pages web | **6** | `pages/farmer/Settings.tsx` · `pages/farmer/Export/Detail.tsx` · `pages/farmer/Projects/DataRoom.tsx` · `pages/developers/Docs.tsx` · `pages/public/Home.tsx` · `pages/app/Profile.tsx` |
| Composants partagés | **17** | 10 mobile `ui/` (`Button, Chip, States, ProvenanceTag, Input, Accordion, MapPreview, PressableScale, HeroBackground, Card`) · 2 mobile `public-site/` (`PublicShell, PublicFooter`) · 4 mobile `home/` (`ClosingSections, DataSections, ServicesSection, Hero`) · **1 web** (`components/ui/Button.tsx`) |
| Écrans mobile | **5** | `app/explore.tsx` · `app/services.tsx` · `app/weather.tsx` · `app/public-site/sols.tsx` · `app/public-site/farm/[slug].tsx` |

**6 + 6 + 17 + 5 = 34.**

> **A1 — correction.** Votre découpe était juste sur le 17 mais comptait `Button.tsx` deux fois :
> une fois dans « pages web 7 (6 pages + Button.tsx) », une fois dans « composants partagés 17
> (… + Button web) ». Cela donne 6 + 7 + 5 + 17 = **35**, pas 34. Le bon découpage est **6 pages
> web** (sans `Button.tsx`) + **17 composants partagés** (avec `Button.tsx`). Le total de 34 est
> confirmé fichier par fichier par `ls | wc -l` sur chaque groupe.

Dans ce dépôt les couleurs passent par deux objets de thème que **159 pages web et 208 écrans
mobile importent** : les repointer recolore tout le produit d'un coup.

---

## 3. FICHIERS MODIFIÉS

Les 34 fichiers ci-dessus, plus **deux fichiers créés ce tour** :

- `design-tokens.json` — documentation de l'échelle réelle (D2)
- `scripts/p1-avant/` — 10 instantanés web de l'état pré-P1, pour les captures

---

## 4. CE QUI A CHANGÉ CE TOUR

### 4.1 Les fonds de puce : la palette, plus aucun calcul (votre B)

Vous aviez raison, et le défaut était plus grave que je ne l'avais vu. Avec
`mix(base, blanc, 0.92)`, mes six fonds tombaient sur deux blancs cassés :

| Formule 8 % | success | living | info | forest | warning | error |
| -- | -- | -- | -- | -- | -- | -- |
| valeur | `#eef2f0` | `#eef2f0` | `#eff0ef` | `#ecefee` | `#f7f0ed` | `#f9eded` |

`success` et `living` étaient **identiques**. Écart maximum de canal : **3**. La couleur ne codait
plus rien.

**Remplacé par les fonds de la palette**, avec les valeurs réelles du dépôt :

| Rôle | Fond | Texte | Contraste |
| -- | -- | -- | -- |
| succès / mesuré | `vert-100 #e0ece5` | `vert-800 #123d2a` | **10,02:1** |
| information | `vert-50 #f2f7f4` | `vert-800 #123d2a` | **11,23:1** |
| attention | `terre-100 #f5e3d8` | `terre-800 #7d3620` | **6,97:1** |
| erreur | `rouge-50 #fef2f2` | `rouge-700 #b91c1c` | **5,91:1** |
| neutre | `creme-50 #fdfbf6` | `encre-700 #33403a` | **10,49:1** |

**Séparation retrouvée** (écart maximum de canal) :

| | succès/attention | succès/erreur | attention/erreur |
| -- | -- | -- | -- |
| Formule 8 % | 9 | 11 | 3 |
| **Palette** | **21** | **30** | **26** |

**B2 respecté** : `terre-50 #fbf4ef` n'est pas utilisé pour l'attention — mesuré, il n'est qu'à
**3 unités** de `rouge-50 #fef2f2` (vous disiez 4). `terre-100` est à **26 unités**.

Les 8 tons de `Chip.tsx` sont alignés sur ces paires. Les ancres `COLORS.success`,
`COLORS.warning` etc. ne sont **pas** modifiées : elles servent ailleurs que dans les puces.

### 4.2 Le script de captures rendu non destructif (vos C1, C2, C3)

**C1 — le fichier non couvert, identifié.** Vous aviez raison de demander la vérification : la
bascule par regex était **cassée**, pas seulement incomplète.

- `shadows.ts` recevait **0 substitution** — il ne contient plus qu'un seul hex, `#1B5A3E` dans
  `GRADIENTS.forestSoft`, valeur que P1 n'a jamais touchée. Sans effet sur l'image.
- **Le vrai problème** : mes substitutions visaient `successBg: '#eef2f0'` et six autres hex
  qui **n'existent plus** depuis le §4.1 — les `TINTS` référencent maintenant `VERT[100]` etc.
  L'« avant » produit aurait été un état hybride, ni avant ni après.
- S'y ajoutaient `GRADIENTS.{gold, leaf, forest, paper}` et les 8 tons de `Chip.tsx`, jamais
  inversés.

**Corrigé par construction** : plus aucune regex. Les 10 fichiers web de l'état pré-P1 sont
stockés comme **instantanés littéraux** dans `scripts/p1-avant/`, générés par inversion
fichier par fichier des changements de P1 (les ancres posées au tour « fondations » ne sont pas
inversées, elles ne font pas partie de P1). Vérifié : les 10 diffèrent de l'état courant, et les
10 compilent (`tsc --noEmit`, 0 erreur chacun).

**Portée de l'« avant »** : les 8 captures sont toutes web, donc seuls les fichiers web
influencent le build Vite. Les 3 fichiers de thème **mobile** du §3 (`agrikonnect.ts`,
`colors.ts`, `shadows.ts`) ne participent pas au rendu web — leur absence de la copie est sans
effet sur l'image. C'est la réponse à votre question : **`shadows.ts` n'était pas couvert, et il
n'avait pas à l'être pour ces captures.**

**C2 — le dépôt n'est plus écrit du tout.** Trois garanties :

1. L'état « avant » est capturé depuis une **copie temporaire** de `apps/web`
   (`.tmp-captures-p1/`, `node_modules` lié et non copié), sur laquelle on pose les instantanés.
   Un Ctrl-C, un SIGKILL ou une coupure de courant ne peuvent pas laisser le dépôt dans
   l'ancienne palette : il n'est jamais modifié.
2. Un **manifeste de sommes de contrôle** (SHA-256) est pris avant, comparé après ; toute
   différence fait échouer le script.
3. La copie temporaire est supprimée dans un `finally`, et `git status --porcelain` est exécuté
   à la fin s'il y a un dépôt git.

**Testé ici, sans navigateur** : manifeste de **475 fichiers**, **10 instantanés posés**, copie
contenant bien `#0d2c1e` pendant que le dépôt garde `#0e3022`, **dépôt non modifié**, copie
supprimée.

**Note honnête : il n'y a pas de dépôt git ici** (`git rev-parse` → `fatal: not a git
repository`). Le `git status --porcelain` que vous demandez est donc codé et s'exécutera chez
vous, mais il ne peut pas servir de preuve dans cet environnement — la preuve ici, ce sont les
sommes de contrôle.

**C3 — la légende est écrite noir sur blanc** sous l'image 8, dans un bandeau terre-100 /
texte terre-800 : « **web 390 px — repère de mise en page, pas un rendu React Native** ». Elle
est aussi reprise dans le chapeau de la page.

### 4.3 `design-tokens.json` (votre D2)

**Ce fichier n'existait pas dans le dépôt** — c'était l'une des références citées par la mission,
absente comme les kits `web/` et `mobile/`. Je l'ai **créé**, généré depuis
`agrikonnect.ts` : 35 nuances, 12 rôles, 6 paires de puces avec leur contraste, géométrie,
mouvement, tactile, typographie.

Il porte une section `ecartsAvecLaReference` qui liste **7 nuances** où la référence du programme
diffère du dépôt, avec pour chacune la valeur du dépôt, la valeur de référence et la décision :

| Jeton | Dépôt | Référence | Décision |
| -- | -- | -- | -- |
| `vert-100` | `#e0ece5` | `#e1ece5` | conservé |
| `vert-50` | `#f2f7f4` | `#f2f7f3` | conservé |
| `terre-100` | `#f5e3d8` | `#f9e9d6` | conservé |
| `terre-800` | `#7d3620` | `#7d3722` | conservé |
| `terre-500` | `#c46f33` | `#d0702f` | conservé |
| `terre-600` | `#b05a27` | `#bd5927` | conservé |
| `encre-900` | `#1f2a24` | `#16211b` | **non introduite** (D1) |

Conformément à votre D2 : **rien n'est réaligné dans le code**, c'est la documentation qui porte
l'écart. `terre-700 #9c4423` et `terre-400 #db8a4c` sont identiques dans les deux échelles, donc
tous les rôles visibles sont alignés.

### 4.4 Vos décisions D1 et D2

- **D1** — `#16211b` **n'est pas ajouté**. `ENCRE[900]` reste `#1f2a24` (5,48:1). Le fichier de
  jetons note que `#16211b` est la valeur de référence et n'appartient pas à ce dépôt.
- **D2** — les valeurs TERRE du dépôt sont conservées. Documentation mise à jour.

---

## 5. CORRECTIONS DE LA VERSION 2

### 5.1 A2 — le ratio de la puce `living`

**Vous aviez raison : 6,27:1, pas 6,40.** Mon 6,40 était `#2f6249` sur **`#EEF6E7`**, l'ancien
`livingGreenBg`. Sur le fond recalculé `#eef2f0`, le ratio est **6,27:1** — la même valeur que
`successBg`, comme vous l'avez relevé. C'était la même erreur de fond que celle que vous aviez
déjà corrigée en A2 de la version 1 : je citais un ratio calculé sur un fond qui n'était plus
celui rendu.

*(Depuis, le §4.1 a remplacé ce fond par `vert-100 #e0ece5` : la puce `living` est maintenant à
**10,02:1**.)*

### 5.2 A1 — le comptage

Corrigé au §2 : **17 composants partagés**, et donc **6 pages web** (pas 7).

---

## 6. TABLE DE CONVERSION

**`apps/web/HARMONISATION-CONVERSION.md`** — 51 lignes énumérées de A1 à F30
(4 jetons · 2 ancres · 2 tables dérivées · 2 dégradés/ombres · 11 web · 30 mobile).

**À mettre à jour :** la section C de cette table décrit encore la formule `mix(base, blanc,
0.92)` que le §4.1 vient de remplacer. Les valeurs de fond qui y figurent sont donc périmées ;
les valeurs en vigueur sont celles du §4.1 ci-dessus et de `design-tokens.json`. Je signale
l'écart plutôt que de laisser les deux documents se contredire en silence.

**Ambiguïtés restantes : aucune.**

---

## 7. TESTS EXÉCUTÉS

### 7.1 Unitaires et statiques

| Test | Résultat |
| -- | -- |
| `tsc --noEmit` — web (159 pages) | **EXIT 0** |
| `tsc --noEmit` — mobile (208 écrans) | **EXIT 0** |
| `npm run build` — web | **EXIT 0** |
| `npm run verify` — mobile (tsc + ESLint + export) | **EXIT 0** |
| `check` · `check:fields` · `check:env` · `check:perms` · `check:trace` · `check:req` · `check:cdc` · `check:migrations` · `check:mounts` · `check:models` | **10 sur 10 OK** |
| `check-frontend-contract` | **OK — 377 routes, 0 appel sans route** |
| `node --check scripts/captures-p1.mjs` | **OK** |
| Les 10 instantanés `scripts/p1-avant/` compilés isolément | **0 erreur chacun** |
| Copie temporaire : dépôt non modifié | **475 fichiers sommés, 0 différence** |
| « AgriKonnect » seul / « AGRIKONNECT AFRICA » | **0 / 25** |
| Routes web | **160**, inchangé |
| « Plages agronomiques » | **5**, intactes |

**Les 9 paires de puces du §4.1 sont toutes ≥ 4,5:1**, la plus basse étant l'erreur à 5,91:1.

**Note sur les checks backend** : trois d'entre eux (`check`, `check:migrations`, `check:mounts`)
sont passés en échec au premier lancement de ce tour. Cause vérifiée : `backend/node_modules`
était vide (`ls | wc -l` → 0) et le client Prisma non généré — `ERR_MODULE_NOT_FOUND`. Après
`npm install` + `npx prisma generate`, les 10 sont verts. **Ce n'était pas une régression.**

### 7.2 E2E

**Aucun test e2e exécuté.** Le harnais e2e backend n'a pas été relancé (il exige
`embedded-postgres` et ne couvre pas l'apparence). **Il n'existe aucun test e2e navigateur dans
ce dépôt.**

**Les écrans ne sont vérifiés que par compilation.** Aucun écran n'a été vu rendu.

---

## 8. NON TRAITÉ (et pourquoi)

| Élément | Pourquoi |
| -- | -- |
| **Les 8 captures (C4)** | **Aucun navigateur dans cet environnement** — `chromium`, `chromium-browser`, `google-chrome`, `firefox` absents, `~/.cache/ms-playwright` vide. Je ne peux pas les produire ici, et je ne vais pas prétendre le contraire. |
| **Un vrai rendu mobile** | L'écran 8 est le site web à 390 px. Un rendu React Native demande Expo Go ou un simulateur. |
| **Contrastes mesurés sur rendu** | Les ratios sont calculés depuis les valeurs hexadécimales. |
| **Les 243 emojis comme icônes (web)** | « Passe ultérieure » selon le §6. |
| **Section C de la table de conversion** | Périmée depuis le §4.1 — signalée au §6 plutôt que corrigée en silence. |
| **P2, P3, P4** | Non commencés. |

### 8.1 La commande, pour votre machine

```bash
node scripts/captures-p1.mjs
```

Écrans protégés :

```bash
CAPTURE_LOGIN=votre@email CAPTURE_PASSWORD=votremdp node scripts/captures-p1.mjs
```

**Où regarder : `captures/index.html`.**

Le script installe Playwright s'il manque. Il n'écrit jamais dans le dépôt, vérifie l'intégrité
par sommes de contrôle, affiche `git status --porcelain`, et supprime sa copie temporaire.

**Ce que j'ai vérifié ici :** la syntaxe, la copie temporaire, la pose des 10 instantanés, le
manifeste d'intégrité (475 fichiers, 0 différence), la suppression de la copie, et la compilation
isolée des 10 instantanés. **Ce que je n'ai pas pu vérifier : l'exécution du navigateur.** Si
Playwright bute sur un détail de votre machine, dites-le-moi.

---

## 9. RISQUE DE RÉGRESSION

**Principal — l'or est devenu brun partout.** `#D6A64F` n'existe plus : `terre-700` en texte et
en trait, `terre-400` en surface. C'est le changement le plus visible du palier, sur les deux
apps. Conforme au §4, mais il mérite votre validation visuelle.

**Nouveau ce tour — les fonds de puce changent de famille.** Cinq fonds passent de blancs cassés
à des teintes franches (`vert-100`, `vert-50`, `terre-100`, `rouge-50`, `creme-50`) et les textes
de puces passent de `VERT[600]`/`TERRE[700]` à `VERT[800]`/`TERRE[800]`. Toutes les puces de
l'application changent d'aspect d'un coup — 246 usages de `tone="white"`, 86 de `tone="neutral"`,
et 40 tons sémantiques. C'était le but de votre B, mais c'est un changement large. Les 9 paires
vérifiées passent toutes AA, la plus basse à 5,91:1.

**Corrigé — la régression que j'avais introduite entre mes deux tours.** En passant l'or à
`terre-700` sans changer les textes posés dessus, j'avais fait tomber le bouton principal mobile
à **1,63:1** et le bouton d'accueil web à **2,58:1**. Les deux sont réparés. Je le répète parce
que c'est le fait le plus important de ce palier : cette régression a existé dans le dépôt.

**Secondaire — le contraste du texte d'erreur baisse**, de 6,62:1 à 5,91:1. Toujours au-dessus de
4,5:1. Le §3 impose `#b91c1c`, je l'applique tel quel.

**Nul — le backend.** 10 checks verts et contrat d'API à 377 routes, 0 appel sans route.

**Ce que je ne peux pas garantir : l'absence de régression visuelle.** Sans navigateur je ne peux
détecter ni un texte devenu illisible sur un fond que je n'ai pas vu, ni un débordement, ni un
endroit où l'or portait un sens que la terre ne porte pas. C'est exactement ce que
`captures/index.html` montrera — d'où le fait que **P1 reste ouvert**.
