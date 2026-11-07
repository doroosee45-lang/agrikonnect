# AGRIKONNECT AFRICA — table de conversion du palier P1 (couleurs)

**Version 2 — corrigée.** La version 1 contenait des ratios faux et des comptages incohérents ;
elle est remplacée par celle-ci. Chaque ratio est recalculé avec la formule WCAG 2.1
(luminance relative sRGB) sur **la paire réellement rendue**, dégradé et superposition compris.

**Total : 51 lignes de décision** (4 jetons · 2 ancres · 2 tables dérivées · 2 dégradés/ombres ·
11 web · 30 mobile). Les quatre ambiguïtés de la version 1 sont **toutes tranchées** par vos
décisions B1–B4 ; il n'en reste aucune.

---

## A. Jetons — valeurs corrigées pour respecter le §3 (4 lignes)

| # | Avant | Après | Décision | Justification |
| -- | -- | -- | -- | -- |
| A1 | `vert-900 #0d2c1e` | `#0e3022` | Direct | §3.1 : le texte titre est `#0e3022`. Contraste sur `creme-100` : 13,29:1 → 12,86:1, AA large. |
| A2 | `encre-500 #6b7a72` | `#5c665f` | Direct | §3.1 : le texte secondaire est `#5c665f`. Contraste sur `creme-100` : 4,60:1 → **5,53:1**, on gagne de la marge. |
| A3 | `rouge-700 #a02e26` | `#b91c1c` | Direct | §3.1 : l'erreur est `#b91c1c`. **Le contraste baisse** de 6,62:1 à 5,91:1 — voir §H ci-dessous. |
| A4 | `rouge-50 #fdf3f2` | `#fef2f2` | Direct | §3.1 : le fond d'erreur est `#fef2f2`. |

## B. Ancres sémantiques (2 lignes)

| # | Avant | Après | Décision | Justification |
| -- | -- | -- | -- | -- |
| B1 | `warning → TERRE[500]` `#c46f33` | `TERRE[700]` `#9c4423` | **Passage par le rôle** | `terre-500` ne tient pas AA en texte : **3,70:1 sur blanc**, 3,31:1 sur son propre fond de puce. `terre-700` donne 6,43:1 / 5,71:1. `terre-500` reste dans l'échelle pour les usages **non textuels** du rôle « attente » (filets, remplissages), conformément à B3. |
| B2 | `gold → TERRE[700]` (texte **et** surface) | `gold → TERRE[700]` (texte, trait) + **`goldSurface → TERRE[400]`**, **`onGoldSurface → ENCRE[900]`** | **Scindé selon l'usage** | Votre A5 : l'or en texte ou en trait sur fond clair → `terre-700` (6,43:1 sur blanc) ; l'or en surface → `terre-400` avec texte `encre-900` (5,48:1). Un seul jeton ne peut pas servir les deux usages. |

> **Écart signalé :** vous citez `encre-900 #16211b` (6,12:1). Cette valeur **n'existe pas dans le
> dépôt** — l'échelle ENCRE réelle s'arrête à `900: #1f2a24`. J'ai gardé `#1f2a24` (5,48:1, AA
> large) plutôt que d'introduire `#16211b`, parce que le §3 interdit d'inventer une nuance
> intermédiaire. Dites-moi si vous préférez ajouter `#16211b` à l'échelle.

## C. Tables dérivées, recalculées (B2) — 2 lignes

Formule unique, écrite dans le code : **`fond = mix(base, #ffffff, 0.92)`** — 8 % de couleur,
92 % de blanc. Chaque fond est vérifié avec son propre texte.

| # | Avant | Après | Texte dessus | Contraste |
| -- | -- | -- | -- | -- |
| C1 `TINTS` | `successBg #E8F2EB` · `warningBg #FBF1DF` · `errorBg #F8E9E5` · `infoBg #E7EFF4` · `goldBg #FAF2E2` · `livingGreenBg #EEF6E7` · `forestGreenBg #E9F0EB` | `#eef2f0` · `#f7f0ed` · `#f9eded` · `#eff0ef` · `#fcf6f1` · `#eef2f0` · `#ecefee` | respectivement `VERT[600]` · `TERRE[700]` · `ROUGE[700]` · `ENCRE[700]` · `TERRE[700]` · `VERT[600]` · `VERT[800]` | 6,27 · 5,71 · 5,66 · 9,50 · 6,00 · 6,27 · 10,51 — **tous ✓** |
| C2 `DARK` | `bg #10261B` · `bgAlt #17362A` · `elevated #1E4131` | `#0d2b1d` · `#0f3222` · `#113927` (formule `mix(VERT[800], #000000, 30/18/6 %)`) | `creme-100` | 14,10 · 12,98 · 11,88 — **tous ✓** |

## D. Dégradés et ombres (2 lignes)

| # | Avant | Après | Décision | Justification |
| -- | -- | -- | -- | -- |
| D1 | `GRADIENTS.gold ['#E4BE76', COLORS.gold]` | `[TERRE[300], goldSurface]` | **Signalé : changement de sens** | L'or décoratif devient terre. Texte `encre-900` : 8,88:1 puis 6,12:1. |
| D2 | `GRADIENTS.leaf [livingGreen, '#4E8A38']` · `GRADIENTS.forest [forestGreen, '#0E3323']` · `GRADIENTS.paper [pureWhite, '#FBFCF8']` · ombre `rgba(214,166,79,.35)` · scrims `rgba(16,38,27,…)` | `[VERT[500], VERT[600]]` · `[VERT[800], VERT[900]]` · `[BLANC[95], CREME[50]]` · `rgba(219,138,76,.35)` · `rgba(14,48,34,…)` | Direct | `#4E8A38`, `#0E3323`, `#FBFCF8` et `rgba(214,166,79)` sont **hors palette**. Mon premier inventaire les avait manqués : mon grep excluait `src/theme/`, or c'est là qu'ils étaient. |

## E. Web — couleurs en dur (11 lignes)

| # | Fichier | Avant | Après | Décision |
| -- | -- | -- | -- | -- |
| E1 | `components/ui/Button.tsx` | `#9a3a26` | `ROUGE[800]` | Direct — survol du bouton danger, c'est le rôle erreur. |
| E2 | `pages/developers/Docs.tsx` | `#174d35` | `VERT[800]` | Direct — vert de marque sur fond clair. |
| E3 | `pages/farmer/Projects/DataRoom.tsx` | `#174d35` | `VERT[800]` | Direct. |
| E4 | `pages/farmer/Export/Detail.tsx` | `#174d35` | `VERT[800]` | Direct. |
| E5 | `pages/farmer/Settings.tsx` | `#174d35` | `VERT[800]` | Direct. |
| E6 | `pages/farmer/Settings.tsx` | `#24352b` | `ENCRE[700]` | Direct — gris-vert de texte, pas la marque. |
| E7 | `pages/farmer/Settings.tsx` | `#dce5dc` | `rgba(18,61,42,.10)` | Direct — filet de séparation, c'est le rôle bordure. |
| E8 | `pages/farmer/Settings.tsx` | `#ffffff` (×9) | `BLANC[95]` | Direct — surface, le §3 la veut à 85 % de blanc. |
| E9 | `pages/public/Home.tsx` | fond `COLORS.gold` | `COLORS.goldSurface` | **Correction d'une régression que j'avais introduite** — voir §H. |
| E10 | `pages/public/Home.tsx` | texte `COLORS.textPrimary` sur or | `COLORS.onGoldSurface` | Idem : 2,58:1 → 5,48:1. |
| E11 | `pages/app/Profile.tsx` | barre `COLORS.gold` | `COLORS.goldSurface` | A5 — l'or en surface. |

## F. Mobile — couleurs en dur (30 lignes)

| # | Fichier | Avant | Après | Décision |
| -- | -- | -- | -- | -- |
| F1 | `components/ui/Button.tsx` | texte `#2A1F0C` | `CREME[100]` | Direct — texte clair sur fond sombre. |
| F2 | `components/ui/Button.tsx` | variante `gold` = `GRADIENTS.gold` | `GRADIENTS.forestSoft` | **B1** — un bouton principal ordinaire est toujours `vert-800` (11,27:1). L'ancien dégradé tombait à **1,63:1** sur son extrémité claire. |
| F3 | `components/ui/Chip.tsx` | `#8A6420` | `TERRE[700]` | Direct par rôle. 4,81:1 → 5,78:1. |
| F4 | `components/ui/Chip.tsx` | `#4E8A38` | `VERT[600]` | **Correction de contraste réelle** : 3,78:1 → 6,40:1. |
| F5 | `components/ui/Chip.tsx` | bordure `rgba(214,166,79,.45)` | `rgba(219,138,76,.45)` | Direct — l'ancien or, hors palette. |
| F6 | `components/ui/States.tsx` | `#8A6420` | `TERRE[700]` | Direct. |
| F7 | `components/ui/ProvenanceTag.tsx` | `#24352b` | `ENCRE[700]` | Direct. |
| F8 | `components/ui/ProvenanceTag.tsx` | `#66736b` (×2) | `ENCRE[500]` | Direct. 4,60:1 → 5,53:1. |
| F9 | `components/ui/Input.tsx` | `#a7b2aa` (×2) | `ENCRE[500]` | Direct — texte d'aide. |
| F10 | `components/ui/Input.tsx` | `#fcfdfb` | `CREME[50]` | Direct. |
| F11 | `components/ui/Accordion.tsx` | `#fcfdfb` | `CREME[50]` | Direct. |
| F12 | `components/ui/MapPreview.tsx` | `#fbfcf9` | `CREME[50]` | Direct. |
| F13 | `components/ui/PressableScale.tsx` | `#10261b` | `VERT[950]` | Direct — vert le plus sombre. |
| F14 | `components/ui/HeroBackground.tsx` | `#0c2118` | `VERT[950]` | Direct. |
| F15 | `components/ui/HeroBackground.tsx` | `#12321f` | `VERT[900]` | Direct. |
| F16 | `components/ui/Card.tsx` | ton `gold` = `COLORS.gold` | `COLORS.goldSurface` | **A5** — l'or en surface. |
| F17 | `components/ui/Card.tsx` | bordure `rgba(42,31,12,.18)` | `rgba(18,61,42,.18)` | Direct — l'ancien brun, hors palette. |
| F18 | `components/public-site/PublicShell.tsx` | `#10261b` | `VERT[950]` | Direct. |
| F19 | `public-site/home/ClosingSections.tsx` | `#0c2118` | `VERT[950]` | Direct. |
| F20 | `public-site/home/DataSections.tsx` | `#EAF0E9` | `VERT[100]` | Direct, ±4,9 % de luminosité. |
| F21 | `public-site/home/ServicesSection.tsx` | `#4E8A38` | `VERT[600]` | Direct. |
| F22 | `public-site/home/ServicesSection.tsx` | `#8A6420` | `TERRE[700]` | Direct. |
| F23 | `public-site/home/Hero.tsx` | `backgroundColor: COLORS.gold` (×2) | `COLORS.goldSurface` | **A5**. |
| F24 | `public-site/PublicFooter.tsx` | `backgroundColor: COLORS.gold` (×2) | `COLORS.goldSurface` | **A5**. |
| F25 | `app/public-site/sols.tsx` | `#EAF0E9` | `VERT[100]` | Direct. |
| F26 | `app/public-site/farm/[slug].tsx` | `#10261b` | `VERT[950]` | Direct. |
| F27 | `app/explore.tsx` | `#EAF2E7` | `VERT[100]` | Direct. |
| F28 | `app/services.tsx` | `#4E8A38` · `#8A6420` | `VERT[600]` · `TERRE[700]` | Direct. |
| F29 | `app/weather.tsx` | `color="#F6F7F2"` (×3) | `CREME[100]` | Direct — texte clair sur section sombre. |
| F30 | `theme/shadows.ts` | `GRADIENTS.gold` | voir D1 | Report de D1, listé ici car le fichier est mobile. |

---

## G. Ambiguïtés

**Aucune.** Les quatre de la version 1 sont tranchées par vos décisions :

- **B1** — bouton principal mobile : passé sur `vert-800`, texte `creme-100` (11,27:1). Règle
  appliquée : un bouton principal ordinaire est toujours `vert-800` ; `terre-700` reste réservé
  aux CTA partenaire/investisseur. **Ce bouton n'est pas le CTA investisseur** — c'est le bouton
  d'action générique de l'application, d'où le vert.
- **B2** — `TINTS` et `DARK` : **recalculés maintenant**, formule documentée dans le code,
  trois écrans vérifiés (voir le compte rendu §6).
- **B3** — deux verts / deux terres : validé, rien changé. Règle ajoutée dans le code :
  la terre n'est jamais la couleur d'un bouton principal ordinaire.
- **B4** — « Plages agronomiques » : **5 occurrences intactes**, vérifié par grep.

## H. Ce que la version 1 de cette table affirmait à tort

Trois affirmations étaient fausses. Elles sont corrigées ici pour que la trace soit honnête.

1. **« Le texte d'erreur gagne du contraste. »** Faux, c'est l'inverse : `#a02e26` sur `#fdf3f2`
   donnait **6,62:1** ; `#b91c1c` sur `#fef2f2` donne **5,91:1**. Le contraste **baisse**. Il reste
   au-dessus de 4,5:1, donc pas de défaut d'accessibilité — mais le mouvement est inverse à celui
   que j'annonçais. Le 6,52:1 que je citais était le contraste de `vert-600` sur blanc : deux
   lignes avaient été mélangées.

2. **« Trois couleurs corrigeaient un échec de contraste. »** Une seule le faisait vraiment.
   Avec les fonds réellement rendus : la puce `living` passait bien de **3,78:1** (sous AA) à
   **6,40:1** — correction réelle. Mais la puce `gold` était déjà à **4,81:1**, donc conforme ;
   son passage à 5,78:1 est un alignement de palette, pas une correction. Et le bouton mobile
   n'avait **aucun** problème avant.

3. **« Le bouton mobile avait un texte illisible à corriger. »** Faux : `#2A1F0C` sur l'or
   `#D6A64F` donnait **7,25:1**, parfaitement lisible. C'est **mon** changement — l'or devenu
   `terre-700` — qui a fait tomber ce bouton à **1,63:1** sur l'extrémité claire de son dégradé.
   L'or portait du contraste, pas seulement de la décoration. J'ai introduit cette régression,
   elle est corrigée par F2 et F16/F23/F24.
