# Dépôt de fichiers géospatiaux — géoradar (GPR) et imagerie drone

**Module :** `src/modules/geospatialImport/`
**Routes :** `POST /api/v1/geospatial/imports` · `GET /api/v1/geospatial/imports` · `GET /api/v1/geospatial/imports/:id`
**Permissions :** `geospatial.write` (dépôt) · `geospatial.read` (lecture)

---

## 1. Ce que fait ce module

Il **reçoit** un fichier, vérifie qu'il est acceptable, le stocke, et enregistre
une ligne au statut `RECEIVED`. C'est tout.

## 2. Ce qu'il ne fait pas

**Aucun traitement du contenu.** Aucun parsing, aucune extraction de
coordonnées, aucune valeur calculée, aucune estimation.

Le statut est **`RECEIVED`, et seulement `RECEIVED`**. Les valeurs
`PROCESSING`, `COMPLETED` et `ERROR` existent dans l'énumération `ImportStatus`
mais ne sont **jamais écrites par ce module** : elles appartiennent à une étape
de traitement à part, qui n'existe pas encore. Écrire `COMPLETED` ici serait
affirmer qu'un traitement a eu lieu alors qu'aucun n'a été lancé.

`result`, `startedAt` et `completedAt` restent vides. Un test les vérifie à
chaque exécution (`tests/geospatialImport.test.mjs`, *« aucun traitement :
RECEIVED seul, aucun résultat inventé »*) : si quelqu'un les remplit un jour, ce
test échoue.

---

## 3. Règles appliquées

### 3.1 Le type est vérifié sur les octets, pas sur l'extension

Une extension est une **déclaration du client**, pas une propriété du fichier.
Renommer `malware.exe` en `releve.jpg` coûte une seconde. Vérifier le type sur
l'extension seule revient à faire confiance à l'expéditeur sur le point précis
qu'on cherche à contrôler.

Les premiers octets sont donc comparés aux signatures connues
(`src/shared/fileMagic.js`) :

| Signature | Format | Type de dépôt | Solidité |
|---|---|---|---|
| `FF D8 FF` | `image/jpeg` | `DRONE_IMAGE` | pleine |
| `89 50 4E 47 0D 0A 1A 0A` | `image/png` | `DRONE_IMAGE` | pleine |
| `49 49 2A 00` / `4D 4D 00 2A` | `image/tiff` | `DRONE_IMAGE` | pleine |
| `50 4B 03 04` | `application/zip` | `GPR` | **faible** |
| octets 3 255-3 256 = « 01 » / « 02 » | `application/x-segy` | `GPR` | **faible** |

Les deux ordres d'octets TIFF sont acceptés : un GeoTIFF peut être dans l'un ou
l'autre selon l'outil qui l'a exporté.

Ce n'est **pas** une analyse de contenu. On ne décode rien, on n'interprète
aucune donnée métier. On répond à une seule question : *ce fichier
commence-t-il comme le type déclaré ?*

#### Limites assumées : ZIP et SEG-Y

Deux contrôles sont **faibles**, au même statut l'un que l'autre. La réponse
porte `detection.controleFaible: true`, et l'audit l'enregistre.

**ZIP.** Certains formats géoradar sont effectivement distribués en archive,
donc on l'accepte. Mais `PK\3\4` identifie une **archive**, pas un relevé :
n'importe quel ZIP du monde passe ce contrôle, y compris une archive sans aucun
rapport avec la géophysique. Dire « ZIP = GPR » serait exagérer ce qui est
vérifié — on vérifie « c'est une archive », rien de plus.

**SEG-Y.** Le format SEG-Y, répandu en géoradar, n'a **pas de signature magique
en tête de fichier**. Ses 3 200 premiers octets sont un en-tête textuel EBCDIC
libre. La convention exploitable est le marqueur de révision aux octets
3 255-3 256, écrit en EBCDIC ou en ASCII selon l'outil émetteur — les deux sont
acceptés.

Dans les deux cas, un fichier construit pour passer le test y passera. Comme
aucun traitement ne s'appuie sur ce contrôle (statut `RECEIVED` seul), la
conséquence reste bornée à un fichier non géospatial accepté dans le stockage.

### 3.2 Tailles

| Type | Limite |
|---|---|
| `GPR` | 64 Mo |
| `DRONE_IMAGE` | 64 Mo |

Dépasser renvoie **413 `PAYLOAD_TOO_LARGE`**, sans écriture.

⚠ **Ces plafonds sont imposés par le transport, pas par le métier.** Voir §5.1.

### 3.3 Somme de contrôle et doublon

La somme **SHA-256** est calculée à la réception, avant stockage.

Un fichier de même somme déjà déposé **dans la même organisation** est refusé en
**409 `CONFLICT`**, quel que soit son nom — le doublon est détecté sur le
contenu, pas sur le nom. La réponse cite la somme et l'identifiant du dépôt
d'origine.

La portée est l'organisation : le même relevé déposé par deux organisations
distinctes est **légitime** (partage de données entre coopératives).

Le refus est garanti **en base**, pas seulement dans le service : la migration
`20261025120000_geospatial_import_filename_and_unique_checksum` pose une
contrainte d'unicité sur `(organization_id, checksum)`. Sans elle, deux dépôts
identiques arrivant en même temps passeraient tous deux le contrôle
applicatif. Si la contrainte tranche, le fichier déjà écrit est supprimé pour ne
pas rester orphelin.

### 3.4 Nom de fichier assaini

Le nom fourni est assaini (`fileMagic.js#assainirNom`) : octet nul, caractères
de contrôle, séparateurs de chemin, remontée de répertoire (`..`), et tout
caractère hors `[A-Za-z0-9._-]` sont retirés ; les espaces deviennent des
soulignés ; les accents sont **transcrits, pas détruits** (`relevé` → `releve`).

> `NFKD` et non `NFKC` : `NFKC` conserve `é` précomposé, qui tombe ensuite dans
> le filtre « caractères autorisés » et devient un souligné — `relevé` donnerait
> `relev_`. Dans une interface française, détruire les accents d'un nom de
> fichier n'est pas acceptable.

Le nom assaini ne sert qu'à **l'affichage**. La clé de stockage est construite
côté serveur :

```
geospatial/{organizationId}/{kind}/{id}.{extension détectée}
```

Le nom fourni par le client n'y apparaît **jamais**, et l'extension vient du
format **détecté**, pas du nom. Reprendre l'extension du client remettrait dans
la clé exactement la confiance qu'on vient de refuser d'accorder : un PNG nommé
`.jpg` serait stocké sous `.jpg`. C'est ce qui rend l'évasion de chemin
impossible, indépendamment de la qualité de l'assainissement.

### 3.5 Emplacement — hors de tout dossier public

Un fichier déposé par un utilisateur **n'est pas une ressource web**. S'il
tombait dans un dossier servi statiquement, il serait téléchargeable par
quiconque connaît son URL — sans authentification ni contrôle d'organisation.

Le pilote local (`GEOSPATIAL_STORAGE_DIR`, par défaut `./storage/geospatial`)
**refuse de démarrer** si le chemin résolu se trouve sous `public/`, `dist/`,
`build/`, `static/` ou `www/`. Il refuse aussi toute clé qui, une fois résolue,
sort de sa racine.

### 3.6 Isolation par organisation

`organizationId` vient du **jeton** et de l'en-tête `X-Organization-Id`, vérifié
contre les adhésions (`src/middleware/tenant.js`). Il n'est jamais lu du corps
de la requête.

Un dépôt appartenant à une autre organisation renvoie **404, pas 403** :
répondre 403 révélerait que l'identifiant existe. Même règle pour une parcelle
inconnue ou appartenant à un tiers.

### 3.7 Équipement (`deviceId`)

Si `deviceId` est fourni, l'équipement doit appartenir à l'organisation active,
sinon **404**.

Sans ce contrôle, `deviceId` serait une chaîne libre : n'importe qui pourrait
rattacher un dépôt à l'équipement d'une autre organisation, et toute lecture
joignant sur l'équipement remonterait une provenance mensongère.

### 3.8 Quota cumulé de stockage

`GEOSPATIAL_ORG_QUOTA_BYTES` (défaut **5 Go**, `0` désactive) borne la **somme**
des octets stockés par organisation. Un dépôt qui ferait dépasser le plafond est
refusé en **413 `PAYLOAD_TOO_LARGE`**, **avant** l'écriture — pas de dépôt
partiel.

Ce contrôle couvre ce que le refus de doublon ne peut pas borner : il suffit de
changer un octet pour qu'un fichier ne soit plus un doublon. Seul un plafond
cumulé limite le volume.

Le contrôle porte sur la somme déjà stockée **plus** le fichier courant, et ne
compte que l'organisation active.

### 3.9 Authentification avant lecture du corps

Le parseur de cette route accepte 100 Mo. S'il s'exécutait avant toute
authentification, n'importe qui pourrait faire allouer 100 Mo par requête, sans
identité, en boucle — un vecteur d'épuisement.

Sur ce chemin, l'ordre est donc : **limite de débit stricte → authentification →
parseur**. Une requête sans jeton est refusée en 401 **sans que son corps soit
lu**. Le reste de l'API garde son parseur à 1 Mo.

La recette e2e le prouve en envoyant un JSON **volontairement invalide** de plus
de 2 Mo : si le parseur tournait, il échouerait sur la syntaxe (422). Obtenir
401 prouve que l'authentification a tranché avant. Une contre-épreuve envoie le
même corps **avec** jeton et obtient 422 — sans elle, le test pourrait passer
parce que la route refuserait tout corps volumineux.

#### Limite de débit appliquée : `writeLimiter`

| | Production | Hors production |
|---|---|---|
| Fenêtre | 60 s | 60 s |
| Requêtes admises | **30** | **1 000** |
| Portée | par adresse IP | par adresse IP |
| Statut au plafond | 429 | 429 |
| Code renvoyé | `WRITE_RATE_LIMITED` | `WRITE_RATE_LIMITED` |

Au plafond, la réponse est **429** avec `Retry-After`, et le corps
`{ success: false, code: 'WRITE_RATE_LIMITED', message: … }`. Aucune ligne
n'est créée, aucun octet n'est stocké.

Ces valeurs sont **observées**, pas recopiées : `tests/rateLimitDeposit.test.mjs`
pilote le vrai `writeLimiter` avec sa vraie configuration sur une vraie
application Express, et compte **1 000** requêtes admises puis le refus. Il
vérifie aussi que le compteur est **par adresse IP** et non global — deux
adresses distinctes obtiennent chacune leur quota (l'une 995 après 5 requêtes
déjà consommées, l'autre 1 000 entiers). Sans cela, un seul client abusif
bloquerait l'API pour tout le monde.

Le plafond **production (30/min)** suit le même code mais n'est pas exécuté par
la suite, qui tourne en `NODE_ENV=test`.

⚠ **Ordre des middlewares.** `writeLimiter` compte la requête **avant**
l'authentification : une requête refusée en 401 consomme quand même du quota.
C'est voulu — compter après l'authentification laisserait un attaquant non
authentifié sonder sans limite — mais cela signifie qu'un client légitime
derrière un NAT partagé peut être affecté par ses voisins.

La route est **aussi** soumise au `globalLimiter` (300 / 15 min en production,
code `RATE_LIMITED`), appliqué plus bas dans la pile. Le plus contraignant des
deux gagne : sur cette route, c'est `writeLimiter`.

### 3.10 Contrôle du base64

`Buffer.from(x, 'base64')` **ne lève jamais** : il ignore les caractères hors
alphabet et s'arrête au premier caractère inattendu. Une chaîne corrompue
produit donc un fichier **tronqué** mais accepté. Trois contrôles successifs :

1. **Plafond** sur la longueur, avant tout décodage.
2. **Syntaxe** de la chaîne : alphabet `A-Za-z0-9+/`, longueur multiple de 4,
   rembourrage `=` uniquement en fin. Les retours à la ligne sont retirés
   d'abord — le base64 replié sur 76 colonnes est licite et doit passer.
3. **Aller-retour** contre la chaîne **reçue** : `tampon.toString('base64')`
   doit redonner exactement l'entrée normalisée.

> Ce troisième contrôle attrape ce que la syntaxe laisse passer, notamment les
> bits de queue non nuls : `AA==` et `AB==` décodent vers le même octet, seule
> la forme canonique est acceptée.
>
> La version précédente comparait `Buffer.from(x)` à `Buffer.from(x)` — une
> **tautologie** qui ne peut jamais échouer, et ne testait donc rien.

---

## 4. Couverture de test

### 4.1 Unitaires — 69 tests

| Fichier | Tests | Couvre |
|---|---|---|
| `tests/fileMagic.test.mjs` | 22 | signatures, type usurpé, SEG-Y **et ZIP** contrôles faibles, assainissement, emplacement du stockage, évasion de racine |
| `tests/geospatialImport.test.mjs` | 36 | dépôt nominal, type usurpé, taille, doublon, tiers, **base64 invalide**, **équipement**, **quota cumulé**, nettoyage en cas de course |
| `tests/errorCodeContract.test.mjs` | 11 | champ `code` sur toutes les réponses d'erreur, ajout additif, cohérence OpenAPI |

### 4.2 Bout en bout — 27 tests

`tests/e2e/geospatialImport.e2e.test.mjs`, contre PostgreSQL réel
(`embedded-postgres`) et la migration versionnée :

- dépôt nominal : 201, `RECEIVED`, octets identiques sur le disque ;
- **type usurpé** refusé par la route ;
- **fichier trop gros** (64 Mo + 1 octet) refusé en 413 ;
- **doublon** refusé en 409, et **contrainte d'unicité réellement posée en
  base** — vérifiée dans `pg_indexes`, puis franchie en insertion directe pour
  laisser PostgreSQL trancher ;
- **tiers** : 404, liste aveugle aux dépôts d'autrui ;
- **authentification avant lecture du corps** : un JSON invalide de plus de
  2 Mo sans jeton donne 401, et 422 avec jeton (contre-épreuve) ;
- **base64 invalide** et non canonique refusés ;
- **équipement** d'un tiers refusé en 404, dans les deux sens ;
- permissions, audit.

Ce que la recette e2e prouve et que les unitaires ne peuvent pas : la
contrainte d'unicité PostgreSQL, et l'ordre réel des middlewares. Un double de
test ne peut reproduire fidèlement ni l'un ni l'autre.

## 5. Ce qui n'est pas vérifié

Ces points sont énoncés parce qu'ils **limitent la portée de ce qui précède**.

### 5.1 Le transport base64 plafonne la taille — décision en attente

Le dépôt passe par un **corps JSON en base64** : aucun parseur multipart
(`multer`, `busboy`, `formidable`) n'est présent dans les dépendances, et en
ajouter une est une décision qui ne m'appartient pas.

Conséquences mesurées :

- le parseur de cette route est borné à **100 Mo**, alors que le reste de l'API
  reste à 1 Mo (`src/app.js` — la limite globale n'a **pas** été relevée, ce qui
  exposerait toutes les autres routes) ;
- un fichier de 64 Mo devient ~85 Mo une fois encodé, et **~33 % de mémoire en
  plus** est conservé en entier par le processus pendant la requête ;
- **les relevés géoradar dépassent couramment 64 Mo.** La limite annoncée au
  §3.2 est donc un plafond de transport, pas une limite métier. Annoncer 512 Mo
  ici — ce que le code indiquait avant correction — aurait été indiquer une
  limite **inatteignable**, le corps étant refusé bien avant.

Un téléversement en flux (multipart) lèverait cette contrainte. **C'est une
décision à prendre**, pas un détail d'implémentation.

⚠ **Et un obstacle en amont.** La configuration nginx documentée pose
`client_max_body_size 2m` : avec elle, nginx renvoie 413 **avant** que Node ne
voie la requête, et le dépôt est inutilisable en production quel que soit le
plafond applicatif. Voir `docs/DEPLOYMENT.md` §5.2. **Non corrigé** — c'est une
décision d'infrastructure.

### 5.2 Le pilote de stockage objet n'a jamais été exécuté

`creerStockageObjet()` (`src/integrations/storage.js`) suit l'API de
`@supabase/supabase-js` telle qu'elle est déjà utilisée dans
`src/modules/media/media.service.js`, mais **il n'a jamais rencontré un vrai
panier** : aucun compte Supabase ni stockage objet n'est accessible depuis cet
environnement.

Tous les tests tournent sur le **pilote local**. Le pilote objet est donc
**non vérifié**, y compris :

- son comportement réel sur `upload` / `download` / `remove` ;
- `lireEnTete()`, qui télécharge le fichier entier puis le tronque — le stockage
  objet ne propose pas de lecture partielle par octets. Coûteux pour les gros
  fichiers ;
- `existe()`, qui s'appuie sur `list()` et peut être affecté par la pagination.

**À valider avant tout usage réel.**

### 5.3 Aucun écran n'est piloté

Aucune interface web ni mobile n'appelle ces routes. Il n'y a **ni écran de
dépôt, ni liste de dépôts** côté client. Les routes sont testées par l'API
uniquement.

### 5.4 Ce qui n'est pas contrôlé

- **La validité interne du fichier.** Un JPEG dont l'en-tête est correct mais
  dont le corps est corrompu est accepté. Le module ne décode rien — c'est
  voulu, mais cela signifie qu'un fichier inutilisable peut être stocké.
- **Les logiciels malveillants.** Aucune analyse antivirale. Le contrôle porte
  sur le type, pas sur l'innocuité.
- **L'appartenance réelle de l'équipement.** `deviceId` est vérifié **par
  organisation** (§3.7), mais rien ne prouve que cet équipement a réellement
  produit le fichier : le rattachement reste déclaratif.
- **La course sur le quota.** Voir §5.5, traité à part.

### 5.5 Course sur le quota cumulé — risque connu, non corrigé

**Le risque.** Le plafond est lu, comparé, puis l'écriture a lieu — hors
transaction. Deux dépôts simultanés d'une même organisation peuvent donc
**chacun** passer le contrôle et faire dépasser le plafond ensemble.

Contrairement au refus de doublon, qui est garanti au niveau de PostgreSQL par
une contrainte d'unicité, le quota cumulé n'a **aucun garde-fou en base**.

**Bornes du dépassement.** Il n'est pas illimité : il est majoré par le nombre
de dépôts réellement concurrents multiplié par la taille d'un fichier. Avec un
plafond de 5 Go et des fichiers de 64 Mo, un dépassement réaliste reste de
l'ordre de quelques centaines de Mo. Le contrôle reste donc utile — il empêche
l'accumulation illimitée — mais il n'est pas exact à l'octet près.

**Correction envisagée — non implémentée.** Deux voies, par ordre de préférence :

1. **Compteur transactionnel** (préféré). Une table `organization_storage_usage`
   portant `(organizationId, usedBytes)` avec une contrainte `CHECK`. Le dépôt
   s'insère dans une transaction qui fait
   `UPDATE … SET used_bytes = used_bytes + $taille WHERE organization_id = $org
   AND used_bytes + $taille <= $quota`, puis teste le nombre de lignes
   affectées. Zéro ligne ⇒ quota dépassé ⇒ annulation. PostgreSQL sérialise
   l'update : la course disparaît sans verrou explicite. Coût : une table, une
   migration, et la nécessité de décrémenter le compteur à toute suppression de
   dépôt — donc un invariant à maintenir entre la table et `geospatial_imports`.

2. **Verrou applicatif par organisation** (plus simple, moins sûr). Un
   `pg_advisory_xact_lock(hashtext(organizationId))` en début de transaction, ou
   un mutex en mémoire. Le verrou PostgreSQL tient sur plusieurs instances ; le
   mutex en mémoire **non** — il ne corrigerait la course que sur un seul
   processus, ce qui serait trompeur en production multi-instances.

La voie 1 est préférée parce qu'elle rend l'invariant vérifiable par la base
elle-même, alors qu'un verrou repose sur la discipline du code appelant.

**Pourquoi ce n'est pas fait maintenant.** La correction 1 ajoute une table, une
migration et un invariant de synchronisation à maintenir ; c'est un changement
de modèle de données, pas un ajustement de module. Il mérite d'être décidé et
testé pour lui-même.

### 5.6 Le quota par organisation n'est pas testé à sa valeur réelle

Le plafond par défaut est de 5 Go. Les tests unitaires le vérifient en
l'abaissant via `definirQuota` ; la recette e2e vérifie que la somme cumulée
augmente et qu'un dépôt sous plafond passe. **Aucun test n'alloue 5 Go** : le
franchissement du plafond réel n'est donc pas observé en e2e.

---

## 6. Fichiers touchés

| Fichier | Rôle |
|---|---|
| `src/shared/fileMagic.js` | **nouveau** — signatures (ZIP marqué faible), assainissement, vérification de type |
| `src/integrations/storage.js` | **nouveau** — interface + pilotes local et objet |
| `src/modules/geospatialImport/` | **nouveau** — service, contrôleur, routes, schéma |
| `src/shared/errors/ApiError.js` | `payloadTooLarge` (413) ajouté |
| `src/config/env.js` · `.env.example` | 4 variables `GEOSPATIAL_*`, dont le quota |
| `src/app.js` | parseur à 100 Mo **sur cette route seule**, précédé de la limite de débit et de l'authentification |
| `src/middleware/auth.js` | `authenticate` rendu idempotent (l'authentification avancée ne doit pas résoudre l'utilisateur deux fois) |
| `src/routes/index.js` | montage |
| `prisma/schema.prisma` + migration | champ `filename`, contrainte d'unicité |
| `scripts/check-model-writes.mjs` | exception `GeospatialImport` retirée (devenue fausse) |

### 6.1 Changements portant sur toute l'API

Deux modifications dépassent ce module. Elles sont **additives** : rien n'est
retiré du contrat existant.

| Fichier | Changement |
|---|---|
| `src/shared/http/errorHandler.js` | champ **`code`** ajouté au corps de toutes les réponses d'erreur (`null` si l'erreur n'en porte pas) |
| `src/middleware/rateLimit.js` | `code` exposé à la racine, comme le reste du contrat — il n'était que dans `errors[0].code` |
| `src/modules/smsDelivery/smsDelivery.routes.js` | 5 réponses de webhook construites à la main : `code` ajouté |
| `scripts/generate-openapi.mjs` | `code` déclaré **requis** dans `ErrorEnvelope` ; réponse 413 documentée |

Le garde-fou est `tests/errorCodeContract.test.mjs` : si une fabrique `ApiError`
cesse de porter un code, ou si `errorHandler` cesse de l'exposer, le test
échoue.
