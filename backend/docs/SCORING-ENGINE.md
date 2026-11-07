# Moteur de notation — score d'adéquation et versionnage

Ce document décrit comment un état de parcelle mesuré devient un score, comment
les scores par paramètre sont combinés, et pourquoi le résultat porte toujours
sa version.

Il complète `docs/AGRONOMIC-RANGES.md` (les fourchettes elles-mêmes) et
`docs/GEOSPATIAL.md` §8 (la gouvernance du référentiel).

---

## 1. Ce qu'est un score — et ce qu'il n'est pas

**Le score mesure une adéquation** : dans quelle mesure l'état mesuré de la
parcelle convient à une culture, d'après des fourchettes de référence.

Ce n'est **ni un rendement attendu, ni une probabilité de réussite**.

La distinction n'est pas de forme. Un nombre entre 0 et 1 affiché à côté d'une
culture se lit spontanément comme une chance sur deux, ou comme un pourcentage
de récolte — deux promesses que le moteur ne peut pas tenir, parce qu'il ne
connaît ni la météo à venir, ni les itinéraires techniques, ni les débouchés. Le
rappel est donc porté par l'API (`scoreNotice`), par l'explication en français,
et par l'étiquette affichée dans les écrans (« adéquation 0,80 »).

Le score est borné par la confiance des fourchettes qui le produisent : tant
qu'une plage est `PROVISIONAL`, la sortie reste **« indicative »**, quel que soit
le nombre de décimales du score.

## 2. Score par paramètre — quatre limites

Quand une plage porte ses **quatre** limites, la notation est graduée :

```
  toléré min      idéal min            idéal max      toléré max
      │               │                    │               │
      0 ─────────── 1 ═══════════════════ 1 ──────────── 0
         décroissance     plein accord        décroissance
```

- **1** partout dans la plage idéale ;
- **décroissance linéaire** de 1 à 0 entre l'idéal et la limite tolérée ;
- **0** au-delà des limites tolérées.

Formellement, pour une valeur `v` :

| Position de `v` | Score |
| --- | --- |
| `idéal min ≤ v ≤ idéal max` | `1` |
| `toléré min < v < idéal min` | `(v − toléré min) / (idéal min − toléré min)` |
| `idéal max < v < toléré max` | `(toléré max − v) / (toléré max − idéal max)` |
| `v ≤ toléré min` ou `v ≥ toléré max` | `0` |

### 2.1 Si une borne tolérée manque

**Le paramètre retombe sur le verdict binaire** — dans la plage idéale ou non.

Il faut les **quatre** limites, pas trois : avec une seule borne tolérée, la
décroissance ne peut être calculée que d'un côté, et compléter l'autre serait
une invention. Une frontière que personne n'a mesurée produirait un score qui
*semblerait* gradué sans l'être — le pire des deux mondes.

Le mode réellement utilisé est exposé par critère (`scoringMode` : `GRADED` ou
`BINARY`), pour qu'un 0 binaire et un 0 gradué ne soient pas confondus : ils ne
disent pas la même chose.

### 2.2 Bande de largeur nulle

Si `toléré min == idéal min` (ou l'équivalent en haut), la bande de décroissance
est de largeur nulle : toute valeur hors de l'idéal vaut **0**. Diviser par zéro
donnerait `Infinity`, pas un score.

## 3. Combinaison — une règle versionnée, pas une constante

La façon de combiner les scores par paramètre est un **paramètre déclaré**,
porté par une version du moteur. Ce n'est pas une valeur enfouie dans la
fonction de notation, pour trois raisons :

- **Un résultat doit rester lisible plus tard.** Une recommandation enregistrée
  sous une version garde sa version ; si la règle change, l'ancien résultat
  reste interprétable.
- **Changer la règle change le classement.** Deux cultures peuvent s'inverser.
  Ce choix doit être visible, daté et réversible.
- **Deux règles doivent pouvoir coexister** le temps d'une comparaison, sur les
  mêmes données, de façon reproductible.

| Version | Notation | Combinaison | Publiée le |
| --- | --- | --- | --- |
| `1.0` | Binaire — dans la plage idéale ou non | Moyenne des critères | 2026-10-01 |
| **`2.0`** *(défaut)* | Graduée sur quatre limites | **Facteur le plus limitant** | 2026-10-23 |

### 3.1 Facteur le plus limitant (défaut)

Le score retenu est le **minimum** des scores par paramètre. Une culture ne vaut
pas mieux que son pire paramètre : un pH catastrophique ne se compense pas par
une salinité parfaite. C'est aussi ce que l'agriculteur comprend — « ce qui
bloque, c'est ceci ».

### 3.2 Moyenne des critères (1.0, conservée)

La moyenne n'est plus la règle par défaut mais reste disponible : elle sert de
point de comparaison, et les recommandations déjà enregistrées sous la version
1.0 ont été calculées ainsi.

> **Changement de comportement.** Sous 2.0, un critère très défavorable n'est
> plus dilué par les autres. Sur le même état mesuré, deux cultures classées
> dans un ordre sous 1.0 peuvent s'inverser sous 2.0. C'est précisément ce que
> le versionnage rend explicite plutôt que silencieux.

### 3.3 Rien d'évaluable

Un ensemble vide de scores donne **`null`, jamais `0`**. « Rien d'évaluable » et
« tout est défavorable » sont deux affirmations différentes, et la seconde est
fausse quand il n'y a rien à évaluer.

### 3.4 Sélection et refus

La version par défaut vient de `RECOMMENDATION_ENGINE_VERSION` (défaut `2.0`).
Un appel peut en demander une autre via `engineVersion`.

**Une version inconnue est refusée (422), jamais remplacée** par la plus
récente : produire un score sous une règle que l'appelant n'a pas demandée
serait tromper sur ce qui a été calculé.

### 3.5 Arrondi

Le score combiné est arrondi à **4 décimales** — bien au-delà de toute
signification agronomique. L'arrondi sert à ne pas exposer
`0.7999999999999998` là où le calcul veut dire `0,8` : seize décimales
suggéreraient une précision que ni les fourchettes ni les mesures ne possèdent.

### 3.6 Un paramètre non mesuré est ignoré — d'où deux garde-fous

Avec la règle du facteur le plus limitant, un paramètre **non mesuré** n'est pas
noté : il n'entre ni dans le minimum, ni dans aucune moyenne. C'est voulu —
noter 0 un paramètre sans mesure ferait dire « défavorable » là où l'on ne sait
rien. Mais cela crée un risque : un score élevé pourrait reposer sur un seul
paramètre mesuré, sans que rien ne le signale.

Deux garde-fous existent, **conservés et exposés** :

| Garde-fou | Valeur | Effet |
| --- | --- | --- |
| `MIN_EVALUATED_CRITERIA` | **2** | moins de deux critères évalués ⇒ la culture n'est pas classée |
| `MIN_COVERAGE` | **0,6** | part des critères évaluables effectivement évalués ⇒ sous 0,6, pas de classement |

Le résultat porte donc `evaluatedCount` et `coverage` par culture, et
`tooFewCriteria` côté moteur. Une culture écartée figure dans
`decomposition.insufficientData` avec un **motif explicite** —
`TOO_FEW_CRITERIA` ou `LOW_COVERAGE` — plutôt qu'une simple couverture à
interpréter.

> La moyenne (v1.0) était moins exposée à ce risque : un paramètre manquant
> réduisait mécaniquement le dénominateur. Le facteur le plus limitant ne le
> réduit pas. Les garde-fous ne sont donc pas un reliquat de la v1.0, ils sont
> **plus** nécessaires sous la v2.0.

## 4. La prévision ne peut que durcir un score

Quand une prévision prouvée existe pour la période de semis, la valeur notée est
la **plus défavorable** entre la mesure et la prévision :

- franchissement prévu **sous** le minimum → `min(mesure, prévu min)` ;
- franchissement prévu **au-dessus** du maximum → `max(mesure, prévu max)` ;
- pas de franchissement, ou franchissement **dans l'erreur du modèle** → la
  mesure seule.

Prendre la valeur prévue seule pourrait **remonter** un score : une prévision
ferait alors dire qu'une parcelle mesurée défavorable va s'arranger. C'est
l'inverse du rôle d'une prévision ici.

Un franchissement situé dans l'erreur déclarée du modèle ne durcit rien : il est
signalé (`watch`), pas appliqué. Durcir sur du bruit ferait varier le score au
gré de l'erreur du modèle.

## 5. Reproductibilité — les plages utilisées sont enregistrées

Une plage peut être corrigée après coup, et c'est normal : c'est même le but du
statut `PROVISIONAL`. Encore faut-il qu'une recommandation déjà enregistrée
reste **lisible sous les valeurs qui ont servi à son calcul**.

Chaque critère porte donc un `rangeSnapshot` :

```json
"rangeSnapshot": {
  "rangeId": "…",
  "parameterKey": "ph",
  "idealMin": 5.0, "idealMax": 6.0,
  "toleratedMin": 4.5, "toleratedMax": 8.0,
  "unit": "pH",
  "status": "PROVISIONAL",
  "sourceType": "PUBLICATION",
  "sourceReference": "Source de test",
  "rangeVersion": 3,
  "datasetLabel": "scoring"
}
```

**Pourquoi l'instantané et pas seulement un identifiant.** Sans les valeurs
recopiées, retrouver la plage ne suffirait pas : la ligne a pu être modifiée, et
l'identifiant pointerait alors vers d'autres bornes. Sans l'identifiant, on ne
pourrait pas dire *quelle* ligne a servi, ni comparer sa version à la version
actuelle. Les deux sont nécessaires.

**Pourquoi `expected` ne suffisait pas.** Le critère portait déjà
`expected: "entre 5 et 6"` : une phrase mise en forme pour l'affichage. Elle ne
contient ni les bornes tolérées, ni l'identifiant, ni la source, et sa précision
dépend de la mise en forme. Un calcul fondé dessus n'était pas reproductible.

`rangeVersion` permet de distinguer deux corrections successives d'une même
plage, et donc de dire si une recommandation est antérieure à la dernière
correction.

## 6. L'élimination sur critère dur reste inchangée

La salinité (`ec`) est un critère **éliminatoire** : au-dessus de sa plage idéale
**mesurée**, la culture est écartée, quel que soit le score des autres critères.

Trois points sont volontairement conservés :

- l'élimination porte sur la **mesure constatée**, pas sur la prévision —
  écarter définitivement une culture sur une prévision, avec son erreur
  déclarée, serait plus nuisible qu'utile ;
- une culture éliminée n'a **pas de score** (`null`) : elle est hors classement,
  pas mal classée ;
- **l'élimination ne dépend pas du score gradué.** Une salinité au-dessus de
  l'idéal mais sous le toléré produit un score gradué positif — et élimine
  quand même. C'est exactement pourquoi le critère dur ne doit pas être déduit
  du score.

## 7. Les seuils d'alerte gardent la plage idéale

**Comportement inchangé, et dit explicitement** : les seuils de surveillance
dérivés d'une recommandation utilisent la **plage idéale** (`min`/`max`), pas les
bornes tolérées.

C'est un choix : une alerte doit se déclencher dès la sortie de la plage idéale,
c'est-à-dire au moment où il est encore utile d'agir. Déclencher aux limites
tolérées ne laisserait plus de marge d'intervention.

Les bornes tolérées servent donc au **score**, pas aux alertes. Vérifié par test
de bout en bout : `thresholds.ph.min/max` valent les bornes idéales.

## 8. Ce que porte chaque résultat

```json
{
  "recommendation": {
    "ruleSetVersion": "2.0",
    "scores": [{
      "cropSlug": "mais",
      "score": 0.8,
      "engineVersion": "2.0",
      "combinationRule": "MOST_LIMITING",
      "scoringModel": "GRADED_FOUR_LIMITS",
      "criteria": [{
        "key": "ph", "observed": 6.4,
        "adequacy": 0.8, "scoringMode": "GRADED",
        "met": false, "rangeStatus": "PROVISIONAL"
      }]
    }]
  },
  "engineVersion": "2.0",
  "combinationRule": "MOST_LIMITING",
  "combinationRuleLabel": "Facteur le plus limitant",
  "scoringModel": "GRADED_FOUR_LIMITS",
  "scoreNotice": "Le score mesure l'adéquation …",
  "indicative": true
}
```

La version est **figée à l'écriture** dans `CropRecommendation.ruleSetVersion`
— la colonne existait déjà, aucune migration n'a été nécessaire. Si la règle par
défaut change plus tard, la recommandation reste lisible sous la règle qui l'a
produite.

`GET /recommendations/engine` expose les versions, les règles, les modèles de
notation et le rappel — pour qu'un écran affiche la règle sans la recopier, donc
sans risquer de la reformuler.

> La route `/engine` est déclarée **avant** `/:id` : sans cet ordre, « engine »
> serait interprété comme un identifiant de recommandation.

## 9. Tests

Séparés en deux familles ; `npm test` exécute les deux.

### 9.1 Unitaires purs — `tests/recommendationScoring.test.mjs`

29 tests, **sans base, sans Prisma, sans HTTP**. Valeurs **fictives**
(tolérée 4,5 · idéale 5,5–7,0 · tolérée 8,0) :

- 6,0 → **1** ; 5,0 → **0,5** ; 4,5 → **0** ; 8,0 → **0** ; 7,5 → **0,5** ;
- les deux bornes idéales valent 1 ; décroissance linéaire vérifiée au quart, à
  la moitié, aux trois quarts ; score toujours dans [0 ; 1] ;
- au-delà des limites tolérées : 0 ;
- **une seule borne tolérée** → verdict binaire, aucune limite inventée ;
- **aucune borne tolérée** → comportement binaire inchangé ;
- **bande de largeur nulle** → pas de division par zéro ;
- valeur non numérique → aucun score ;
- **paramètre manquant** → signalé `NO_MEASUREMENT`, pas noté ;
- **plage sans référentiel** → critère écarté, rien de deviné ;
- rien d'évaluable → score `null`, jamais 0 ;
- **deux versions sur les mêmes données** : 2.0 → 0,75 (minimum), 1.0 → 0,5
  (moyenne), reproductibles d'une exécution à l'autre ;
- élimination sur salinité inchangée, alors que le score gradué serait positif ;
- une plage `PROVISIONAL` ne change pas le score mais reste visible ;
- règle inconnue et version inconnue refusées.

Les deux tests `toRange` de `tests/agronomicRangesCsv.test.mjs` (45 tests au
total) vérifient par ailleurs que l'identifiant, la version et le lot de la
plage survivent à la normalisation — sans eux, aucun instantané n'est possible.

### 9.2 Bout en bout — `tests/e2e/scoringEngine.e2e.test.mjs`

12 tests contre une vraie base PostgreSQL jetable :

- `GET /recommendations/engine` expose versions, règles, modèles et rappel ;
- la route `/engine` n'est pas capturée par `/:id` ;
- le score est **gradué** sur les quatre limites écrites par l'API
  (pH 6,4 → 0,8, vérifié par le calcul) ;
- la version est **figée à l'écriture**, relue depuis la base ;
- **deux versions sur les mêmes données** : 2.0 → 0,8, 1.0 → 0,5, reproductibles ;
- une version inconnue → **422**, et rien n'est enregistré ;
- l'explication dit ce qu'est un score, la version et la règle ;
- les **seuils d'alerte gardent la plage idéale** ;
- une plage `PROVISIONAL` garde la sortie « indicative » ;
- le **nombre de critères évalués** et la **couverture** sont exposés ;
- **un seul critère évalué ne suffit pas à classer** (`TOO_FEW_CRITERIA`) ;
- les **plages utilisées sont enregistrées et survivent à leur modification** :
  la plage est corrigée après coup, la recommandation relue garde son
  instantané et son score, une nouvelle recommandation lit la plage corrigée.

## 10. À moyen terme — deux niveaux d'alerte (non implémenté)

**Ce qui suit est une intention documentée, pas une fonctionnalité.** Rien de
cette section n'est codé, aucun test ne la couvre, aucune route ne l'expose.

Aujourd'hui, les seuils de surveillance dérivent de la **plage idéale** (§7) :
une seule limite, une seule alerte. Le score gradué, lui, distingue déjà « hors
de l'idéal mais tolérable » de « hors du toléré ». Il y a donc une information
que le score connaît et que l'alerte ignore.

L'idée serait d'en tirer **deux niveaux** :

| Niveau | Déclencheur | Sens pour l'agriculteur |
| --- | --- | --- |
| **Surveillance** | sortie de la plage **idéale**, encore dans le toléré | « ça dérive, à suivre » |
| **Action** | sortie des limites **tolérées** | « il faut agir » |

Ce que cela exigerait avant d'être fait :

- **un seuil de sévérité par niveau**, versionné comme la règle de combinaison —
  changer le déclenchement d'une alerte change le nombre de SMS reçus, donc le
  coût et la confiance dans le canal ;
- **un réglage par agriculteur**, parce qu'un seuil unique produira des volumes
  très différents d'une parcelle à l'autre ;
- **une mesure du bruit** sur données réelles : deux niveaux multiplient les
  occasions de fausse alerte, et un canal qui alerte trop cesse d'être lu ;
- **un garde-fou de volume**, le double niveau doublant mécaniquement le nombre
  d'événements ;
- **un accord explicite** sur le fait que le niveau « surveillance » ne justifie
  pas à lui seul un SMS.

Le risque principal est connu : deux niveaux mal calibrés dégradent le canal
d'alerte, qui est le canal **primaire** du déploiement. C'est pourquoi l'idée est
écrite ici plutôt qu'implémentée : elle attend des données réelles pour fixer les
seuils.

## 11. Ce qui n'est pas vérifié

**Les écrans web et mobile sont vérifiés par compilation seule**
(`tsc --noEmit`, 0 erreur sur les deux projets). L'affichage de l'étiquette
« adéquation », de la version du moteur et de la règle n'a été piloté par aucun
navigateur ni simulateur.

**Aucune règle n'a été validée par un agronome sur des données réelles.** Le
choix du facteur le plus limitant comme règle par défaut est un choix
d'ingénierie agronomique documenté, pas une conclusion mesurée sur les parcelles
du déploiement. Le versionnage existe précisément pour pouvoir en changer.

**Aucun modèle appris n'est en jeu ici.** Ce moteur est entièrement déclaratif :
un modèle appris ne le remplacerait que s'il faisait mieux, conformément au
cahier des charges.
