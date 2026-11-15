# Audit UI/UX, navigation et accessibilité — Application mobile AGRIKONNECT AFRICA

**Référence :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md).

**Limite majeure :** aucun rendu sur appareil ou émulateur n'a été possible. Les constats reposent sur :
- le code (styles, structure, composants) ;
- la configuration native générée (introspection) ;
- des contrastes calculés à partir des jetons du thème.

Chaque constat de rendu non observé est marqué **(rendu NON VÉRIFIÉ)**.

---

## 1. Cohérence visuelle

| Élément | Constat (fait vérifié) | Statut |
|---|---|---|
| Jetons | Palette `VERT`, `TERRE`, `CREME`, `ENCRE`, `ROUGE`, `SCIENTIFIQUE` (`theme/agrikonnect.ts`), alias historiques `COLORS` (`theme/colors.ts`), espacements `SPACING`/`LAYOUT` (`theme/space.ts`), rayons, ombres, mouvements | CONFORME |
| Typographie | Presets `h1…caption` (`theme/typography.ts`), composant `Text` unique (`ui/Text.tsx:20-21`). Inter + JetBrains Mono chargés au démarrage | CONFORME / poids excessif (MOB-M16) |
| Composants de base | `Button`, `IconButton`, `Card`, `Chip`, `Input`, `TextArea`, `Section`, `Screen`, `StatCard`, `Skeleton`, `States` (Loading, Error, Empty, Auth, Advisory, Offline), `ProvenanceTag`, `Reveal`, `PressableScale` | CONFORME : bibliothèque cohérente |
| Deux styles graphiques | Composants « Horizon » (`ui/HorizonMobile.tsx`, 656 lignes, non suivi par git) utilisés par 16 écrans (tableaux de bord) à côté de `Card`/`Section` | À AMÉLIORER : deux langages visuels dans les tableaux de bord |
| Couleurs codées en dur | La règle « I3 : écrire un code hexadécimal dans un écran reste interdit » (`colors.ts:9`) est globalement respectée. Il subsiste des `rgba(...)` dans les écrans (`services/index.tsx`, `fiche.md`…) | À AMÉLIORER |
| Mode sombre | Non (`app.json:9`). Une palette `DARK` sert seulement au démarrage (`_layout.tsx:141`) | Décision produit (MOB-F04) |
| Doublons d'écrans | 16 routes publiques en double (`/annonces` et `/public-site/annonces`…), avec des rendus différents pour le même contenu | NON CONFORME (MOB-M14) |

## 2. Expérience utilisateur

### 2.1 États d'interface (mesure statique sur 214 écrans)

| État | Écrans | Remarque |
|---|---:|---|
| Chargement (`LoadingState` / squelettes) | 161 | Bonne couverture |
| Erreur (`ErrorState` avec nouvel essai) | 182 | 172 des 175 écrans qui appellent l'API directement. Exceptions : `admin/reports`, `farmer/public-profile`, `farmer/settings` |
| Vide (`EmptyState`) | 119 | Les listes sans état vide affichent une zone blanche (cas par cas) |
| Hors ligne (`OfflineNotice`) | **0** | Composant existant mais jamais monté (MOB-M02) |
| Tirer pour rafraîchir (`RefreshControl`) | **0** | Geste mobile standard absent. Le rafraîchissement ne se fait que par « Réessayer » sur erreur |

### 2.2 Interactions

| Constat | Preuve | Statut |
|---|---|---|
| Retour tactile | `PressableScale` (échelle + haptique légère, `PressableScale.tsx:29-31`) | CONFORME |
| Écrans et boutons factices | `farmer/settings.tsx:27-61` (interrupteurs et Enregistrer sans effet), `farmer/farms/[id].tsx:55`, `farmer/lots/[id].tsx:47-48` | NON CONFORME (MOB-E12) |
| Confirmations | 0 dialogue (`Alert.alert` absent). Révocation de clé API ou d'appareil, transitions de commande en un tap | NON CONFORME (MOB-M07) |
| Double soumission | Les boutons d'envoi passent en `loading` (`create.isPending`). Les ULID `Idempotency-Key` protègent côté serveur | CONFORME |
| Champs obligatoires | Bouton désactivé tant que le nom est vide (formulaires de création). Pas de mention visuelle « requis » cohérente : `optionalLabel` est utilisé de façon irrégulière | À AMÉLIORER |
| Validation | Inscription : contrôles e-mail, mot de passe et pays, mais **en retard d'un envoi** (`register.tsx:45-54`, MOB-M06). Ailleurs : erreurs serveur 422 affichées globalement | À AMÉLIORER |
| Saisie d'identifiants techniques | « Culture (ID) », « Exploitation (ID) » (4 formulaires) | NON CONFORME (MOB-M05) |
| Indicateurs inventés | Jauges de progression constantes (6 écrans) | NON CONFORME (MOB-M11) |
| Écrans connexion et inscription | `AuthShell` : colonne de marque + formulaire (`components/auth/AuthShell.tsx`). Connexion avec bascule MFA en ligne. Inscription avec puces de rôle (9), pays en saisie libre (`CI` par défaut) | À AMÉLIORER (pays sans sélecteur, rôles sensibles : MOB-E13) |
| Tableaux de bord | Admin, producteur, organisation, investissement, marché, vérificateur, agent : cartes Horizon alimentées par l'API, avec états | CONFORME (hors MOB-M11) |

## 3. Navigation mobile

| ID | Constat | Preuve | Statut |
|---|---|---|---|
| N1 | Barre d'onglets du producteur : 47 entrées, libellés techniques (`farms/index`), icône `ellipse` | `farmer/_layout.tsx:13-26`, `FarmerTabBar.tsx:66-82`, `expo-router/build/useScreens.js:163-168` | NON CONFORME (MOB-E03) (rendu NON VÉRIFIÉ) |
| N2 | Pas de menu, d'onglets ni de tiroir dans les espaces admin, organisation, investissement, vérificateur, agent, développeurs, international, IA | Un seul layout imbriqué (`farmer/_layout.tsx`). `AppHeader` n'offre que retour, site public, notifications et profil (`AppHeader.tsx:35-64`) | NON CONFORME (MOB-E04) |
| N3 | **80 routes sur 213 sans lien entrant** (≈ 30 admin, `/auth/mfa`, `/farmer/settings`, `/farmer/lots`, `/international/*`…) | Script de liens. Liste dans INVENTAIRE §3 | NON CONFORME (MOB-E04) |
| N4 | 4 liens cassés + 1 lien de démonstration | `international/tenders.tsx:34`, `marketplace/index.tsx:74,117`, `public-site/index.tsx:19`, `HeroCarousel.tsx:97` | NON CONFORME (MOB-M08) |
| N5 | Aucune garde de rôle : un utilisateur peut entrer dans un espace qui n'est pas le sien et n'y voir que des erreurs 403 | `_layout.tsx:98-133`, `States.tsx:126-141` | NON CONFORME (MOB-E05) |
| N6 | Le bouton « Espace producteur » du profil est proposé à tous les rôles | `profil.tsx:240-246` | NON CONFORME |
| N7 | Retour après connexion faux pour les routes dynamiques (`[id]` littéral) | `_layout.tsx:121` | NON CONFORME (MOB-M09) |
| N8 | Pile `auth` présentée en modale (glissement vertical), autres écrans en glissement horizontal | `_layout.tsx:69-78` | CONFORME |
| N9 | Bouton retour Android et geste de retour iOS : gérés par la pile. Le bouton retour d'`AppHeader` appelle `router.back()` sans repli si l'historique est vide (lien profond direct) | `AppHeader.tsx:35` | À AMÉLIORER (prévoir `router.canGoBack()` ou un repli vers l'accueil de l'espace) |
| N10 | En-tête surchargé : retour + titre + CTA + 3 icônes de 42 pt. Sur 360 dp, le titre est tronqué (`numberOfLines={1}`) | `AppHeader.tsx:33-66` | À AMÉLIORER (MOB-F09) (rendu NON VÉRIFIÉ) |
| N11 | Pas de « tirer pour rafraîchir » | 0 `RefreshControl` | À AMÉLIORER |

## 4. Interactions tactiles, clavier, zones sûres

| Sujet | Constat | Statut |
|---|---|---|
| Zones sûres et encoche | `Screen` enveloppe dans `SafeAreaView` (`edges` top + bottom par défaut, `Screen.tsx:40,63`). `AppHeader` utilise `edges=['top']`. La barre d'onglets ajoute `insets.bottom` (`FarmerTabBar.tsx:67`). Android bord à bord (`edgeToEdgeEnabled`) | CONFORME. Risque de double marge haute quand `Screen` (top) contient `AppHeader` (top) : **hypothèse**, rendu NON VÉRIFIÉ |
| Clavier | **0 `KeyboardAvoidingView`**, pas de `keyboardShouldPersistTaps`. Champs bas d'écran (message, formulaires longs) potentiellement masqués | NON CONFORME (MOB-M03) (rendu NON VÉRIFIÉ) |
| Types de clavier | `keyboardType` adapté (`email-address`, `phone-pad`, `numeric`, `decimal-pad`) sur environ 40 champs | CONFORME |
| Gestes | Gesture Handler installé. Aucun geste personnalisé (glisser pour supprimer, etc.) | Sans objet |
| Cibles tactiles | `IconButton` de 42 pt (`Button.tsx:147`) < 48 pt exigé par `TACTILE.mobile` (`agrikonnect.ts:238-242`) et par Android (48 dp). Les puces et liens texte n'ont pas de `hitSlop` | NON CONFORME (MOB-M12) |
| Animations | `Reveal` (232 usages) respecte « réduire les animations » via `useMouvementReducit` (`Reveal.tsx:15,78`) | CONFORME |

## 5. Adaptation aux tailles d'écran

| Constat | Preuve | Statut |
|---|---|---|
| Points de rupture | `useWindowDimensions` dans 29 fichiers, avec des seuils hétérogènes écrits en dur : 640, 700, 820, 860, 900 (×17), 1000. Les jetons `BREAKPOINT` (640/768/1024/1280, `theme/space.ts:39-44`) existent mais sont utilisés **0 fois** | À AMÉLIORER : utiliser les jetons communs |
| Largeur maximale | `LAYOUT.maxContentWidth = 1180` et `maxContentWidth` sur 8 écrans | CONFORME pour tablette et web |
| Petits écrans (≤ 360 dp) | En-tête surchargé (N10). Formulaires en `row2` (`farms/create.tsx:79-82` : « Code pays » + « Province » côte à côte) | À AMÉLIORER (rendu NON VÉRIFIÉ) |
| Tablettes | `supportsTablet: true`. iPad : 4 orientations autorisées (introspection) alors que l'application est conçue pour le portrait | À AMÉLIORER (MOB-F02) |
| Listes | Rendu `.map` de 100 éléments animés, une seule `FlatList` | NON CONFORME (MOB-M04) |
| Images | `expo-image` (`AppImage.tsx`, `HeroCarousel.tsx`), 25 JPG de 100 à 400 Ko embarqués, sans variantes de densité | À AMÉLIORER (MOB-M16) |
| Agrandissement du texte | Aucun `maxFontSizeMultiplier`. Onglets à 10 pt, en-têtes sur une ligne | NON VÉRIFIABLE sans appareil (risque de débordement) |

## 6. Accessibilité

### 6.1 Contrastes (calcul WCAG 2.1 sur les jetons, fait vérifié)

| Paire | Ratio | Exigence | Statut |
|---|---:|---|---|
| `textPrimary` ENCRE-700 #17231d / fond | ≈ 15:1 | 4,5:1 | CONFORME |
| `slateGray` ENCRE-500 #64736a / blanc | 5,00:1 | 4,5:1 | CONFORME |
| `slateGray` / `naturalWhite` #f5f8f5 | 4,67:1 | 4,5:1 | CONFORME (juste) |
| `slateGray` / `paleGreen` #e6f3ec | **4,38:1** | 4,5:1 | NON CONFORME (texte secondaire sur cartes `pale`) |
| `livingGreen` VERT-500 #239b68 en **texte** / blanc | **3,52:1** | 4,5:1 | NON CONFORME (surtitres `overline` : `a-propos.tsx:71`, `contact.tsx:87`, `explore.tsx:109`, `plan.tsx:187`) |
| `error` ROUGE-700 #b42318 / blanc | 6,57:1 | 4,5:1 | CONFORME |
| Bordure de champ `lightBorder` #E3EAE5 / blanc | **1,22:1** | 3:1 (composant) | NON CONFORME (`Input.tsx:155-157`) |
| Piste d'interrupteur inactive `lightBorder` + pouce blanc | **1,22:1** | 3:1 | NON CONFORME (`farmer/settings.tsx:18`) |
| Placeholder ENCRE-500 / blanc | 5,00:1 | 4,5:1 | CONFORME |

### 6.2 Lecteurs d'écran (TalkBack, VoiceOver)

| ID | Constat | Preuve | Statut |
|---|---|---|---|
| A1 | Libellé de champ non associé : le `Text` du libellé est séparé, et le `TextInput` ne reçoit pas `accessibilityLabel={label}` | `Input.tsx:163-189` | NON CONFORME |
| A2 | Bouton afficher/masquer le mot de passe : `accessibilityRole="button"` mais sans libellé | `Input.tsx:190-193` | NON CONFORME |
| A3 | `PressableScale` : 36 usages directs, **0** `accessibilityLabel`, 2 `accessibilityRole` | statistique `app/` + `components/` | NON CONFORME |
| A4 | `IconButton` : rôle `button` + libellé transmis (CONFORME quand le libellé est fourni). Les appels d'`AppHeader` sont libellés, mais en français seulement | `Button.tsx:161-163`, `AppHeader.tsx:35,60-64` | À AMÉLIORER (i18n) |
| A5 | Titres : `Text preset="h1/h2/h3"` sans `accessibilityRole="header"`, d'où l'impossibilité de naviguer par titres | `ui/Text.tsx:20-21` | NON CONFORME |
| A6 | Onglets du producteur : `accessibilityRole="tab"` + `accessibilityState.selected` (CONFORME), mais 47 onglets annoncés (MOB-E03) | `FarmerTabBar.tsx:105-108` | NON CONFORME |
| A7 | `Switch` sans libellé associé (le libellé est un `Text` voisin) | `farmer/settings.tsx:18`, `ai/index.tsx:137` | NON CONFORME |
| A8 | Erreurs : `AppErrorBoundary` en `accessibilityRole="alert"` (CONFORME). `ErrorState` n'annonce pas l'erreur (pas de `accessibilityLiveRegion` ni d'`AccessibilityInfo.announceForAccessibility`) | `AppErrorBoundary.tsx`, `States.tsx:76-104` | À AMÉLIORER |
| A9 | La couleur ne porte jamais seule le sens (puces = libellé + icône, règle A11 du thème) | `colors.ts:44-56`, `ProvenanceTag` | CONFORME |
| A10 | Réduction des animations respectée | `Reveal.tsx:78` | CONFORME |

## 7. Problèmes d'affichage (synthèse)

| Problème | Gravité | Réf. |
|---|---|---|
| Barre d'onglets à 47 entrées | ÉLEVÉ | MOB-E03 |
| Écrans inaccessibles faute de navigation | ÉLEVÉ | MOB-E04 |
| Écrans publics en erreur 401 | ÉLEVÉ | MOB-E07 |
| Textes en français quelle que soit la langue | ÉLEVÉ | MOB-E08 |
| Champs masqués par le clavier | MOYEN | MOB-M03 |
| Listes lourdes | MOYEN | MOB-M04 |
| Jauges inventées, libellé « 12 mois » | MOYEN | MOB-M11 |
| Contrastes et cibles | MOYEN | MOB-M12 |
| En-tête surchargé, iPad paysage | FAIBLE | MOB-F09, MOB-F02 |
| Messagerie sans heure ni défilement | MOYEN | MOB-M19 |

## 8. Recommandations d'amélioration

1. **Navigation par espace :** un layout par rôle (onglets de 4 à 5 entrées + Stack), une table de navigation unique partagée avec le web, une garde de rôle. Corriger la barre du producteur en priorité.
2. **Patron d'écran de liste :** `Screen scroll={false}`, `FlatList`, `RefreshControl`, `useInfiniteQuery`, états Loading/Error/Empty/Offline standardisés dans un seul composant `QueryList`.
3. **Patron de formulaire :** `KeyboardAvoidingView`, validation synchrone (zod est déjà en dépendance), sélecteurs (culture, exploitation, pays, devise) à la place des saisies d'identifiants, mention « requis » homogène, erreurs 422 par champ.
4. **Dialogue de confirmation** réutilisable pour les actions irréversibles.
5. **Accessibilité des composants de base :**
   - `Input` : `accessibilityLabel` + `accessibilityHint` (aide ou erreur) ;
   - `Text` titres : `accessibilityRole="header"` ;
   - `IconButton` : 48 pt ou `hitSlop` ;
   - `PressableScale` : libellé obligatoire en TypeScript quand il n'y a pas de texte enfant ;
   - jetons : `livingGreen` → VERT-700 en texte, bordure de champ ≥ 3:1.
6. **Un seul arbre public** et un seul langage visuel pour les tableaux de bord (Horizon ou `Card`).
7. **Recette sur appareils réels :** Android 6" d'entrée de gamme, iPhone SE, iPhone avec encoche, et iPad si `supportsTablet` est conservé, avec texte agrandi à 200 % et TalkBack/VoiceOver.
