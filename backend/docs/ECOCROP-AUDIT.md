# Audit « EcoCrop » — étape A, puis exécution de l'étape C

**Date de l'audit :** 23 octobre 2026
**Date d'exécution de l'étape C :** 23 octobre 2026
**Périmètre scanné :** `backend/` (code, tests, scripts, migrations, config, `.env.example`,
`docs/`), `apps/web/src/`, `apps/Mobile/src/`. Exclusions : `node_modules/`, `dist/`.

Ce document est un **registre** : il conserve ce qui avait été trouvé, et dit pour chaque
entrée ce qui a été fait. Les numéros de ligne de l'étape A sont donnés à titre historique —
ils ne pointent plus vers rien, puisque le mot a disparu du code. Ils sont donc **recalés** sur
la ligne où vit aujourd'hui le texte de remplacement, vérifiée au moment de la rédaction.

---

## 1. Synthèse

| | Étape A | Après étape C |
|---|---|---|
| Occurrences hors de ce document | **71 dans 15 fichiers** | **0** |
| Fichiers concernés | 15 | 0 |
| Script d'import | présent (602 lignes) | **supprimé** |
| Section de documentation dédiée | `GEOSPATIAL.md` §8.5 | **supprimée**, sections renumérotées |

Les seules occurrences restantes du mot se trouvent **dans ce fichier** (13, comptées après
réécriture), qui est précisément le registre de leur suppression.

| Catégorie | Occ. | Action | Faite |
|---|---|---|---|
| Script d'import et son en-tête | 20 | Supprimer le fichier entier | ✅ |
| Commentaires de code backend | 8 | Formulation neutre | ✅ |
| Commentaires de schéma Prisma | 2 | Reformuler (commentaires `///`, aucune donnée) | ✅ |
| Valeur runtime servie par l'API | 2 | Remplacer | ✅ à l'étape B |
| Placeholders frontend (web + mobile) | 5 | Remplacer | ✅ |
| Tests (unitaires + e2e) | 27 | Source neutre | ✅ |
| Documentation (`docs/GEOSPATIAL.md`) | 7 | Supprimer §8.5, reformuler le reste | ✅ |
| **Total** | **71** | | |

---

## 2. Enums et valeurs en base

| Vérification | Résultat |
|---|---|
| Enum contenant « EcoCrop » | **Aucun.** `RangeStatus` = `PROVISIONAL \| VALIDATED \| RETIRED` |
| Enum `RangeSourceType` (ajouté à l'étape B) | `AGRONOMIST \| PUBLICATION \| PILOT` — aucune valeur prohibée |
| Migrations appliquées | **0 occurrence** ; aucune n'a été modifiée |
| `prisma/seed.js` | **0 occurrence** — aucune donnée livrée n'en contient |
| `src/config/` · `.env.example` · `.env` | **0 occurrence** |
| `package.json` | **Aucune référence** au script supprimé : aucune étape de `verify` n'en dépendait |

**Conclusion : aucune valeur EcoCrop n'est livrée en base, et aucune migration de correction
n'a été écrite** — conformément à la décision prise : aucun déploiement réel n'a exécuté
l'import, il n'y a donc rien à corriger.

### 2.1 Requête de vérification pour une instance réelle

Cette requête existe pour le cas où une instance **autre que ce dépôt** aurait exécuté le
script avant sa suppression. Elle est fournie à titre de contrôle ; elle n'a pas été exécutée
ici, faute d'accès à une base de production.

```sql
-- 1. Compter les lignes portant une provenance EcoCrop.
SELECT count(*) AS lignes_concernees
FROM crop_agronomic_ranges
WHERE source_reference ILIKE '%ecocrop%'
   OR source_note      ILIKE '%ecocrop%';

-- 2. Les voir avant toute modification, avec leur statut : une ligne VALIDATED
--    a été validée par un agronome, la nettoyer change un acte engagé.
SELECT id, crop_slug, parameter_key, status, validated_by,
       source_reference, source_note, dataset_label, created_at
FROM crop_agronomic_ranges
WHERE source_reference ILIKE '%ecocrop%'
   OR source_note      ILIKE '%ecocrop%'
ORDER BY created_at;

-- 3. Détecter aussi une variante orthographique, au cas où la valeur aurait été
--    saisie à la main plutôt qu'importée.
SELECT id, source_reference
FROM crop_agronomic_ranges
WHERE lower(source_reference) ~ 'eco[ _-]?crop|écocrop';
```

**Si la requête 1 renvoie autre chose que zéro**, le nettoyage passe par une **nouvelle**
migration (`UPDATE crop_agronomic_ranges SET source_reference = …`), jamais par la
modification d'une migration appliquée. La formulation de remplacement doit rester
vérifiable : remplacer une provenance citable par un texte vague ferait perdre la trace de
l'origine, ce qui est exactement ce que le suivi de source doit éviter.

---

## 3. Inventaire détaillé et recalage

### 3.1 Script d'import — supprimé (20 occ.)

`backend/scripts/import-ecocrop.mjs` — 602 lignes. **Fichier supprimé.**

Aucune dépendance ne casse : `package.json` ne le référençait pas et `verify` ne l'appelait
pas. Les deux connaissances qu'il encodait ont été **reformulées, pas effacées** :

1. une fourchette de température issue d'un référentiel générique porte sur **l'air**, pas sur
   le sol ;
2. un tel référentiel ne fournit **pas** d'humidité volumique du sol — il donne des
   précipitations en mm, qui ne sont pas un pourcentage d'humidité.

Elles vivent désormais ici (lignes vérifiées) :

| Règle | Emplacement actuel |
|---|---|
| air ≠ sol | `src/modules/recommendation/agronomicRanges.js:33-37` |
| air ≠ sol (moteur) | `src/modules/recommendation/recommendation.service.js:74` (`AIR_VS_SOIL_CAVEAT`) |
| pas d'humidité volumique déduite | `docs/GEOSPATIAL.md:235-240` (déplacée depuis l'ancien §8.5) |
| les deux | `docs/AGRONOMIC-RANGES.md` §6 |

### 3.2 Références au script

| Fichier | Ligne (étape A) | Ligne actuelle | État |
|---|---|---|---|
| `scripts/import-ecocrop.mjs` | 4 | — | fichier supprimé |
| `agronomicRanges.js` | 6 | **5-6** (« l'import CSV du tableau « Plages agronomiques » ») | reformulé |
| `docs/GEOSPATIAL.md` | 244 | **181-185** (renvoi vers `AGRONOMIC-RANGES.md`) | section supprimée |

### 3.3 Code backend — commentaires (8 occ.)

| Fichier | Ligne (étape A) | Ligne actuelle | État |
|---|---|---|---|
| `agronomicRanges.js` | 5 | **5-6** | provenance neutre |
| `agronomicRanges.js` | 6 | **5-6** | le script n'est plus cité |
| `agronomicRanges.js` | 33 | **33-37** | **règle conservée**, nom retiré |
| `agronomicRanges.js` | 36 | **33-37** | **règle conservée** |
| `agronomicRanges.routes.js` | 45 | **63** (« Source citable de la fourchette ») | exemple neutre |
| `agronomicRanges.routes.js` | 49 | **65-70** | **règle conservée** |
| `recommendation.service.js` | 74 | **74-75** | **règle conservée** |
| `forecast.service.js` | 34 | **34** (« les plages agronomiques ») | nom retiré |

### 3.4 Schéma Prisma — commentaires (2 occ.)

| Ligne (étape A) | Ligne actuelle | État |
|---|---|---|
| `schema.prisma:2760` | **2783-2784** (`sourceReference`) | reformulé |
| `schema.prisma:2763` | **2789-2791** (`sourceNote`, air ≠ sol) | **règle conservée** |

Commentaires `///` uniquement : ni colonne ni valeur, donc **aucune migration requise**.

### 3.5 *(section retirée)*

La section « Valeur runtime servie par l'API » de l'étape A concernait `IMPORT_EXAMPLE`, seule
occurrence qui quittait le dépôt via `GET /agronomic-ranges/import/template`. **Elle a été
traitée à l'étape B**, avant l'étape C : l'exemple est désormais clairement fictif (culture
« exemple », source « Exemple de format », nom scientifique `Exemplum fictivum`) et un test
unitaire vérifie qu'il contient le mot « fictif ». La section est supprimée de ce registre
parce qu'elle ne décrit plus un risque ouvert.

Emplacement actuel : `src/modules/recommendation/agronomicRangesCsv.js`, constantes
`IMPORT_HEADER` / `IMPORT_EXAMPLE`, servies par `buildTemplateCsv()`.

### 3.6 Frontend — placeholders (5 occ.)

| Fichier | Ligne (étape A) | Ligne actuelle | État |
|---|---|---|---|
| `apps/web/.../AgronomicRanges.tsx` | 319 | **373** | source neutre |
| idem | 333 | **411** | note air ≠ sol conservée |
| idem | 499 | **592** | modèle CSV **réaligné sur 15 colonnes** |
| `apps/Mobile/.../agronomic-ranges.tsx` | 242 | **279** | source neutre |
| idem | 393 | **441** | modèle CSV **réaligné sur 15 colonnes** |

Les deux placeholders CSV affichaient encore l'ancien format à 6 colonnes, antérieur à
l'étape B : ils ont été corrigés à cette occasion.

### 3.7 Tests (27 occ.)

**Unitaires — `tests/recommendation.test.mjs` (12)**

| Ligne (étape A) | Ligne actuelle | État |
|---|---|---|
| 181 · 190 | **181** · **190** | chaîne et assertion changées ensemble |
| 226 | **226** | test renommé, assertion intacte |
| 227 | **227-228** | reformulé |
| 493 | **493-494** | reformulé |
| 504 | **505** | « Source de test (fictive) » |
| 517 · 518 | **518** · **519** | **règle air ≠ sol conservée** |
| 767 | **768** | reformulé |
| 1122 | **1123** | source neutre |
| 1425 · 1428 | **1426** · **1429** | section et test renommés |

**e2e — `agronomicRanges.e2e.test.mjs`** : lignes d'étape A 116, 176, 216, 222, 223, 321 →
lignes actuelles **117, 177, 217, 223, 224, 322**. Les six autres occurrences d'étape A
appartenaient aux tests d'import écrits au format précédent ; ces tests ont été **réécrits à
l'étape B** sur 15 colonnes et n'en contenaient déjà plus.

**e2e — autres (3)** : `alerts:127`, `anomalies:192`, `forecastPipeline:168` →
**mêmes lignes**, valeur devenue « Source de test ».

> **Le nombre de tests n'a pas baissé.** Les deux tests renommés ont changé d'intitulé, pas de
> nombre. Le compte est **passé de 620 à 674** (`npm test`, qui inclut les e2e) et de 94 à 105
> (`test:e2e`) — la hausse vient des tests ajoutés aux étapes B et C, aucune suppression.

### 3.8 Documentation — `docs/GEOSPATIAL.md` (7 occ.)

| Ligne (étape A) | Ligne actuelle | État |
|---|---|---|
| 210 | **218** | **règle conservée**, nom retiré |
| 241 | — | **section §8.5 supprimée** (32 lignes) |
| 244 | — | commande supprimée avec la section |
| 253 · 259 | — | contenu propre au script, disparu avec lui |
| 263 | — | idem |
| 267 | **235-240** | **règle déplacée en §8.3, pas effacée** |

Les sections suivantes ont été **renumérotées** (§8.6→8.5, §8.7→8.6, §8.8→8.7). Vérifié :
aucune référence croisée vers ces numéros n'existe dans le dépôt — les `§8.5`/`§8.6`/`§8.7`
trouvés ailleurs désignent le **CDC V2**, un autre document.

Deux règles qui n'étaient portées **que** par l'ancien §8.5 ont été réinsérées ailleurs pour ne
pas disparaître avec lui : l'absence d'humidité volumique déduite (§8.3) et l'arrivée systématique
en `PROVISIONAL` d'une ligne importée (tableau du §8.2).

Aucun autre fichier de `docs/` n'était concerné.

---

## 4. Contrôle final sur les variantes

Recherche insensible à la casse, sur `backend/`, `apps/web/`, `apps/Mobile/` (extensions
`.js .mjs .ts .tsx .md .json .py .sql .prisma .example .yaml .yml`), `node_modules` et `dist`
exclus :

| Variante | Hors de ce document |
|---|---|
| `ecocrop` | **0** |
| `eco crop` | **0** |
| `eco-crop` | **0** |
| `eco_crop` | **0** |
| `écocrop` | **0** |
| `Recocrop` | **0** |
| `FAO` | **0** |

`FAO` ne subsistait que dans les chaînes « FAO EcoCrop » ; aucune référence distincte à la FAO
n'existe dans le dépôt, donc rien n'a été retiré qui aurait eu un sens propre.

Les correspondances trouvées dans `.npm/_cacache/` sont des **blobs de cache npm** dont le
contenu binaire contient la séquence par coïncidence : ce ne sont pas des fichiers du projet.

---

## 5. Ce qui a été préservé, et ce qui n'a pas été touché

**Préservé** — conformément à la décision de reformuler plutôt que d'effacer :

- la mise en garde air ≠ sol, à quatre endroits (voir §3.1) ;
- l'interdiction de déduire une humidité volumique d'un référentiel générique ;
- l'arrivée en `PROVISIONAL` de toute ligne importée ;
- les deux noms de tests qui portaient le mot, renommés sans perdre leur assertion.

**Non touché** :

- **aucune route supprimée** — les 9 opérations `agronomic-ranges` sont intactes ;
- **aucune table ni colonne supprimée** — le modèle `CropAgronomicRange` n'a fait que
  s'étendre (étape B) ;
- **aucune plage de valeurs retirée** — `RANGE_KEYS`, `RANGE_UNITS`, `PHYSICAL_BOUNDS`
  inchangés ;
- **aucune migration appliquée modifiée.**

---

## 6. Ce que ce registre ne couvre pas

- **Les données d'un déploiement réel.** Seul le dépôt et la base jetable du harnais étaient
  accessibles. La requête du §2.1 existe pour lever ce doute sur une instance réelle ; elle n'a
  pas été exécutée.
- **L'historique Git.** Ce dépôt n'est pas un référentiel Git ici : impossible d'affirmer que le
  mot n'apparaît pas dans des commits anciens.
- **Le contenu réel d'un export.** Le format décrit par le script supprimé n'a jamais été
  confronté à un fichier source réel, ni à l'étape A ni depuis.
