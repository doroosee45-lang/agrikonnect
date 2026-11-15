# Audit de l'internationalisation (i18n) — AGRIKONNECT AFRICA (application web)

> Périmètre : `apps/web/src`. Méthode : lecture de `i18n/*`, recherche exhaustive des appels `t()` et inventaire automatique des chaînes visibles (texte JSX, propriétés `label`, `title`, `description`, `placeholder`… et littéraux accentués) dans les 204 fichiers `.ts/.tsx`. Inventaire exécuté hors du dépôt. Aucun fichier modifié.
>
> Anomalie principale : **FE-E02** de [RAPPORT_AUDIT_FRONTEND.md](RAPPORT_AUDIT_FRONTEND.md).

## 1. Verdict

| Exigence (spécification §4.1 : « i18n fr/en via useI18nStore ; dates et nombres localisés ») | Statut |
|---|---|
| Mécanisme i18n (store, hook, clés typées, repli) | **CONFORME** (bien conçu) |
| Dictionnaires fr/en avec parité | **CONFORME** (173 clés de chaque côté, parité imposée par le type) |
| Utilisation des traductions dans l'interface | **NON IMPLÉMENTÉ** (9 appels `t()` sur environ 2 000 textes) |
| Changement dynamique de langue | **PARTIELLEMENT IMPLÉMENTÉ** (ne change que le pied de page et les formats) |
| Persistance de la langue | **NON CONFORME** (écrite, jamais relue) |
| Attribut `lang` du document | **NON CONFORME** (statique `fr`) |
| Formats dates, nombres, devises | **PARTIELLEMENT IMPLÉMENTÉ** (utilitaires localisés, mais `fr-FR` codé en dur à 16 endroits et devise par défaut erronée) |
| RTL | **NON APPLICABLE** (aucune langue RTL prévue) |

## 2. Architecture du système i18n (faits vérifiés)

| Élément | Emplacement | Constat |
|---|---|---|
| Dictionnaire source | `src/i18n/fr.ts:6-200` | 173 clés en 8 espaces de noms |
| Dictionnaire anglais | `src/i18n/en.ts:4` | `export const en: Dictionary` : parité imposée à la compilation (`fr.ts:208-210`, type `Widen`) |
| Clés typées | `src/i18n/index.ts:15-22` | `TranslationKey = Paths<Dictionary>` : `t('clé.inexistante')` ne compile pas (bon) |
| Traduction | `src/i18n/index.ts:39-47` | Repli sur le français puis sur la clé brute ; interpolation `{param}` |
| Store | `src/i18n/index.ts:56-71` | Zustand ; `locale` initiale `'fr'` ; `setLocale` persiste ; `hydrate()` relit |
| Hook | `src/i18n/index.ts:74-82` | `useI18n()` → `{ t, locale, setLocale }` |
| Langues | `src/i18n/index.ts:84-87` | `fr`, `en` |
| Stockage | `src/lib/secure-storage.ts:14,25-32` | Clé `agrikonnect.locale` écrite dans `sessionStorage` **et** `localStorage` |
| En-tête API | `src/services/http.ts:67-68` | `Accept-Language` envoyé à chaque requête (bon) |

### Répartition des clés

| Espace de noms | Clés | Clés utilisées dans l'interface |
|---|---:|---:|
| `common` | 37 | 1 (`common.seeAll`) |
| `nav` | 19 | 0 |
| `home` | 44 | 8 (`footerNote`, `footerLegal`, `footerPrivacy`, `footerTerms`, `newsletterTitle`, `newsletterPlaceholder`, `newsletterCta`, `newsletterError`) |
| `auth` | 24 | 0 |
| `farmer` | 21 | 0 |
| `provenance` | 11 | 0 |
| `roles` | 8 | 0 |
| `errors` | 9 | 0 (référencées par `ERROR_KIND_I18N`, `services/types.ts:89-99`, elle-même jamais utilisée) |
| **Total** | **173** | **9 (5 %)** |

**164 clés (95 %) sont donc définies et traduites mais jamais affichées.** Par exemple, l'en-tête n'utilise pas `nav.*` (`components/layout/Header.tsx:10-18` code « Accueil », « Marché »…), et la connexion n'utilise pas `auth.*` (`pages/auth/Login.tsx:59,67,75,84`).

## 3. Anomalies

### I18N-01 — Les traductions ne sont pas utilisées (FE-E02) · ÉLEVÉ · NON IMPLÉMENTÉ
- **Preuve :** seulement 9 appels `t()` dans le code, tous dans 2 fichiers :
  - `components/layout/Footer.tsx:99,122,135,141,145,156,157,158` ;
  - `pages/public/CountryLanguageSelector.tsx:34`.
- **Ampleur :** environ **2 020** chaînes visibles dans les `.tsx` et environ **226** dans les fichiers de données `.ts` : `lib/space-nav.ts` (≈ 150 libellés de menu), `lib/service-catalog.ts` (≈ 40), `pages/public/homeSlides.ts` (≈ 30), `lib/platform.ts` (≈ 6). **185 fichiers** contiennent du texte visible et aucun `t()`.
- **Répartition par zone (approximation par script) :**

| Zone | Fichiers | Chaînes en dur |
|---|---:|---:|
| `pages/admin` | 41 | 486 |
| `pages/farmer` | 40 | 398 |
| `pages/app` | 23 | 290 |
| `pages/public` | 20 | 183 |
| `pages/organization` | 9 | 113 |
| `components` (layout, ui, pages, hero) | 23 | 104 |
| `pages/market` | 10 | 83 |
| `pages/developers` | 4 | 67 |
| `pages/investment` | 5 | 65 |
| `pages/auth` | 7 | 62 |
| `pages/reviewer` | 2 | 52 |
| `pages/ai` | 4 | 33 |
| autres (`agent`, `international`, `insights`, `design-system`, racine) | 15 | 88 |

- **Fichiers les plus chargés :**
  - `pages/admin/AgronomicRanges.tsx` (47) ;
  - `pages/farmer/index.tsx` (42) ;
  - `pages/public/Home.tsx` (42) ;
  - `pages/admin/Dashboard.tsx` (41) ;
  - `pages/organization/index.tsx` (41) ;
  - `pages/public/About.tsx` (41) ;
  - `pages/admin/Admin.tsx` (39) ;
  - `pages/reviewer/Missions.tsx` (37) ;
  - `pages/app/Transport.tsx` (36) ;
  - `pages/investment/index.tsx` (35).
- **Composants partagés concernés.** Ils sont à traiter en premier, car chaque correction profite à des dizaines d'écrans :

| Fichier:ligne | Texte codé en dur |
|---|---|
| `components/ui/States.tsx:70` | « Une erreur est survenue » |
| `components/ui/States.tsx:93` | « Réessayer » |
| `components/pages/ResourcePage.tsx:56-57` | « Aucune donnée », « L'API n'a renvoyé aucun enregistrement… » |
| `components/pages/ResourcePage.tsx:147` | « Ouvrir » |
| `components/pages/ResourcePage.tsx:157` | « … enregistrement(s) renvoyé(s) par l'API » |
| `components/ui/AuthGate.tsx:32,35` | « Se connecter », « Créer un compte » |
| `components/layout/AppLayout.tsx:159-172,231,298,341,348` | textes de la carte d'état, libellés ARIA, « Site public », « Connexion », « S'inscrire » |
| `lib/space-nav.ts` | tous les menus des espaces |

- **Conséquence :** en anglais, l'interface reste en français, hormis le pied de page. L'exigence fr/en n'est pas remplie.
- **Correction :** voir §5.

### I18N-02 — La langue choisie n'est pas persistée · ÉLEVÉ · NON CONFORME
- **Preuves :**
  - `setLocale` écrit `agrikonnect.locale` (`i18n/index.ts:60-64`) ;
  - `hydrate()` (`:66-70`) n'est **appelé nulle part**. La recherche de `hydrate(` hors de sa définition ne renvoie aucun résultat ;
  - l'état initial est toujours `'fr'` (`:57`).
- **Conséquence :** à chaque rechargement, retour au français, et `Accept-Language: fr` est envoyé à l'API même si l'utilisateur a choisi l'anglais.
- **Correction :** `await useI18nStore.getState().hydrate()` dans `main.tsx` avant `createRoot().render`, ou état initial lu de façon synchrone depuis le stockage. Option : se baser sur `navigator.language` à la première visite.
- **Test :** choisir EN, recharger : EN est conservé et l'en-tête `Accept-Language: en` est envoyé.

### I18N-03 — `lang` du document figé · MOYEN · NON CONFORME
- **Preuve :** `index.html:2` contient `<html lang="fr">`, et aucune écriture de `document.documentElement.lang` n'existe dans le code.
- **Conséquence :** les lecteurs d'écran prononcent l'anglais avec une phonétique française ; la césure et l'orthographe du navigateur sont faussées (WCAG 3.1.1).
- **Correction :** un `useEffect` sur `locale` qui met à jour `document.documentElement.lang`.

### I18N-04 — Traductions contournées par des ternaires · MOYEN · À AMÉLIORER
- **Preuves :**
  - `components/layout/Footer.tsx:67-71` (état de l'API) ;
  - `Footer.tsx:126-128` (texte du bloc « prix ») ;
  - `Footer.tsx:131` (`label` de l'e-mail) ;
  - `Footer.tsx:153,160` (`aria-label`) : `locale === 'fr' ? '…' : '…'`.
- **Conséquence :** des textes échappent au dictionnaire, ce qui empêche d'ajouter une langue sans toucher au code.
- **Correction :** déplacer ces textes vers des clés `footer.*`.

### I18N-05 — Sélecteur de langue peu accessible · MOYEN · À AMÉLIORER
- **Preuves :** le changement de langue n'est possible qu'à trois endroits :
  - en bas du pied de page public (`Footer.tsx:160-172`) ;
  - dans `/farmer/settings` (`pages/farmer/Settings.tsx:30,45`) ;
  - dans `/public/country-language` (`pages/public/CountryLanguageSelector.tsx`).
  Il est absent de l'en-tête et de la barre des espaces métier : la coquille d'espace (`AppLayout.tsx`) n'affiche pas le pied de page.
- **Conséquence :** un utilisateur connecté (hors producteur) ne peut pas changer de langue.
- **Correction :** sélecteur dans `Header` et dans la barre de `AppLayout`.

### I18N-06 — Messages d'erreur non traduits · MOYEN · NON CONFORME
- **Preuves :**
  - `ErrorState` affiche `error.message` brut (`components/ui/States.tsx:70`). Ce texte vient du backend (français) ou d'axios (« Network Error », « timeout of 20000ms exceeded », en anglais) ;
  - message réseau par défaut codé en dur en français (`services/http.ts:82`) ;
  - `RequestError.kind` (`services/types.ts:64-74`) et `ERROR_KIND_I18N` (`:89-99`) sont prévus mais inutilisés.
- **Conséquence :** langues mélangées sur un même écran, messages techniques incompréhensibles.
- **Correction :** dans `ErrorState`, afficher `t(ERROR_KIND_I18N[error.kind])`, plus le détail serveur repliable ; erreurs de champ (`error.fields`) sous les champs.

### I18N-07 — Formats localisés partiellement · MOYEN · PARTIELLEMENT IMPLÉMENTÉ
- **Ce qui fonctionne :**
  - `lib/format.ts` utilise `Intl` (`NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`) avec `BCP = { fr: 'fr-FR', en: 'en-GB' }` (`format.ts:5`) ;
  - 110 fichiers importent `useI18n` pour passer `locale` aux formateurs.
- **Défauts :**
  - 16 `fr-FR` codés en dur, par exemple la date de la barre d'espace (`components/layout/AppLayout.tsx:200`) ;
  - des appels omettent `locale` et retombent sur `'fr'` : `pages/admin/AuditLog.tsx:224`, `pages/admin/Jobs.tsx:163-164`, `pages/admin/Monitoring.tsx:112`, `pages/admin/Notifications.tsx:220` ;
  - devise par défaut `XOF` (`format.ts:7`) alors que le contexte principal est la RDC (`CD` par défaut, `Register.tsx:44`) ;
  - `maximumFractionDigits: 0` (`format.ts:44`) supprime les centimes (USD, EUR) ;
  - locales génériques `fr-FR` et `en-GB` plutôt que régionales (`fr-CD`, par exemple) : choix acceptable, à documenter ;
  - unités codées en dur hors `Intl` (`' ha'`, `' kg'`, `' t'`, `format.ts:52-60`) : acceptable, mais les clés `common.hectares` et `common.tons` existent et sont inutilisées.
- **Correction :** toujours passer `locale` (ou utiliser un hook `useFormat()` qui l'injecte) ; supprimer la devise implicite ; laisser `Intl` choisir les décimales.

### I18N-08 — Cohérence linguistique · FAIBLE · À AMÉLIORER
- **Constats :**
  - tutoiement isolé : « Connecte-toi pour consulter la fiche d'un compte. » (`pages/admin/UserDetail.tsx:92`), alors que le vouvoiement est la norme ;
  - accents manquants : « Securite » (`components/layout/AdminSidebar.tsx:47`, fichier mort) ;
  - jargon technique en français dans l'interface : « GET /admin/dashboard », « renvoyé par l'API » (36 occurrences ; voir FE-F07) ;
  - en anglais, 16 valeurs identiques au français, toutes légitimes (« Services », « FAQ », « Notifications », « Zones », « Satellite »…) : aucune traduction manquante dans `en.ts`.

## 4. Fichiers de traduction

| Fichier | Lignes | Clés | Constat |
|---|---:|---:|---|
| `src/i18n/fr.ts` | 211 | 173 | Source de vérité ; échappements `’` pour l'apostrophe typographique |
| `src/i18n/en.ts` | 199 | 173 | Parité 100 % ; espaces réservés `{param}` identiques (vérifié) |
| `src/i18n/index.ts` | 88 | — | Moteur ; `hydrate` inutilisé |

Aucun fichier de traduction pour d'autres langues (lingala, swahili, portugais…) : non exigé par la spécification.

## 5. Plan de mise en conformité recommandé

1. **Socle** (½ j) :
   - `hydrate()` au démarrage ;
   - synchronisation de `lang` ;
   - sélecteur dans l'en-tête et dans la barre d'espace ;
   - suppression des ternaires du pied de page.
2. **Garde-fou** (½ j) : règle de lint interdisant le texte JSX brut et les littéraux dans `label`, `title`, `placeholder` et `aria-*`, en avertissement puis en erreur par dossier migré.
3. **Composants partagés** (1 j) : `States`, `ResourcePage`, `DetailPage`, `AuthGate`, `AppLayout`, `Header`, `Footer`, `space-nav` (150 libellés).
4. **Erreurs** (½ j) : `ERROR_KIND_I18N` dans `ErrorState` ; erreurs de champ.
5. **Écrans, par ordre d'usage** (≈ 10 à 12 j) : authentification → public → producteur → espace connecté → marché → organisation → investissement → administration. Un espace de noms par domaine, avec relecture anglaise.
6. **Formats** (½ j) : hook `useFormat()` ; suppression des `fr-FR` ; devise explicite.

**Test d'acceptation :** le script d'inventaire des chaînes en dur renvoie 0. Une revue visuelle en EN de 2 écrans par espace ne montre aucun texte français. La langue est conservée après rechargement.
