# Rapport des corrections d'internationalisation (i18n) — AGRIKONNECT AFRICA

**Périmètre :**
- application web (`apps/web`) ;
- application mobile React Native / Expo (`apps/Mobile`) ;
- backend (`backend`).

**Mandat :** autorisation de correction limitée à l'i18n. Aucune modification sans rapport n'a été faite.

**Base de départ :** copie de travail du dépôt (commit `7b8fda2` + modifications non commitées préexistantes). Elle a été photographiée avant toute intervention. **Aucun commit n'a été créé.**

**Annexes :**
- [Annexe A — toutes les traductions de l'interface](ANNEXE_A_TRADUCTIONS_UI.md) (4 115 clés, français / anglais, application concernée) ;
- [Annexe B — fichiers modifiés et ajoutés](ANNEXE_B_FICHIERS_MODIFIES.md) ;
- catalogue backend : [`backend/src/shared/i18n/messages.en.js`](../backend/src/shared/i18n/messages.en.js) ;
- guide développeur : [`backend/docs/I18N.md`](../backend/docs/I18N.md).

---

## 1. Synthèse

| Indicateur | Avant | Après |
|---|---|---|
| Web — appels de traduction (`t`/`tr`) | 9 (2 fichiers) | **3 469** (202 fichiers) |
| Mobile — appels de traduction | 109 (21 fichiers) | **3 511** (241 fichiers) |
| Web — textes visibles en dur | ≈ 3 300 | **0 constaté** dans le navigateur sur les 174 routes (§3.4) ; quelques littéraux identiques en anglais ou non affichés, conservés volontairement (§7) |
| Mobile — textes visibles en dur | ≈ 3 300 | **0 relevé** par l'analyse statique (AST) ; pas de contrôle à l'écran (§7, R3) |
| Clés web / mobile (fr = en, parité vérifiée) | 173 / 173 | **2 743 / 2 680** (dont `ui.*` : 2 572 / 2 510) |
| Clés partagées web ↔ mobile, texte et traduction identiques | — | **1 140** |
| Bascule FR ↔ EN en direct, sans rechargement (web) | — | **oui**, vérifiée sur 11 espaces (§3.4) |
| Langue conservée au rechargement (web) | non | **oui** |
| Langue de l'appareil ou du navigateur à la 1re ouverture | non (fr imposé) | **oui** |
| Backend : langue des réponses | aucune gestion (fr + défauts Zod en anglais) | **fr / en selon `Accept-Language`** |
| Backend : messages traduits au catalogue | 0 | **724** |
| Notifications et e-mails applicatifs dans la langue du destinataire | non | **oui** |
| Tests | — | **0 régression** (voir §6) |

Langues prises en charge : **français** (source, par défaut) et **anglais**. Le RTL n'est pas prévu (aucune langue RTL).

---

## 2. Stratégie retenue (commune aux trois parties)

1. **Le français reste la langue source et la langue par défaut** partout. Un client qui n'envoie rien obtient exactement les réponses d'avant, ce qui garantit la compatibilité.
2. **Web et mobile :**
   - même moteur (`src/i18n/index.ts`, désormais identique dans les deux applications) ;
   - mêmes espaces de noms ;
   - **mêmes clés pour un même texte** (`ui.<clé>`), tirées d'une mémoire de traduction unique. Un libellé traduit d'une façon sur le web l'est de la même façon sur le mobile.
3. **Clés typées.** `t('ui.xxx')` est vérifié à la compilation : une clé inexistante ne compile pas. La parité fr/en est imposée par le type `Dictionary` / `UiDictionary`.
4. **Textes des constantes de module** (menus, catalogues, FAQ) : ils deviennent des accesseurs (`get label() { return tr('…'); }`). Ils sont évalués à l'affichage, jamais à l'import, et suivent donc un changement de langue.
5. **Backend.** Les messages restent écrits en français dans le code et sont traduits **en sortie** :
   - erreurs, validation et succès : selon `Accept-Language` ;
   - notifications et e-mails : selon `Profile.locale` du destinataire.

   Aucun champ machine n'est modifié : `code`, `errors[].code` et `errors[].field` restent identiques. Seul `errors[].message` est **ajouté**.
6. **Synchronisation client → serveur.** Le choix de langue est reporté sur le profil (`PATCH /me { locale }`). Les notifications partent ainsi dans la langue choisie à l'écran.

---

## 3. Problèmes corrigés

### 3.1 Web (réf. `AUDIT_FRONTEND/AUDIT_I18N.md`)

| Réf. audit | Problème | Correction | Fichiers principaux |
|---|---|---|---|
| I18N-01 / FE-E02 | 9 appels `t()` pour ≈ 2 000 textes en dur | 3 302 textes migrés vers des clés `ui.*` (outil AST) + corrections manuelles | 203 fichiers (annexe B) |
| I18N-02 | Langue non relue au rechargement (`hydrate()` jamais appelé) | `hydrate()` attendue avant le premier rendu ; langue du navigateur à la 1re visite | `main.tsx`, `i18n/index.ts` |
| I18N-03 | `<html lang>` figé à `fr` | Attribut `lang` synchronisé à chaque changement de langue | `i18n/index.ts` |
| I18N-04 | Ternaires `locale === 'fr' ? … : …` dans le pied de page | Ternaires supprimés, tout passe par le dictionnaire | `components/layout/Footer.tsx` |
| I18N-05 | Langue modifiable seulement dans le pied de page public et les paramètres producteur | Nouveau `LanguageSwitcher` dans la barre de **tous** les espaces connectés | `components/ui/LanguageSwitcher.tsx`, `components/layout/AppLayout.tsx` |
| I18N-06 | Erreurs affichées brutes (« Network Error », message serveur français) | `ErrorState` : libellé traduit par famille d'erreur ; message serveur désormais localisé ; erreur réseau traduite | `components/ui/States.tsx`, `services/http.ts` |
| I18N-07 | 16 `'fr-FR'` en dur ; décimales des devises forcées à 0 | `bcpLocale()` (langue courante) partout ; décimales laissées à `Intl` (0 pour XOF, 2 pour USD/EUR) | `lib/format.ts` + 14 écrans |
| I18N-08 | Tutoiement isolé, accents et apostrophes manquants | Valeurs françaises corrigées (voir §4.2) | `i18n/ui.fr.ts` |
| — | Inscription envoyée sans langue | La langue active est envoyée à l'inscription | `pages/auth/Register.tsx` |
| — | Pluriels fabriqués en collant un « s » (« alerte{s} ») | Clés singulier / pluriel distinctes | `pages/app/Notifications.tsx`, `pages/farmer/Alerts.tsx` |

### 3.2 Mobile (réf. `AUDIT_MOBILE/AUDIT_I18N_MOBILE.md`, anomalie MOB-E08)

| Réf. audit | Problème | Correction | Fichiers principaux |
|---|---|---|---|
| MOB-E08 | 109 appels `t()`, ≈ 2 800 textes en dur | 3 317 textes migrés vers les clés partagées `ui.*` | 242 fichiers (annexe B) |
| I18N-01 | Langue d'inscription figée à `'fr'` | Langue active envoyée | `app/auth/register.tsx` |
| §1 « Langue du système non lue » | Défaut `fr` imposé | Langue de l'appareil (`Intl`, Hermes) à la 1re ouverture, sans nouvelle dépendance native | `i18n/index.ts` |
| §5 | Bascule visible fr → en au démarrage | Écran de démarrage tenu jusqu'à la relecture de la langue | `app/_layout.tsx` |
| I18N-02 | — | FAQ : rubriques affichées traduites (les identifiants de filtre restent inchangés) | `app/faq.tsx` |
| §6 | `toLocaleString('fr-FR')`, `Intl.NumberFormat('fr-FR')` en dur | `bcpLocale()` | `farmer/season-feedback.tsx`, `notifications/sms-consent.tsx` |
| §6 | Décimales des devises forcées à 0 | Décimales laissées à `Intl` | `lib/format.ts` |
| — | Message réseau « Réseau indisponible » en dur | `errors.network` traduit | `services/api/http.ts` |
| — | Notifications et e-mails ignoraient la langue choisie | Synchronisation `Profile.locale` (`useLocaleSync`) | `hooks/useLocaleSync.ts`, `app/_layout.tsx` |
| — | Écrans « Services » oubliés lors du premier passage | Migrés (15 textes) | `app/services/index.tsx`, `app/services/[serviceId].tsx` |

Comportement Android / iOS : le moteur est identique sur les deux plateformes (code JS commun, aucun module natif ajouté). Les exports Hermes Android et iOS contiennent les traductions (§6).

### 3.3 Backend

| Problème constaté | Correction | Fichiers |
|---|---|---|
| Aucune gestion de la langue (`Accept-Language` ignoré) | `localeMiddleware` : choix fr/en (RFC 9110, poids `q`), repli fr, en-tête `Content-Language`, contexte asynchrone | `src/shared/i18n/index.js`, `src/app.js` |
| Messages d'erreur uniquement en français (≈ 520) | Traduits en sortie par l'errorHandler ; gabarits reconnus par motif | `src/shared/http/errorHandler.js`, `messages.en.js` |
| Messages de validation Zod par défaut **en anglais** pour tout le monde | Régénérés dans la langue de la requête (fr ou en). Les messages personnalisés passent par le catalogue | `src/middleware/validate.js`, `src/shared/i18n/index.js` |
| Erreurs par champ sans texte lisible séparé (`code` = message) | `errors[].message` **ajouté** et localisé ; `code` inchangé | idem |
| Messages de succès (≈ 210) en français | Traduits selon la requête | `src/shared/http/response.js` |
| Notifications rédigées en français quelle que soit la langue du destinataire | Titre et corps traduits selon `Profile.locale` du destinataire | `src/shared/events.js` |
| E-mails applicatifs en français | « Contact d'une exploitation » et « décision de vérification » rédigés dans la langue du destinataire | `src/modules/public/public.service.js`, `src/integrations/email.js`, `src/modules/verification/verification.service.js` |
| Libellés servis par l'API (sévérité, statut, source d'alerte, grandeurs, sources des plages) en français | Traduits selon la requête | `src/modules/alerts/alertLabels.js`, `src/modules/recommendation/agronomicRanges.routes.js` |

Compatibilité :
- sans `Accept-Language` (ou avec `fr`), chaque réponse est **identique** à l'existant ;
- les clients web et mobile envoyaient déjà cet en-tête ;
- ils lisent déjà `errors[].message` en priorité, avec repli sur `code`.

### 3.4 Vérification du site web dans un navigateur (Chrome sans interface)

**Méthode :**
- version de production (`vite build` + `vite preview`) ;
- les **174 routes** de `App.tsx` dans 3 modes : anglais anonyme, anglais connecté, français connecté, soit **522 visites** ;
- API simulée dans le navigateur de test : administrateur fictif ayant tous les rôles, réponses vides tolérantes, pour que chaque écran affiche ses libellés sans données ;
- à chaque visite, relevé de :
  - l'attribut `lang` ;
  - les clés brutes affichées (`ui.xxx`) ;
  - les lignes françaises en mode anglais ;
  - les erreurs JavaScript.
- Un second test clique sur le sélecteur FR → EN → FR → EN dans 11 espaces (public, admin, app, producteur, marché, investissement, organisation, transport, agent, développeurs, à propos), puis recharge la page.

**Ce que la vérification a révélé et qui a été corrigé :**

| Constat | Cause | Correction |
|---|---|---|
| Menu latéral de l'espace admin resté en français après la bascule | Le filtrage par permissions copiait les groupes (`{...groupe}`), ce qui fige les libellés, dans un `useMemo` sans dépendance à la langue | Dépendance à `t` (qui change avec la langue) dans `AppLayout.tsx` (menu, carte d'état, titre de page) |
| Carte « Vérification disponible » et titre de page figés après la bascule | `useMemo` sans dépendance à la langue | idem |
| 4 autres listes calculées figées (À propos, développeurs, organisation, missions mobile) | idem | Dépendance à `t` ajoutée. Le contrôle AST des `useMemo`/`useCallback` ne signale plus aucun cas |
| ≈ 100 textes encore en dur, non vus par l'outil de migration | Propriétés non reconnues (`badgeSubtext`, `unit`, `leftCode`, `rightCode`, `value`, `sourceNote`, `notice`…), textes longs contenant « : » ou « ; », concaténations, replis `??` | 5 passes de corrections ciblées (web et mobile). Exemples : codes de tableaux « RÉCOLTE / VENDEUR / MEMBRES », sous-titres KPI « actives / ouverts / terrain », puces « n utilisables / remis : n », titres de menu « GOUVERNANCE / OUTILS », introductions des pages admin |

**Résultat final (dernière version construite) :**

| Mesure | Résultat |
|---|---|
| Clés brutes affichées | **0** / 522 visites |
| Attribut `lang` différent de la langue choisie | **0** |
| Textes français en mode anglais | **0** texte d'interface. Restent 2 contenus volontaires : « Français (French) », nom de la langue dans le sélecteur, et l'exemple de fichier CSV `producteur@example.com,profile\|plots` |
| Bascule en direct | ✅ 11/11 espaces : aucun rechargement, `lang` mis à jour, retour au français identique, langue conservée après rechargement, profil serveur mis à jour (`PATCH /me {locale}`) dans les espaces connectés |
| Erreurs JavaScript | 8 visites sur 4 pages. **Toutes reproduites à l'identique sur la version d'origine (avant i18n)** avec la même simulation : elles viennent des réponses simulées (date fictive, objet vide), pas de la traduction |

Au départ, la simulation renvoyait des listes vides partout et 41 pages plantaient. La même série de pages plantait de façon identique sur la version d'origine. La simulation a donc été rendue tolérante pour que ces pages puissent, elles aussi, être contrôlées.

---

## 4. Traductions ajoutées, corrigées, supprimées

### 4.1 Ajoutées

| Ensemble | Nombre | Détail |
|---|---:|---|
| Espace `ui` web | 2 572 clés | Annexe A (colonne App contient W) |
| Espace `ui` mobile | 2 510 clés | Annexe A (colonne App contient M) |
| dont communes web ↔ mobile | 967 clés `ui` (1 140 avec les clés d'origine) | identiques des deux côtés (contrôlé) |
| dont ajoutées après la vérification navigateur (§3.4) | 138 (web), 72 (mobile) | codes de tableaux de suivi (`trackCode*`), sous-titres de cartes KPI (`kpiSub*`, `kpiValue*`), compteurs (`count*`), titres de groupes du menu (`navGroup*`), noms de versions (`release*`), textes longs restés en dur |
| Clés pluriel singulier/autre | 6 (web), 2 (mobile) | `unreadCountOne/Other`, `openAlertsInOrgOne/Other`, `alertsPageOne/Other` |
| Rubriques FAQ (mobile) | 5 | `faqTopicAll`, `faqTopicDonnees`… |
| Catalogue backend fr → en | 724 entrées | erreurs, validation, succès, notifications, libellés, e-mails |
| Messages Zod par défaut localisés (backend) | 19 règles × 2 langues | `ZOD_DEFAULTS` |

Justification : chaque texte ajouté existait déjà, écrit en dur dans le code. Le contenu français est **inchangé**, sauf les corrections listées en §4.2. Les 173 clés d'origine (`common`, `nav`, `home`, `auth`, `farmer`, `provenance`, `roles`, `errors`) sont conservées sans modification. Seules les clés `common.*` ont été réutilisées lors de la migration, pour éviter des faux sens : « Nom » d'une parcelle ≠ `auth.lastName`.

### 4.2 Corrigées

| Clé / message | Avant | Après | Motif |
|---|---|---|---|
| `ui.securite` | Securite | Sécurité | accent manquant |
| `ui.tachesPlanifiees` | Taches planifiees | Tâches planifiées | accents |
| `ui.parametres` | Parametres | Paramètres | accent |
| `ui.matriceDesRoles` | Matrice des roles | Matrice des rôles | accent |
| `ui.vueGenerale` | Vue generale | Vue générale | accent |
| `ui.systeme` | Systeme | Système | accent |
| `ui.journalDAudit` | Journal d audit | Journal d’audit | apostrophe |
| `ui.espaceDAdministration` | Espace d administration | Espace d’administration | apostrophe |
| `ui.diffuserLAnnonce`, `ui.corpsDeLAnnonce` | l annonce | l’annonce | apostrophe |
| `ui.aucuneAnnonceDiffuseePourLInstant_9973f` | l instant | l’instant | apostrophe |
| `ui.lesRaccourcisSuiventLesPermissionsDeja` | deja… l autorisation | déjà… l’autorisation | accent, apostrophe |
| `ui.connecteToiPourConsulterLaFiche` | Connecte-toi… | Connectez-vous… | vouvoiement (norme de l'interface) |
| `ui.dossierStructure` | Dossier structure | Dossier structuré | accent |
| `ui.aChoisir` | A choisir | À choisir | majuscule accentuée |
| `ui.dansLApplication` | dans l application | dans l’application | apostrophe |
| « Pilote » (source d'une plage agronomique) | Driver (anglais, contresens) | Pilot | contexte « projet pilote », pas « pilote de stockage » |
| Textes JSX contenant `’` en clair | affichaient littéralement « ’ » | apostrophe typographique | bogue d'affichage préexistant |
| Textes JSX contenant `&eacute;`, `&rarr;`… dans des chaînes JS | entités affichées telles quelles | caractères décodés | bogue d'affichage préexistant |

### 4.3 Supprimées

| Clé (web) | Motif |
|---|---|
| `ui.apiUnavailable`, `ui.checking`, `ui.emailAddress`, `ui.language`, `ui.legalLinks`, `ui.priceReportsAreAvailableToVerified` | Textes **anglais** qui servaient de branche « en » des ternaires du pied de page. Ils font doublon avec les clés françaises correspondantes, devenues bilingues. Plus aucune référence |
| `ui.nonLue`, `ui.alerteNonTraiteeDansVotreOrganisation`, `ui.pageSurAlerte` (+ la 2ᵉ côté mobile) | Remplacées par des clés singulier/pluriel : le gabarit « {n} alerte{s} » produisait « unreads » en anglais |

Aucune traduction d'origine n'a été supprimée.

---

## 5. Fichiers modifiés (résumé)

| Partie | Modifiés | Ajoutés |
|---|---:|---:|
| Web (`apps/web/src`) | 207 | 5 : `i18n/ui.fr.ts`, `ui.en.ts`, `ui.types.ts`, `hooks/useLocaleSync.ts`, `components/ui/LanguageSwitcher.tsx` |
| Mobile (`apps/Mobile/src`) | 246 | 4 : `i18n/ui.fr.ts`, `ui.en.ts`, `ui.types.ts`, `hooks/useLocaleSync.ts` |
| Backend | 10 + `package.json` | `src/shared/i18n/index.js`, `messages.en.js`, `tests/i18n.test.mjs`, `docs/I18N.md` |
| Outillage | — | `scripts/i18n/check-i18n.mjs` |

La liste complète est en annexe B, avec le nombre de remplacements par fichier.

Les fins de ligne d'origine sont conservées : 7 fichiers en CRLF ont été renormalisés après insertion.

---

## 6. Résultats des tests

Toutes les vérifications ont été exécutées après la dernière modification.

| Partie | Contrôle | Résultat |
|---|---|---|
| Web | `tsc --noEmit` | ✅ 0 erreur |
| Web | `vite build` | ✅ réussi |
| Web | Vitest | ⚠️ 8 échecs, **identiques à l'état d'avant** (causes préexistantes : `window.matchMedia` non simulé, composant hors `Router`), aucun lié à l'i18n |
| **Web** | **Navigateur (Chrome) : 174 routes × 3 modes = 522 visites** | ✅ 0 clé brute, 0 `lang` erroné, 0 texte d'interface français en mode anglais ; 8 erreurs JS dues à la simulation d'API, reproduites à l'identique sur la version d'origine (§3.4) |
| **Web** | **Bascule de langue en direct, 11 espaces** | ✅ 11/11 : sans rechargement, aller-retour identique, langue conservée au rechargement, profil serveur synchronisé |
| Web / mobile | Scan AST des `useMemo`/`useCallback` qui traduisent sans dépendre de la langue | ✅ 0 cas restant (6 corrigés) |
| Mobile | `tsc --noEmit` | ✅ 0 erreur |
| Mobile | `scripts/redirects.test.mjs` | ✅ 29/29 |
| **Android** | `expo export --platform android` (copie isolée, sources finales) | ✅ réussi, bundle Hermes 6,2 Mo, traductions anglaises présentes (y compris les dernières ajoutées) |
| **iOS** | `expo export --platform ios` (copie isolée, sources finales) | ✅ réussi, bundle Hermes 6,3 Mo, traductions anglaises présentes (y compris les dernières ajoutées) |
| Backend | `npm run test:dbless` (suite complète sans base) | ✅ **1 371 / 1 371**, 0 échec |
| Backend | `tests/i18n.test.mjs` (nouveau) | ✅ 7/7 : `Accept-Language`, catalogue, gabarits, errorHandler fr inchangé / en traduit, validation, succès |
| Backend | Comparaison avec l'état d'origine (copie isolée) | ✅ aucun test réussi avant n'échoue après |
| Transverse | `node scripts/i18n/check-i18n.mjs` | ✅ 0 erreur |
| Transverse | Contrôle des règles des hooks (fonction ayant reçu `useI18n()` appelée hors JSX) | ✅ 0 cas sur 431 composants |

Le contrôle transverse vérifie la parité fr/en, les paramètres, la cohérence web ↔ mobile, les clés manquantes et le catalogue backend. Il émet 2 avertissements : 8 textes signalés par l'heuristique, tous examinés à la main. Ce sont des faux positifs : des génériques TypeScript (`Promise<…>`, `Record<…>`) et le sigle « API ».

Le backend n'a pas été modifié pendant la vérification navigateur (§3.4). Les résultats backend ci-dessus restent donc valables.

**Non-régression backend.**
- La référence a été exécutée sur une copie isolée du code d'origine. Ce passage a été interrompu par un délai (362 réussis, 192 échecs).
- Ces échecs viennent de tests de bout en bout qui dépendent de l'environnement et du temps d'exécution : la référence tournait sur une machine chargée.
- La suite complète sur le code modifié est allée à son terme sans aucun échec, ces mêmes tests compris.
- Aucun test réussi dans la référence n'échoue sur le code modifié.

---

## 7. Problèmes restants ou non résolus

| # | Sujet | Statut | Raison / action proposée |
|---|---|---|---|
| R1 | **Portugais (pt)**, cité par le CDC (I18N-01 : « fr/en/pt ») | Non livré | Ajouter une langue est désormais mécanique (guide `backend/docs/I18N.md` §2). Les ≈ 4 600 textes sont à traduire. **Décision produit attendue** |
| R2 | Relecture des traductions anglaises | À faire | 3 942 clés d'interface et 724 messages backend ont été traduits par moi, en contexte, avec contrôle automatique des paramètres. Une relecture par un anglophone du métier est recommandée (les mots isolés peuvent prêter à confusion, cf. « Pilote ») |
| R3 | Rendu en anglais | **Web : contenu vérifié** (§3.4) · **Mobile : non vérifié à l'écran** | Web : la traduction de chaque écran est contrôlée, mais pas la mise en page : les débordements de textes anglais plus longs ne sont pas mesurés par le test automatique. Mobile : aucun émulateur ni appareil disponible ; seuls l'analyse statique et les exports Android/iOS sont faits. À vérifier sur appareil |
| R3b | Écrans avec données réelles | Non vérifié | La vérification navigateur utilise une API simulée (réponses vides). Les textes **issus des données** (noms, statuts, messages backend) n'y apparaissent pas. Ceux qui viennent du backend sont traduits par le catalogue (§3.3), sauf R6 et R7. Exemple : `scoreNote` du retour de saison est désormais pris côté client (`ui.scoreNote`), mais d'autres champs textuels calculés restent en français |
| R13 | Littéraux conservés volontairement | Accepté | Exemples d'en-tête CSV (format d'import, colonnes en français attendues par le backend) ; placeholder `manioc` (identifiant de culture) ; unité `tonnes` (donnée envoyée, valable en anglais) ; nom de clé API par défaut `clé` (donnée envoyée, non affichée) ; mots identiques dans les deux langues (services, lots, analyses, active, public, support) |
| R14 | Correction de l'affirmation précédente « 0 texte en dur » | Corrigé | La première version de ce rapport l'affirmait sur la foi du détecteur de migration. La vérification navigateur a montré ≈ 100 textes restants (§3.4), tous corrigés depuis. Le chiffre actuel repose sur le contrôle à l'écran (web) et sur un scan AST des propriétés textuelles (web et mobile) |
| R4 | **SMS d'alerte** | En français | Contraintes GSM-7 et de longueur (tests dédiés). Il faut des gabarits anglais testés en longueur (backend) |
| R5 | E-mails d'authentification (Supabase Auth) | Hors code | Gabarits à configurer dans la console Supabase, par langue |
| R6 | Valeurs d'énumération renvoyées brutes et affichées telles quelles (`PENDING`, `CONFIRMED`…) dans certains écrans | Partiel | Ce sont des données, pas des textes en dur : une table `status.*` partagée est à créer (fonctionnalité d'affichage, à valider) |
| R7 | Libellés calculés et stockés par le moteur de recommandation | En français | Ils sont persistés au moment du calcul. Les traduire demanderait de modifier le modèle de données (hors périmètre i18n strict) |
| R8 | Ton du backend (« Tu n'as pas les droits… ») | Inchangé | Le texte source français a été conservé pour ne modifier aucun contrat. L'anglais est neutre. Passage au vouvoiement possible sur décision |
| R9 | Locales de formatage génériques (`fr-FR`, `en-GB`) et devise par défaut `XOF` | Inchangé | Choisir `fr-CD` ou `fr-CI` et une devise par défaut relève d'une décision produit. L'API fournit déjà la devise réelle |
| R10 | Vitest web : 8 échecs préexistants | Inchangé | Configuration de test (simulations) sans rapport avec l'i18n. Correction simple, à valider séparément |
| R11 | Clés générées longues (`ui.laLocalisationSaisieEstApproximativeElle`) et quelques suffixes de hachage | Accepté | Lisibles et stables. Un renommage par domaine reste possible ; le contrôle détecterait tout écart |
| R12 | RTL | Non prévu | Aucune langue RTL au programme |

---

## 8. Maintenance

- **Ajouter un texte (web ou mobile) :**
  1. créer la clé dans `src/i18n/ui.fr.ts` **et** `ui.en.ts` (la compilation échoue sinon) ;
  2. utiliser `t('ui.cle')` dans un composant, ou `tr('ui.cle')` hors composant ;
  3. si le texte existe déjà dans l'autre application, réutiliser **la même clé**.
- **Ajouter un message backend :** l'écrire en français dans le code, puis ajouter sa traduction dans `messages.en.js` (guide `backend/docs/I18N.md`).
- **Avant livraison :** `node scripts/i18n/check-i18n.mjs` (code de sortie 1 en cas d'écart), puis `npm test` (backend, inclut `tests/i18n.test.mjs`).
