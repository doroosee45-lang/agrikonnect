# Audit UI/UX, responsive et accessibilité — AGRIKONNECT AFRICA (application web)

> **Méthode :** analyse du code (structure, styles, points de rupture, composants, textes, attributs ARIA) et comparaison avec la spécification §4 (`apps/web/AGRIKONNECT AFRICA — Spécification fonctionnelle et technique.md`). Les contrastes sont calculés à partir des jetons de couleur.
>
> **Limite :** aucun rendu navigateur ni test sur appareil réel n'a été effectué (pas de backend démarré, base distante réelle non sollicitée). Le rendu visuel effectif est donc **NON VÉRIFIABLE** : les constats ci-dessous portent sur ce que le code impose.
>
> Les identifiants FE-xx renvoient à [RAPPORT_AUDIT_FRONTEND.md](RAPPORT_AUDIT_FRONTEND.md).

## 1. Synthèse

| Axe | Statut | Points clés |
|---|---|---|
| Cohérence visuelle | À AMÉLIORER | Palette et typographie cohérentes (jetons `theme/`) ; trois systèmes de composants concurrents ; styles en ligne majoritaires |
| Navigation | NON CONFORME | 18 liens cassés ; entrées publiques vers des écrans réservés ; déconnexion cachée ; pas de garde de permission ni d'écran 403 |
| États (chargement, vide, erreur) | CONFORME en grande partie | Squelettes et états vide et erreur systématiques via `ResourcePage` et `DetailPage` ; messages d'erreur bruts |
| Modales et confirmations | NON IMPLÉMENTÉ | Aucune modale ; un seul `window.confirm` |
| Formulaires | À AMÉLIORER | Désactivation pendant l'envoi ; validation HTML5 ; erreurs serveur par champ non affichées |
| Responsive | PARTIELLEMENT IMPLÉMENTÉ | Tiroir mobile OK ; formulaires 2 colonnes figés ; points de rupture incohérents ; tableaux non adaptés |
| Accessibilité | NON CONFORME (probable) | Pas de lien d'évitement ; focus peu visible ; contrastes insuffisants sur certains éléments ; `<a><button>` imbriqués |
| Données affichées | NON CONFORME | 40 mini-graphiques fictifs (FE-E08) ; jargon technique |

## 2. Cohérence visuelle

### 2.1 Fondations (faits vérifiés)

- **Couleurs :** une palette unique est définie à deux endroits synchronisés :
  - `src/theme/agrikonnect.ts`, en TS : `VERT`, `TERRE`, `ENCRE`, `ROUGE`… ;
  - `src/theme/tokens.css`, en CSS : 110 variables `--vert-*`, `--terre-*`…

  `COLORS` (`theme/index.ts:23-60`) les réexpose sous des noms sémantiques (`forestGreen`, `slateGray`, `error`). Aucune couleur hexadécimale n'est codée en dur dans les `.tsx` : **CONFORME** à la règle I3.
- **Typographie :** Inter et JetBrains Mono (`index.html:12-16`) ; préréglages `Text` (`components/ui/Text.tsx`).
- **Espacements, rayons, durées :** `SPACING`, `RADIUS`, `DURATION`, `EASE` (`theme/index.ts`).

### 2.2 Incohérences

| # | Constat | Preuve | Effet | Recommandation |
|---|---|---|---|---|
| V1 | **Trois systèmes de composants** : `components/ui` (Button, Card, Chip, Field…), `components/kit.tsx` (Bouton, Champ, Carte, Reveal…), `design-system/` (Sidebar, StatCard, ChartCard, HorizonDashboard, en Tailwind) | `components/kit.tsx:6-15` (« À réutiliser avant de créer un nouveau composant ») mais 1 seul importateur ; `components/ui/index.ts` 165 importateurs | Rendus différents d'un espace à l'autre ; doublons | Fusionner sur un système (FE-M14) |
| V2 | **Styles en ligne majoritaires** : 1 404 `style={{…}}` contre 494 `className` | recherche dans `src/` | Pas d'états `:hover`/`:focus-visible`/media queries possibles en ligne ; incohérences fines | Classes ou composants stylés |
| V3 | **Tailwind utilisé** alors que la spécification dit « pas de Tailwind » (§4.1) | `vite.config.ts:7`, `design-system/index.css`, `AppLayout.tsx:209-380` | Deux grammaires de style | Décision d'architecture à acter |
| V4 | Coquille des espaces (Tailwind, `AppLayout`) visuellement distincte des pages (styles en ligne `Section`/`Card`) ; `Section` et `AuthGate` imbriqués deux fois dans certaines pages | `admin/Users.tsx:49-56` + `ResourcePage.tsx:162-172` | Marges doublées | Une seule enveloppe par page |
| V5 | Icônes hétérogènes : emojis (`icon="👥"`, `"🛒"`, `"ℹ️"`), SVG maison (`components/Icons.tsx`), icônes du design system | `ResourcePage.tsx:105`, `market/MarketPublic.tsx:16` | Rendu variable selon l'OS ; emojis lus par les lecteurs d'écran | Jeu d'icônes SVG unique, `aria-hidden` |

## 3. Expérience utilisateur et navigation

### 3.1 Parcours et navigation

| # | Constat | Preuve | Statut |
|---|---|---|---|
| N1 | **18 liens internes cassés**, dont l'ouverture d'une conversation, le détail d'une commande et le contact d'une annonce | FE-E04 | NON CONFORME |
| N2 | **Navigation publique vers des écrans réservés** : « Marché », « Données », barre « Conseils agricoles » (`/farmer/soil`, `/farmer/plots`) | `Header.tsx:14,17,52-54` ; FE-E07 | NON CONFORME |
| N3 | **Déconnexion** uniquement dans `/app/profile` | `pages/app/Profile.tsx:168` ; FE-M03 | À AMÉLIORER |
| N4 | **Pas d'écran 403** ; le menu admin complet est affiché aux non-administrateurs | `AppLayout.tsx:132-133,143` ; FE-M01 | NON CONFORME |
| N5 | **Flash « Se connecter »** pendant le démarrage ; perte de la page demandée après connexion | FE-M02 | À AMÉLIORER |
| N6 | **Fil d'Ariane** réduit à « Espace / Page » ; pas de recherche globale ni de badge MFA dans l'en-tête admin, contrairement à la spécification §4.2 | `AppLayout.tsx:243-261` | PARTIELLEMENT IMPLÉMENTÉ |
| N7 | **Pages en double** : `/app/plots` et `/farmer/plots`, `/app/farms` et `/farmer/farms`, `/market` et `/market/listings` : l'utilisateur ne sait pas lequel utiliser | FE-M15 | À AMÉLIORER |
| N8 | **`/admin`** affiche un « Catalogue des modules » alors que la spécification §5.1 y place le tableau de bord M1 | `App.tsx:255`, `pages/admin/Admin.tsx` | À AMÉLIORER |
| N9 | **Sélecteur d'organisation** absent sous 768 px | `AppLayout.tsx:264-269` ; FE-E03 | NON CONFORME |
| N10 | Bon point : **barre latérale** avec repli en rail (≥ 1 024 px), tiroir (< 768 px), `aria-current="page"` et fermeture par Échap | `design-system/components/Sidebar.tsx:302,366`, `AppLayout.tsx:179-186` | CONFORME |

### 3.2 États de chargement, vide et erreur

- **Couverture :**
  - `LoadingState` (squelettes) : 65 fichiers ;
  - `EmptyState` : 36 fichiers ;
  - `ErrorState` (avec « Réessayer » et identifiant de requête) : 73 fichiers.

  Les socles `ResourcePage`, `DetailPage` et `PlotModule` imposent ces trois états à 79 écrans. La spécification §4.1 (« États systématiques ») est respectée pour l'essentiel : **CONFORME**.
- **Exceptions :** `pages/farmer/PublicProfile.tsx` ne traite pas l'erreur de sa requête (aucune référence à `error` ou `isError`).
- **Qualité des messages :**
  - textes d'erreur bruts (anglais d'axios, français du serveur) ;
  - mentions techniques à l'écran : « GET /admin/dashboard » (`admin/Dashboard.tsx:294,391`), « Agrégé en temps réel depuis GET /orders et GET /listings » (`market/MarketApp.tsx:223`), « … renvoyé(s) par l'API » (36 occurrences) ;
  - voir FE-M13 et FE-F07.
- **État vide par défaut** : « L'API n'a renvoyé aucun enregistrement pour cet écran » (`ResourcePage.tsx:57`) est formulé pour un développeur et non pour un utilisateur.

### 3.3 Modales, confirmations et retours

| Constat | Preuve | Statut |
|---|---|---|
| Aucun composant modal ou de dialogue (`role="dialog"` ou `aria-modal` absents de tout le code) | recherche dans `src/` | NON IMPLÉMENTÉ |
| Un seul `window.confirm` (suppression d'article de blog) | `admin/BlogPosts.tsx:136` | — |
| Actions destructives sans confirmation : suppression ou suspension de compte, révocation de rôle, de sessions, de clé API, retrait de consentement SMS | `admin/UserDetail.tsx:218,236,327,359`, `developers/Keys.tsx:214`, `app/SmsConsent.tsx:84` | NON CONFORME (spécification §4.3 ; FE-M09) |
| Retour après action : bandeau texte local (`setRapport`) dans `UserDetail`, pas de système de notifications éphémères commun | `admin/UserDetail.tsx:70-84` | À AMÉLIORER |

### 3.4 Formulaires et interactions

| Contrôle | Constat | Statut |
|---|---|---|
| Double soumission | 54 boutons avec `loading` et 44 avec `disabled` liés à `isPending` ; aucun bouton sans action détecté | CONFORME |
| Champs obligatoires | `required` HTML5 ; mention « facultatif » via `optionalLabel` (`Field.tsx:17-19`) | CONFORME |
| Formats | `type="email"`, `minLength={8}` (mot de passe), validation e-mail du pied de page (`Footer.tsx:58`), téléphone E.164 (`lib/phone.ts`) | À AMÉLIORER (pas de schéma commun) |
| Erreurs serveur par champ | `RequestError.fields` exploité une seule fois | NON CONFORME (FE-M13) |
| Mot de passe | Pas de confirmation à l'inscription ; pas d'affichage du mot de passe | FE-F09 |
| Consentement | Pas de case CGU ni confidentialité à l'inscription | FE-F09 |
| Import CSV | Annoncé « depuis un fichier », réalisé par copier-coller | FE-M17 |
| Recherche admin | Requête à chaque frappe, liste remplacée par le squelette à chaque caractère | FE-M06 |
| Pagination, tri, sélection multiple (spécification §4.2) | Absents | NON IMPLÉMENTÉ |
| Graphiques avec alternative tabulaire (spécification §4.2) | Absente | NON IMPLÉMENTÉ |

### 3.5 Contenu et données

- **Graphiques fictifs :** 40 mini-graphiques à valeurs codées en dur, présentés comme des tendances (FE-E08).
- **Lien de démonstration :** `/public/lots/demo`, à 4 emplacements (FE-M20).
- **« Newsletter » trompeuse :** l'abonnement mène à l'inscription (FE-F08).
- **Registre de langue :** tutoiement isolé (`admin/UserDetail.tsx:92`).
- **Points positifs :**
  - mentions de provenance (`ProvenanceTag`) et avertissements produit (`notice`) bien intégrés ;
  - coordonnées des producteurs masquées (`MarketPublic.tsx:22`).

## 4. Responsive design

### 4.1 Mécanismes en place

| Mécanisme | Preuve | Évaluation |
|---|---|---|
| Hook `useBreakpoint` (640/768/1 024/1 280) | `design-system/hooks/useBreakpoint.ts:8-13` | OK |
| Coquille d'espace : barre latérale (≥ 768), rail replié (768–1 023), tiroir (< 768) | `AppLayout.tsx:108-111,210-220,360-379` | Partiel : la spécification §4.2 demande le tiroir **sous 1 024 px** |
| En-tête public : menu mobile (`site-menu-toggle`, `aria-expanded`, `aria-controls`) | `Header.tsx` (≈ l. 197-210) | OK |
| Listes `ResourcePage` : cartes en `flexWrap` avec `minWidth: 240` | `ResourcePage.tsx:130-131` | OK sur mobile |
| Viewport | `index.html:5` | OK |

### 4.2 Anomalies

| # | Constat | Preuve | Appareils touchés | Statut |
|---|---|---|---|---|
| R1 | **Formulaires à deux colonnes figées en ligne**, sans media query possible | `auth/Register.tsx:79`, `farmer/Farms/Create.tsx:64`, `farmer/Plots/Create.tsx:66`, `farmer/Profile.tsx:59`, `market/NewListing.tsx:63`, `agent/Registration.tsx:66` | Smartphones 320–414 px | NON CONFORME (FE-M11) |
| R2 | **Points de rupture CSS hétérogènes** : `max-width` 560, 620, 640, 760, 980 (×3), 1 200 et `min-width` 640, 1 024 dans `theme/tokens.css`, contre l'échelle officielle 640/768/1 024/1 280 (`theme/index.ts`, `BREAKPOINT`) | `theme/tokens.css` | Tablettes (760–980) | À AMÉLIORER |
| R3 | **Tableaux non adaptés** : `minWidth: 620` (défilement horizontal) ; la spécification demande « les tableaux deviennent des cartes en mobile web » | `app/SeasonFeedback.tsx:362`, `app/Transport.tsx` | Smartphones | NON CONFORME |
| R4 | **Sélecteur d'organisation masqué** (`hidden md:inline-block`) | `AppLayout.tsx:269` | Smartphones | NON CONFORME (FE-E03) |
| R5 | **Date et action principale masquées** sur petit écran (`hidden lg:flex`, `hidden sm:inline-flex`), sans substitut dans le tiroir | `AppLayout.tsx:279,326` | Smartphones | À AMÉLIORER |
| R6 | **Carrousel** : 10 images plein écran chargées d'un coup (≈ 3 Mo) | `HeroCarousel.tsx:122-163` ; FE-M16 | Mobiles en 3G | NON CONFORME (performance) |
| R7 | **Images sans `width`/`height`**, d'où des décalages de mise en page | 16 `<img>`, 0 avec dimensions | Tous | À AMÉLIORER |
| R8 | **Cibles tactiles** : boutons d'en-tête de 34 px (`h-[34px]`, `w-[34px]`) dans la barre d'espace, alors que la spécification §4.1 demande ≥ 44 px (mobile) | `AppLayout.tsx:228-230,289-321` | Tactiles | NON CONFORME |
| R9 | **Débordement horizontal** : aucune largeur fixe ≥ 600 px hors R3 ; `overflowWrap: 'anywhere'` sur le blog | recherche des `width/minWidth` en ligne | — | CONFORME en dehors de R3 |

### 4.3 Matrice de comportement attendue (à valider en recette)

| Largeur | Coquille publique | Coquille d'espace | Formulaires | Listes |
|---|---|---|---|---|
| 320–639 (smartphone) | Menu mobile | Tiroir ; organisation **inaccessible** (R4) | **2 colonnes figées** (R1) | Cartes OK ; tableaux en défilement (R3) |
| 640–767 | Menu mobile | Tiroir | Idem | Idem |
| 768–1 023 (tablette) | Navigation complète selon CSS | Rail replié (la spécification attend le tiroir) | 2 colonnes OK | OK |
| ≥ 1 024 (portable, bureau) | Complète | Barre latérale dépliable | OK | OK |

## 5. Accessibilité

Référentiel : WCAG 2.1 AA / RGAA 4.1. Les constats portent sur le code ; un audit outillé (axe-core) et un test avec lecteur d'écran restent à mener (**NON VÉRIFIABLE** ici).

| # | Critère | Constat | Preuve | Statut |
|---|---|---|---|---|
| A1 | 2.4.1 Contourner des blocs | Aucun lien « Aller au contenu » | recherche dans `src/` | NON CONFORME |
| A2 | 2.4.7 Focus visible | `Input` et `TextArea` en `outline: 'none'` ; le focus n'est signalé que par un changement de couleur de bordure de 1,5 px. 9 `outline: none` au total ; seulement 3 règles `focus-visible` | `components/ui/Field.tsx:31,35-40,79` ; `theme/tokens.css:738` | NON CONFORME |
| A3 | 1.4.3 Contraste du texte | Texte blanc 12 px sur `bg-secondaire` (`--vert-500` `#239b68`) : **3,52:1** (< 4,5:1) — boutons « S'inscrire » et action principale d'espace | `AppLayout.tsx:326,345`, `design-system/index.css:14` | NON CONFORME |
| A4 | 1.4.3 (contrôle) | `slateGray` `#64736a` sur blanc : 5,00:1 ; sur `--vert-50` : 4,64:1 ; texte principal : 16,2:1 ; `error` `#b42318` : 6,57:1 ; blanc sur `forestGreen` : 9,96:1 | jetons `theme/agrikonnect.ts` | CONFORME |
| A5 | 1.4.11 Contraste non textuel | Bordure de champ `#E3EAE5` sur blanc : **1,22:1** (< 3:1) : le contour des champs est à peine perceptible | `theme/index.ts:41`, `Field.tsx:28` | NON CONFORME |
| A6 | 3.3.1 / 4.1.3 Erreurs | Message d'erreur de champ non relié (`aria-invalid`, `aria-describedby` absents) ; `ErrorState` sans `role="alert"` ; le pied de page, lui, le fait correctement (`Footer.tsx:137-147`) | `Field.tsx:43-47`, `States.tsx:70-95` | NON CONFORME |
| A7 | 4.1.1 / 2.1.1 Structure | Environ 50 `<Link><Button/></Link>`, soit un `<button>` dans un `<a>` (HTML invalide, double tabulation, rôle ambigu) | `ResourcePage.tsx:94-96,146-148`, `AuthGate.tsx:31-36` | NON CONFORME |
| A8 | 2.2.2 Pause | Carrousel à défilement automatique, mis en pause seulement au survol (souris) ; pas de bouton pause ; `prefers-reduced-motion` respecté | `HeroCarousel.tsx:36,57,77,118` | NON CONFORME |
| A9 | 3.1.1 Langue | `lang="fr"` figé, même en anglais | `index.html:2` ; I18N-03 | NON CONFORME |
| A10 | 1.1.1 Alternatives | Images du carrousel décoratives (`alt=""` + `role="presentation"`) ; `ServiceDetail` avec `alt` ; emojis d'icône non masqués | `HeroCarousel.tsx:146-148`, `ResourcePage.tsx:105` | À AMÉLIORER |
| A11 | 1.3.1 Étiquettes | Champs enveloppés dans `<label>` (association implicite) | `Field.tsx:14` | CONFORME |
| A12 | 4.1.2 Nom, rôle, valeur | Boutons de navigation mobile avec `aria-label` et `aria-expanded` ; sélecteur de langue en `aria-pressed` ; puces du carrousel avec `aria-label` et `aria-current` | `AppLayout.tsx:231-232`, `Footer.tsx:166`, `HeroCarousel.tsx:291` | CONFORME |
| A13 | 2.5.5 Taille des cibles | Boutons de 34 px dans la barre d'espace | `AppLayout.tsx` (R8) | À AMÉLIORER |
| A14 | Mouvement | `prefers-reduced-motion` pris en compte (carrousel, `useReveal`, 3 media queries CSS) | `hooks/useReveal.ts:12`, `tokens.css` | CONFORME |

## 6. Améliorations recommandées (par ordre de priorité)

1. **Navigation fiable :**
   - corriger les liens (FE-E04) ;
   - écran 403 et menus filtrés (FE-M01) ;
   - menu compte avec déconnexion (FE-M03) ;
   - sélecteur d'organisation et de langue accessibles partout.
2. **Sincérité des données :**
   - supprimer les mini-graphiques fictifs (FE-E08) ;
   - remplacer le jargon technique par des libellés métier (FE-F07) ;
   - état vide formulé pour l'utilisateur.
3. **Confirmations :** composant `ConfirmDialog` accessible pour toutes les actions destructives (FE-M09).
4. **Accessibilité de base :**
   - lien d'évitement ;
   - `:focus-visible` marqué ;
   - contraste du vert secondaire : texte blanc sur `--vert-600` ou `--vert-700` ;
   - bordures de champ ≥ 3:1 ;
   - erreurs reliées ;
   - `Button` polymorphe à la place de `<Link><Button>` ;
   - pause du carrousel.
5. **Responsive :**
   - grilles de formulaires fluides ;
   - échelle de points de rupture unique ;
   - tiroir sous 1 024 px ;
   - tableaux en cartes ;
   - cibles de 44 px ;
   - images responsives.
6. **Système de design unique** : fusionner `kit.tsx`, `components/ui` et `design-system` ; réduire les styles en ligne (FE-M14).
7. **Recette visuelle outillée** : captures de régression aux largeurs 320, 375, 768, 1 024 et 1 440 px, et axe-core en CI.
