# Audit de l'internationalisation (i18n) — Application mobile AGRIKONNECT AFRICA

**Référence :** [RAPPORT_AUDIT_REACT_NATIVE.md](RAPPORT_AUDIT_REACT_NATIVE.md), anomalie principale **MOB-E08 (ÉLEVÉ)**.

**Méthode :**
- lecture de `src/i18n/*` ;
- comparaison automatisée des dictionnaires ;
- recensement des appels `t('…')` ;
- détection heuristique des textes en dur. Elle couvre le texte JSX et les propriétés textuelles `label`, `title`, `subtitle`, `description`, `placeholder`, `message`, `hint`, `eyebrow`, `ctaLabel`, `accessibilityLabel`, `helper`, `statusLabel`, `seriesLabel`, `body`, `detail`, `titre`, `sousTitre`, `text`.

Aucune traduction n'a été modifiée.

---

## 1. Système i18n

| Élément | Implémentation | Fichier | Statut |
|---|---|---|---|
| Moteur | Maison : Zustand (`locale`, `hydrated`) + `translate()` + hook `useI18n()` | `i18n/index.ts:39-82` | CONFORME |
| Typage des clés | `TranslationKey = Paths<Dictionary>` : une clé inexistante ne compile pas | `i18n/index.ts:15-22` | CONFORME |
| Parité des dictionnaires | `en: Dictionary` impose la même structure que `fr` | `en.ts:4`, `fr.ts` (`Widen<typeof fr>`) | CONFORME : **173/173 clés**, 0 manquante dans chaque sens |
| Repli | Clé absente en `en` → français → clé brute | `index.ts:39-47` | CONFORME |
| Interpolation | `{param}` | `index.ts:44-46` | CONFORME (pas de pluriel) |
| Pluriels | Aucun mécanisme (`Intl.PluralRules` absent) | — | NON IMPLÉMENTÉ |
| Persistance | `setLocale` écrit `ak.locale` dans SecureStore, `hydrate()` relit au démarrage (`_layout.tsx:37,42`) | `index.ts:60-70` | CONFORME |
| Langue du système | Non lue (pas d'`expo-localization`). Défaut `fr` | `index.ts:57` | NON IMPLÉMENTÉ |
| Propagation au serveur | En-tête `Accept-Language` (`http.ts:67-68`), paramètre `locale` sur `/public/*` (`usePublicData.ts:36-52`) | — | CONFORME |
| Sélecteurs de langue | `Navbar.tsx:68`, `public-site/country-language.tsx:29-32`, `farmer/settings.tsx:39-42` | — | CONFORME (3 points d'entrée) |

## 2. Langues disponibles et fichiers

| Langue | Fichier | Clés | Lignes | Particularités |
|---|---|---:|---:|---|
| Français (`fr`, `fr-FR`) | `src/i18n/fr.ts` | 173 | 210 | Source de vérité |
| Anglais (`en`, `en-GB`) | `src/i18n/en.ts` | 173 | 198 | 16 valeurs identiques au français : légitimes (`AGRIKONNECT AFRICA`, `Notifications`, `Services`, `Contact`, `FAQ`, `Menu`, `Messages`, `ha`, `t`, `min`, `Drone`, `Satellite`…) |

Langues locales (lingala, swahili, wolof…) : absentes. Le produit cible l'Afrique francophone, ce qui relève d'une décision produit.

### Répartition par espace de noms

| Espace | Clés | Référencées en littéral | Non référencées en littéral | Remarque |
|---|---:|---:|---:|---|
| common | 37 | 5 | 32 | Vocabulaire générique presque inutilisé |
| nav | 19 | 18 | 1 | Bien couvert (Navbar, footer, en-têtes) |
| home | 44 | 35 | 9 | Accueil public |
| auth | 24 | 19 | 5 | Login, register, MFA |
| farmer | 21 | 7 | 14 | Espace producteur (47 routes) quasi non traduit |
| provenance | 11 | 1 | 10 | Les 9 types sont **référencés dynamiquement** par `PROVENANCE[kind].labelKey` (`format.ts:116-129`, `ProvenanceTag.tsx:31`) |
| roles | 8 | 0 | 8 | Jamais utilisées. Elles ne correspondent d'ailleurs pas aux 16 rôles réels |
| errors | 9 | 0 | 9 | **Référencées dynamiquement** par `ERROR_KIND_I18N` (`States.tsx:79`) |
| **Total** | **173** | **85** | **88** | Une fois les références dynamiques déduites (errors + provenance), il reste **environ 69 clés réellement mortes** |

---

## 3. Usage réel et textes en dur

| Indicateur | Valeur |
|---|---:|
| Fichiers `.ts/.tsx` analysés (hors `i18n/`) | 286 |
| Fichiers contenant au moins un `t('…')` | **21** |
| Appels `t('…')` | **109** |
| Textes en dur détectés (hors `services/`) | **≈ 2 801** |
| — dans `app/` (écrans) | ≈ 2 426 |
| — dans `components/` | ≈ 289 |
| — dans `lib/` (catalogues éditoriaux, FAQ, messages) | ≈ 86 |
| Fichiers avec des textes en dur et **aucun** `t()` | 219 sur 239 |

La mesure est heuristique : elle surestime légèrement (noms techniques) et sous-estime les messages construits par concaténation. L'ordre de grandeur est fiable.

### Par espace (textes en dur / appels `t()`)

| Zone | Textes en dur | `t()` |
|---|---:|---:|
| `app/farmer` | 540 | 9 |
| `app/admin` | 462 | 0 |
| `app/public-site` | 360 | 0 |
| `components/public-site` | 231 | 59 |
| `app/organization` | 159 | 0 |
| `app/marketplace` | 86 | 0 |
| `app/requests` | 66 | 0 |
| `app/reviewer` | 64 | 0 |
| `app/developers` | 60 | 0 |
| `app/investment` | 58 | 0 |
| `app/agent` | 52 | 0 |
| `app/auth` | 51 | 29 |
| `app/annonces` | 43 | 0 |
| `lib/platform.ts` | 41 | 0 |
| `app/ai` | 41 | 0 |
| `lib/service-catalog.ts` | 40 | 0 |

### Fichiers les plus concernés

| Fichier | Textes en dur | `t()` |
|---|---:|---:|
| `components/public-site/home/WebHomeSections.tsx` | 93 | 0 |
| `app/admin/agronomic-ranges.tsx` | 41 | 0 |
| `lib/platform.ts` | 41 | 0 |
| `app/organization/overview.tsx` | 40 | 0 |
| `lib/service-catalog.ts` | 40 | 0 |
| `app/farmer/soil.tsx` | 38 | 1 |
| `app/developers/index.tsx` | 33 | 0 |
| `app/farmer/productions.tsx` | 33 | 1 |
| `components/farmer/SoilModule.tsx` | 32 | 0 |
| `components/public-site/home/HeroCarousel.tsx` | 32 | 0 |

Le détail des 239 fichiers est dans la sortie `scratchpad/mob/i18n-files.tsv`.

### Catégories de textes non traduits (faits vérifiés, exemples)

| Catégorie | Exemple | Fichier:ligne |
|---|---|---|
| Titres d'écran | `title="Nouvelle parcelle"` | `farmer/plots/create.tsx:28` |
| Libellés de formulaire | `label="Culture (ID)"`, `label="Quantité"` | `annonces/creer.tsx:53,55` |
| Boutons | `"Enregistrer"`, `"Envoyer"`, `"Créer"` | `farmer/settings.tsx:61`, `messages/[conversationId].tsx:60` |
| Accessibilité | `accessibilityLabel="Retour"`, `"Visiter le site public"` | `AppHeader.tsx:35,60` |
| Messages de validation | `'Le numéro enregistré n'est pas au format international (+243…).'` | `lib/phone.ts:46` |
| Erreurs réseau | `'Réseau indisponible'` | `services/api/http.ts:82` |
| Boundary | `"Impossible d'afficher cet écran"`, `"Réessayer"` | `AppErrorBoundary.tsx` |
| Onglets producteur | `LABELS = { index: 'Accueil', … }` | `FarmerTabBar.tsx:34-40` |
| Libellés d'état | `rightCode: isDone ? 'LIVRÉE' : 'EN COURS'` | `marketplace/index.tsx:71` |
| Données de catalogue | services, FAQ, calendrier V1 à V5, rôles d'inscription | `lib/platform.ts`, `lib/faq.ts`, `lib/service-catalog.ts` |
| Statuts API bruts | `statusLabel: order.status` (`PENDING`, `CONFIRMED`…) | `marketplace/index.tsx:68` |

Messages d'erreur serveur : `ErrorState` affiche `requestError.message` en priorité (`States.tsx:80`). Ces messages sont en français côté backend : l'anglais affiché dépend donc du serveur, qui reçoit `Accept-Language`.

---

## 4. Incohérences

| ID | Incohérence | Preuve |
|---|---|---|
| I18N-01 | La langue d'inscription est figée à `'fr'`, quelle que soit la langue choisie | `auth/register.tsx:65` |
| I18N-02 | Les clés `roles.*` (8) ne correspondent pas aux rôles réels. Les libellés d'inscription sont en dur dans `SELF_SERVICE_ROLES` | `fr.ts:180-189`, `platform.ts:136-146` |
| I18N-03 | Libellés d'onglets en dur et clés de route erronées (`farms` contre `farms/index`) | `FarmerTabBar.tsx:26-40` (voir MOB-E03) |
| I18N-04 | Statuts métier affichés bruts (anglais technique) ou traduits localement, écran par écran | `marketplace/index.tsx:68`, `admin/monitoring.tsx:122` (`NIVEAU_LABEL` local) |
| I18N-05 | Le même concept est nommé différemment selon l'écran : « Annonces », « Offres », « Ventes », « Marketplace », « Marché » | Navbar, `public-site/index.tsx:12-22`, AppHeader |
| I18N-06 | Mélange français et anglais dans les codes affichés (`'LIVRÉE'`, `'REVUE'`, `'AI-10'`, `order.paymentStatus.slice(0,7)`) | `marketplace/index.tsx:70-71`, `agent/index.tsx:67,79` |

---

## 5. Changement dynamique de langue

| Contrôle | Résultat | Statut |
|---|---|---|
| Re-rendu des composants qui utilisent `useI18n()` | Oui : `t` dépend de `locale` (`index.ts:77-80`) | CONFORME |
| Re-rendu des composants qui utilisent `translate()` hors hook | `ProvenanceTag` lit `locale` via le store | CONFORME |
| Rechargement des données dépendant de la langue | `usePublicFarms` et `usePublicMap` incluent `locale` dans la clé de cache | CONFORME |
| Autres requêtes | `Accept-Language` change, mais les clés de cache n'incluent pas la locale : les libellés serveur restent dans l'ancienne langue jusqu'à expiration (60 s à 10 min) | À AMÉLIORER |
| Effet visible | Seuls l'accueil public, la barre de navigation, le pied de page, la connexion et l'inscription changent. **Plus de 90 % des écrans restent en français** | NON CONFORME |
| Persistance | SecureStore (`ak.locale`), relue avant le premier rendu utile | CONFORME |

---

## 6. Formatage (dates, heures, nombres, devises)

| Élément | Implémentation | Statut |
|---|---|---|
| Module central | `lib/format.ts` : `formatNumber`, `formatCompact`, `formatCurrency`, `formatDate`, `formatRelative`, `formatPercent` avec `Intl` et `BCP = { fr: 'fr-FR', en: 'en-GB' }` | CONFORME (conception) |
| Locales régionales | `fr-FR` : les séparateurs et la monnaie suivent la France, pas les pays cibles (`fr-CD`, `fr-CI`, `fr-SN`) | À AMÉLIORER |
| Contournements | `toLocaleString('fr-FR')` (`season-feedback.tsx:249,295`), `new Intl.NumberFormat('fr-FR')` (`:43`), `toLocaleDateString('fr-FR')` (`sms-consent.tsx:43`), `toFixed(1/2)` avec point décimal (`admin/monitoring.tsx:35-36`, `admin/notifications.tsx:193`, `recommendations.tsx:475`, `farmer/reviews.tsx:36`, `DataSections.tsx:386`) | NON CONFORME |
| Unités | `Go`/`Mo` en dur (`admin/monitoring.tsx:35-36`), `kg/ha` | À AMÉLIORER |
| Devise par défaut | `XOF` (`format.ts:8`). Formulaires : `EUR` (`annonces/creer.tsx:23`, `marketplace/new.tsx:24`, `public-site/annonces/creer.tsx:22`, `requests/new.tsx:23`) ou `XOF` (`requests/index.tsx:55`). Les textes visent la RDC (CDF/USD) | NON CONFORME (MOB-F03) |
| Dates sans heure | `formatDate(..., 'medium')` utilisé pour les messages (`messages/[conversationId].tsx:52`) | À AMÉLIORER (MOB-M19) |
| Fuseau horaire | Aucun choix explicite : fuseau de l'appareil. Les pays cibles ont plusieurs fuseaux (RDC : UTC+1 et UTC+2) | À AMÉLIORER |
| Hermes | `notation: 'compact'` sans `try` (`format.ts:20`). `RelativeTimeFormat` avec `try` (`:69-76`) | **NON VÉRIFIABLE** sans appareil (MOB-F05) |

---

## 7. RTL

- Aucune langue RTL n'est prévue.
- Aucun usage d'`I18nManager`, de `writingDirection` ou de styles logiques (`marginStart`/`End`).
- `android:supportsRtl="true"` (introspection) est sans effet tant qu'aucune langue RTL n'est ajoutée.
- **Statut :** NON IMPLÉMENTÉ (non prévu). Si l'arabe est envisagé, il faudra des propriétés logiques et un test `I18nManager.forceRTL`.

## 8. Adaptation aux langues longues

| Risque | Preuve | Statut |
|---|---|---|
| Titres tronqués | `AppHeader.tsx:37-43` : titre et sous-titre en `numberOfLines={1}` sur une ligne déjà chargée (retour + CTA + 3 icônes) | À AMÉLIORER |
| Onglets producteur | `label: { fontSize: 10 }`, largeur `640/count` (`FarmerTabBar.tsx:53,148`) | NON CONFORME (MOB-E03) |
| Boutons | `Button` sans `numberOfLines` imposé : retour à la ligne possible (hypothèse de mise en page correcte, NON VÉRIFIÉE) | NON VÉRIFIABLE |
| Agrandissement du texte (accessibilité) | Aucun `maxFontSizeMultiplier` : à 200 %, en-têtes et onglets débordent (hypothèse) | NON VÉRIFIABLE |

---

## 9. Plan de mise en conformité i18n (repris en phase 2.7 du plan)

1. **Outillage :**
   - règle ESLint `react-native/no-raw-text` (ou `i18next/no-literal-string`) en avertissement, puis en erreur par espace terminé ;
   - script de parité et de clés inutilisées en CI.
2. **Structure :**
   - un espace de noms par domaine (`farmer`, `market`, `admin`, `org`, `invest`, `public`, `forms`, `status`) ;
   - dictionnaires découpés par fichier.
3. **Ordre d'extraction :**
   1. composants partagés (`ui/`, `AppHeader`, `FarmerTabBar`, `ErrorBoundary`, `phone.ts`, `http.ts`) ;
   2. auth ;
   3. public ;
   4. producteur ;
   5. marché ;
   6. organisation ;
   7. investissement ;
   8. vérificateur et agent ;
   9. admin.
4. **Statuts :** table `status.order.PENDING`… réutilisée partout, et suppression des codes bruts.
5. **Formats :**
   - interdire `toLocaleString`/`toFixed` dans les écrans ;
   - locale régionale issue du pays du profil ;
   - devise du pays (`/countries`).
6. **Pluriels :** `Intl.PluralRules`, ou passage à `i18next` + `react-i18next` si le volume le justifie.
7. **Langue de l'appareil :** `expo-localization` au premier lancement. Envoyer la locale active à l'inscription (I18N-01).
8. **Validation :** bascule en `en` et parcours complet de chaque espace : 0 texte français. Contrôle avec le texte agrandi à 200 %.
