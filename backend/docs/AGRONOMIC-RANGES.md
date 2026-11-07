# Plages agronomiques — fourchettes, import et statut

Ce document décrit le référentiel `CropAgronomicRange` : ce qu'il contient,
comment on l'alimente, et surtout **ce qui distingue une valeur de confiance
d'une valeur à ne pas croire**.

Il remplace la description de l'import figurant auparavant dans
`docs/GEOSPATIAL.md`.

---

## 1. Pourquoi ce référentiel existe

Le moteur de recommandation compare l'état mesuré d'une parcelle à des
fourchettes agronomiques par culture et par paramètre. Trois principes le
cadrent, et ils expliquent la plupart des règles ci-dessous :

- **Un satellite ne mesure pas le sous-sol.** Les fourchettes portent sur le sol
  et le sous-sol ; elles ne peuvent donc pas être déduites d'une image. Elles
  viennent d'une mesure, d'une publication ou d'un pilote.
- **Une valeur sans provenance fiable ne doit pas entrer.** Le paramètre reste
  alors **non évalué** plutôt que comblé par une estimation.
- **Une recommandation bâtie sur des fourchettes provisoires est « indicative ».**
  Elle le dit explicitement, elle ne se présente pas comme une conclusion.

## 2. Les quatre limites

Chaque plage peut porter **quatre** nombres, dans cet ordre :

| Champ | Rôle | Facultatif |
| --- | --- | --- |
| `toleratedMin` | Borne basse **tolérée** | oui |
| `minValue` | Début de la plage **idéale** | non |
| `maxValue` | Fin de la plage **idéale** | non |
| `toleratedMax` | Borne haute **tolérée** | oui |

La cohérence exigée est :

```
toléré min  ≤  idéal min  ≤  idéal max  ≤  toléré max
```

Toute valeur sortant de la plage physiquement plausible du paramètre est
refusée (un pH toléré à 20 n'existe pas).

**Les bornes tolérées ne sont jamais complétées.** Si une seule des deux est
renseignée, ou si aucune ne l'est, la plage reste à deux limites et le moteur
retombe sur un verdict binaire — dans la plage idéale ou non. Inventer une
limite tolérée pour « compléter » une ligne produirait une frontière que
personne n'a mesurée, avec un score qui semblerait pourtant gradué.

## 3. Le tableau importé — 15 colonnes

L'import lit le tableau « Plages agronomiques » tel quel, dans cet ordre :

| # | Colonne | Champ | Obligatoire |
| --- | --- | --- | --- |
| 1 | Culture | `cropSlug` | oui |
| 2 | Nom scientifique | `scientificName` | non |
| 3 | Paramètre | `parameterKey` | oui |
| 4 | Unité | `unit` | oui |
| 5 | Idéal min | `minValue` | oui |
| 6 | Idéal max | `maxValue` | oui |
| 7 | Toléré min | `toleratedMin` | non |
| 8 | Toléré max | `toleratedMax` | non |
| 9 | Type de source | `sourceType` | non |
| 10 | Source précise | `sourceReference` | voir §6 |
| 11 | Zone concernée | `zone` | non |
| 12 | Statut | lu, **jamais appliqué** | non |
| 13 | Validé par | conservé en note | non |
| 14 | Date de validation | conservée en note | non |
| 15 | Remarques | `sourceNote` | voir §6 |

**Les en-têtes peuvent être en français ou en anglais** ; la casse, les accents,
les espaces et la ponctuation sont ignorés. Le lecteur accepte aussi des en-têtes
partiels : seules les colonnes **obligatoires** manquantes provoquent un refus,
et le message nomme celles qui manquent.

Le lot (`datasetLabel`) **n'est pas une colonne** : il vient de l'appel
(`datasetLabel`) ou de la configuration d'environnement, jamais du fichier.

### 3.1 Libellés de paramètre

Le tableau utilise des libellés français ; les clés techniques restent
acceptées. Les deux vocabulaires désignent la même chose.

| Libellé du tableau | Clé technique | Unité |
| --- | --- | --- |
| pH du sol | `ph` | pH |
| Température de l'air | `airTemperatureC` | °C |
| Humidité volumique du sol | `moisture` | % |
| Salinité maximale (EC) | `ec` | dS/m |
| Profondeur racinaire | `depthCm` | cm |

Un libellé non reconnu ne devine rien : la ligne est refusée et le libellé
d'origine est cité dans l'erreur.

### 3.2 Type de source

Le menu du tableau propose « A choisir », « Agronome », « Publication »,
« Pilote ».

| Valeur du fichier | Valeur enregistrée |
| --- | --- |
| *(vide)* ou « A choisir » | `null` — non déclarée |
| Agronome | `AGRONOMIST` |
| Publication | `PUBLICATION` |
| Pilote | `PILOT` |

**« A choisir » est traité comme vide**, pas comme un type inconnu : c'est
l'état « non renseigné » du menu. Une valeur réellement hors menu est refusée,
et **aucun type par défaut n'est substitué** — ce serait une provenance
inventée.

### 3.3 Zone concernée

La zone est acceptée **sans tenir compte des accents ni de la casse**, et
ramenée à une forme canonique :

| Écrit dans le fichier | Enregistré |
| --- | --- |
| Équateur, Equateur, équateur, EQUATEUR | `Equateur` |
| Bandundu, bandundu, BANDUNDU | `Bandundu` |
| Les deux, les deux, LES DEUX | `Les deux` |
| *(vide)* | `null` |
| toute autre valeur | conservée telle quelle |

Les deux provinces sont écrites **exactement** comme dans `SUPPORTED_PROVINCES`
(`cropCalendars.js`), pour qu'une future comparaison par zone puisse se faire
sans renormaliser de part et d'autre. « Les deux » couvre les deux provinces du
déploiement.

Une zone non reconnue est **conservée, pas rejetée** : un référentiel peut
légitimement circonscrire une fourchette à un bassin ou à un type de sol, qui ne
sont pas des provinces. Deviner une province à partir d'un texte approchant
serait pire que de garder ce qui est écrit.

> **La zone n'influence pas le calcul du score.** Elle est stockée et affichée,
> rien de plus. Les requêtes qui alimentent le moteur filtrent sur `cropSlug`,
> `datasetLabel`, `status`, `deletedAt` et `organizationId` — jamais sur `zone`.
> Une fourchette portant « Bandundu » s'applique donc aujourd'hui à toutes les
> parcelles, y compris en Équateur. C'est un choix assumé tant que les
> fourchettes ne sont pas assez nombreuses pour être découpées par province ;
> le champ est en place pour le jour où elles le seront.

### 3.4 Format du fichier

Séparateurs acceptés : `;`, `,` et tabulation. Les cellules protégées par des
guillemets doubles conservent leur séparateur (`"Référentiel, Équateur"`), et
`""` à l'intérieur d'une cellule donne un guillemet littéral. La virgule
décimale francophone est acceptée.

Les lignes vides sont ignorées **sans décaler les numéros** : une erreur
annonçant « ligne 3 » pointe bien la troisième ligne du fichier.

Un modèle téléchargeable est servi par `GET /agronomic-ranges/import/template`.
Sa ligne d'exemple est **clairement fictive** (culture « exemple », source
« Exemple de format ») : un exemple ressemblant à une référence publiée serait
recopié tel quel et finirait en base comme une provenance vérifiée.

## 4. Un import ne valide jamais rien

C'est la règle la plus importante de ce module.

**Toute ligne importée est créée `PROVISIONAL`, même si le fichier annonce
`VALIDATED`.** Un tableur est une saisie, pas une validation agronomique :
laisser un fichier produire des fourchettes validées ferait entrer dans le
moteur des valeurs que personne n'a vérifiées, avec le label de confiance qui
va avec — et ce label fait sortir les recommandations du régime « indicatif ».

Le validateur et la date annoncés par le fichier ne sont pas perdus : ils sont
**conservés dans `sourceNote`**, à titre d'information, avec la mention explicite
qu'ils ne sont pas appliqués.

Seule la route de validation peut passer une plage en `VALIDATED` :

```
POST /agronomic-ranges/:id/validate
{ "validatedBy": "Dr. …", "validatedAt": "…", "sourceReference": "…" }
```

Elle exige la permission `ranges.validate` (agronome ou administrateur) et
**refuse en 409 si la plage n'a pas de source citable** : « validée » sans
fondement serait une affirmation vide. Un producteur qui l'appelle reçoit 403.

Inversement, **une plage déjà validée n'est jamais écrasée par un import** :
elle est signalée `SKIPPED_VALIDATED`. Modifier une plage validée par l'interface
la fait redevenir `PROVISIONAL`, car la validation portait sur les anciennes
bornes.

## 5. Les cases vides restent vides

Une colonne absente du fichier, ou une cellule vide, donne `null` — jamais une
valeur par défaut, jamais un zéro. Cette règle s'applique aux bornes tolérées,
au type de source, à la zone et au nom scientifique.

La distinction est préservée jusqu'à l'API de modification :

- champ **absent** du `PATCH` → la valeur existante est conservée ;
- champ à **`null`** → la valeur est effacée.

Un simple « valeur par défaut » rendrait impossible la suppression d'une borne
tolérée saisie par erreur.

## 6. Provenance obligatoire

Une ligne sans **ni** source citable **ni** remarque est refusée. Une fourchette
dont on ne peut pas dire d'où elle vient ne doit pas entrer dans un moteur qui
conseille quoi semer.

Deux précisions à porter dans la remarque, selon le paramètre :

- une température issue d'un référentiel générique concerne **l'air, pas le
  sol** ;
- un référentiel générique ne fournit **aucune humidité volumique du sol** :
  des précipitations en millimètres ne sont pas un pourcentage d'humidité.

## 7. API

| Méthode | Route | Permission |
| --- | --- | --- |
| GET | `/agronomic-ranges` | `ranges.read` |
| GET | `/agronomic-ranges/meta` | `ranges.read` |
| GET | `/agronomic-ranges/:id` | `ranges.read` |
| POST | `/agronomic-ranges` | `ranges.write` |
| PATCH | `/agronomic-ranges/:id` | `ranges.write` |
| POST | `/agronomic-ranges/:id/validate` | `ranges.validate` |
| POST | `/agronomic-ranges/:id/retire` | `ranges.write` |
| GET | `/agronomic-ranges/import/template` | `ranges.read` |
| POST | `/agronomic-ranges/import` | `ranges.write` |

`GET /meta` renvoie, par paramètre, la clé, le libellé français, les libellés
acceptés à l'import, l'unité et les bornes physiques ; ainsi que la liste des
types de source et des statuts.

> **Note sur une correction.** `/meta` renvoyait auparavant, dans un champ nommé
> `unit`, les bornes physiques du paramètre (`{min: 0, max: 14}` pour le pH) au
> lieu de l'unité. Le champ `unit` porte désormais l'unité, et les bornes sont
> dans `bounds`.

`POST /import` répond par un résumé et le détail ligne à ligne :

```json
{
  "summary": { "totalLines": 4, "created": 2, "updated": 0,
               "skippedValidated": 0, "skippedEmpty": 0, "errors": 2,
               "dryRun": false },
  "results": [ { "line": 2, "cropSlug": "…", "parameterKey": "ph",
                 "outcome": "CREATED", "id": "…" } ]
}
```

Résultats possibles : `CREATED`, `UPDATED`, `WOULD_CREATE`, `WOULD_UPDATE`,
`SKIPPED_VALIDATED`, `SKIPPED_EMPTY`, `ERROR` (avec `reason`). Chaque ligne est
traitée indépendamment : une ligne invalide est rapportée avec son numéro et sa
raison, les autres sont importées.

**Une ligne sans valeurs idéales n'est pas une erreur.** Un tableur exporté
contient presque toujours des lignes de séparation, une ligne de total, ou des
cultures dont la fourchette n'est pas encore établie. Ces lignes sont ignorées
et comptées dans `skippedEmpty`, séparément de `errors` : les confondre noierait
les vrais problèmes dans le bruit et découragerait de relire le rapport.

Une **demi-fourchette** (une seule des deux bornes idéales renseignée) reste en
revanche une erreur : ce n'est pas une ligne vide mais une fourchette
incomplète, et compléter la borne manquante serait une invention.

Avec `dryRun: true`, rien n'est écrit mais le résumé décrit le résultat attendu
(compteurs tenus, résultats en `WOULD_*`) — un essai à blanc qui annoncerait
zéro ligne ne servirait à rien. La cohérence est vérifiée même en `dryRun`, pour
ne pas laisser passer des lignes que l'import réel refuserait.

Toute écriture est auditée : `agronomicRange.create`, `.update`, `.validate`,
`.retire`, `.import`, `.importCreate`, `.importUpdate`.

## 8. Tests

Les tests sont **séparés en deux familles**, et `npm test` exécute les deux
(`node --test tests/` descend dans `tests/e2e/`).

### 8.1 Tests unitaires purs — `tests/agronomicRangesCsv.test.mjs`

43 tests, **sans base, sans Prisma, sans HTTP** : le module
`agronomicRangesCsv.js` ne fait que transformer du texte. Ils couvrent les cas
qui cassent silencieusement un import réel :

- guillemets, `""` échappé, cellule contenant le séparateur ;
- séparateurs `;`, `,` et tabulation ;
- accents et casse sur les en-têtes et les libellés ;
- alias français et anglais des colonnes ;
- colonnes obligatoires manquantes, nommées dans l'erreur ;
- lignes vides ignorées **sans décaler les numéros** ;
- fins de ligne Windows ;
- libellés de paramètre français et clés techniques ;
- « A choisir » traité comme vide, valeur hors menu signalée ;
- case vide ≠ zéro ; virgule décimale ;
- colonne absente (`undefined`) ≠ cellule vide (`null`) ;
- zone canonique : accents et casse ignorés, zone inconnue conservée ;
- le modèle fourni est relisible par le même lecteur.

### 8.2 Tests de bout en bout — `tests/e2e/agronomicRanges.e2e.test.mjs`

24 tests contre une vraie base PostgreSQL jetable (harness embarqué). Ils
couvrent notamment :

- **une ligne annoncée `VALIDATED` est créée `PROVISIONAL`**, sans validateur ni
  date, avec l'annonce conservée en note ;
- **seule la route de validation peut valider**, et un producteur y reçoit 403 ;
- un second import ne valide pas non plus une plage existante ;
- les bornes tolérées sont enregistrées, exposées et leur incohérence refusée
  (422) sans rien écrire ;
- une borne tolérée peut être effacée par un `null` explicite, et un `PATCH`
  qui ne mentionne pas le champ ne le touche pas ;
- « A choisir » ne devient pas un type de source ; une valeur hors menu est
  refusée ;
- une ligne sans valeurs idéales est ignorée et comptée dans `skippedEmpty`,
  **sans** être une erreur, tandis qu'une demi-fourchette reste une erreur ;
- la zone est enregistrée sous sa forme canonique par l'import **et** par
  l'API, « Équateur » et « Equateur » donnant la même valeur ;
- les libellés français du tableau sont acceptés ;
- une plage déjà validée n'est pas écrasée ;
- le refus au producteur (403), le `dryRun`, la ligne invalide rapportée sans
  bloquer le fichier, la source protégée par des guillemets, l'audit.

## 9. Ce qui n'est pas vérifié

**Les écrans web et mobile sont vérifiés par compilation seule**
(`tsc --noEmit`, 0 erreur sur les deux projets). Aucun navigateur ni
simulateur ne les a pilotés : l'affichage des quatre limites, du type de source
et de la zone, ainsi que le comportement réel des champs de saisie, restent à
valider visuellement.

La migration `20261023000000_agronomic_range_tolerance` est appliquée et
vérifiée par `check:migrations` sur une base vierge. Elle ajoute un enum et cinq
colonnes **nullables** : aucune donnée existante n'est réécrite, et aucune
migration déjà appliquée n'a été modifiée.
