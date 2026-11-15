# Audit approfondi du système géospatial — Backend AGRIKONNECT AFRICA

Périmètre : stockage et calculs géographiques côté Node (`src/shared/geo.js`, exploitations, parcelles, carte publique), modules géospatiaux (`geospatial/`, `geospatialImport/`, `geodata/`, `satellite/`, `anomalies/`, `forecast/`, `precision/`), intégrations (`integrations/geospatial.js`, `satellite.js`, `storage.js`, `s3.js`) et moteur Python `backend/geoai/`.

---

## 1. Architecture géospatiale réelle

```
                ┌─────────────────────────── API Node (Express) ───────────────────────────┐
 Client ──────► │ farms / plots  ──► shared/geo.js (centroïde, surface, arrondi, bbox)      │
                │ public/map     ──► bbox sur publicLatitude/publicLongitude (B-tree)       │
                │ geospatial/*   ──► integrations/geospatial.js ──HTTP JSON──┐              │
                │ interpolations ──► lectures capteurs (≤ 5 000) ────────────┤              │
                │ satellite      ──► integrations/satellite.js (simulated par défaut)       │
                │ geospatial/imports ──► fileMagic + storage (local | Supabase | S3)         │
                └────────────────────────────────────────────────────────────┼──────────────┘
                                                                             ▼
                                         geoai/server.py (ThreadingHTTPServer, :8100)
                                         numpy/scipy/Pillow : sol, spectral, imagerie,
                                         fusion, sous-sol GPR, krigeage, prévision
```

| Aspect | Implémentation | Preuve |
|---|---|---|
| SGBD | PostgreSQL **sans PostGIS** | aucune occurrence `postgis`, `geometry(`, `geography`, `GIST` dans `prisma/migrations` |
| Géométrie des parcelles | GeoJSON `Json` (`Plot.geometry`) + `geometryType` (`POINT`/`POLYGON`) | `schema.prisma:437-443` |
| Position des exploitations | `latitude`/`longitude` exacts (privés) + `publicLatitude`/`publicLongitude` arrondis + `location` GeoJSON | `schema.prisma:378-384` |
| Index | B-tree composite `(latitude, longitude)` sur `farms`, `plots`, `listings` | `schema.prisma:415, 474, 1027` |
| Requêtes spatiales | Filtre rectangulaire (bbox) uniquement | `public.service.js:192-212` |
| Système de coordonnées | WGS84 implicite (lng, lat) ; aucune gestion de CRS | `geo.js:10-13` |
| Calculs | Node : moyennes et Shoelace équirectangulaire ; Python : centroïde pondéré, masques, krigeage | `geo.js`, `geoai/geometry.py`, `geoai/interpolation.py` |

**Choix documenté** : `backend/README.md` assume l'abandon de MongoDB `2dsphere` au profit de Postgres + bbox. Ce choix est acceptable pour un volume modéré, mais il exclut toute requête topologique (intersection, inclusion, chevauchement, distance réelle indexée).

---

## 2. Validation des géométries

### 2.1 Parcelles (`plots.schema.js`, `plots.service.js`)

| Contrôle | État | Détail |
|---|---|---|
| Types acceptés | `Point`, `Polygon` | `MultiPolygon` (parcelles discontinues) refusé |
| Bornes des sommets de polygone | ✅ Zod `[-180,180]` / `[-90,90]` | `plots.schema.js:4` |
| Bornes du Point | ⚠️ non bornées par Zod | rattrapé par `isValidCoordinate` dans `geometryBounds` (`plots.service.js:63-65`) |
| Nombre minimal de sommets | ✅ 4 | |
| Nombre maximal de sommets | ❌ aucun | un polygone de plusieurs centaines de milliers de sommets reste sous la limite JSON de 1 Mo |
| Fermeture de l'anneau (premier = dernier) | ❌ non vérifiée | |
| Auto-intersection, orientation, anneaux intérieurs | ❌ non vérifiés | |
| Trous (anneaux intérieurs) | Acceptés mais **ignorés** dans la surface | `geo.js:51-71` |
| Surface déclarée vs calculée | ⚠️ la valeur déclarée (`areaHa`) **prime** sur le calcul | `plots.service.js:131` |
| Parcelle dans l'exploitation / chevauchement entre parcelles | ❌ non vérifié | impossible sans PostGIS |
| Point dans le pays déclaré (PLOT-05) | ❌ **inactif** | `assertPointInCountry` (`plots.service.js:29-52`) lit `country.complianceProfile.bounds`, que le seed ne renseigne pas (`prisma/seed.js:30-34`) → `checked: false` systématique |
| Contrôle pays sur tout le polygone | ❌ centroïde seulement, et seulement contre un rectangle | |

### 2.2 Exploitations (`farms.schema.js`, `farms.service.js`)

- Latitude/longitude bornées par Zod (`farms.schema.js:4-5`).
- Test de cohérence fragile : `if ((data.latitude && !isValidCoordinate(...)) || …)` (`farms.service.js:120`) — une latitude `0` (équateur, pertinente pour la RDC : Mbandaka, Équateur) est évaluée comme « absente » ; une latitude fournie sans longitude n'est pas rejetée explicitement.

### 2.3 Synchronisation hors-ligne

`POST /sync/push` collection `plots` écrit `geometry`, `latitude`, `longitude`, `areaHa` **sans aucune** des validations ci-dessus (`sync.service.js:224, 255`) → géométries invalides, centroïdes incohérents avec la géométrie, contournement du contrôle pays. Voir constat C-04 du rapport principal.

---

## 3. Exactitude des calculs

| Fonction | Méthode | Défaut | Impact |
|---|---|---|---|
| `centroidOf` (`geo.js:16-34`) | Moyenne arithmétique des sommets de l'anneau | Le sommet de fermeture (identique au premier) est compté deux fois ; la moyenne des sommets ≠ centroïde géométrique (biais vers les zones à forte densité de sommets) | Le `latitude/longitude` des parcelles — utilisé pour les filtres bbox, la météo, le satellite et le contrôle pays — peut s'écarter du vrai centre, voire tomber **hors** d'un polygone concave |
| `geoai/geometry.py:32-52` | Centroïde pondéré par l'aire (formule correcte) | — | **Incohérence Node ↔ Python** : deux centroïdes différents pour la même parcelle |
| `polygonAreaHa` (`geo.js:51-71`) | Shoelace sur projection équirectangulaire locale | Approximation acceptable pour des parcelles de quelques km² ; ignore les trous ; `null` pour MultiPolygon | Surface surestimée pour les parcelles à enclaves |
| `distanceKm` (`geo.js:95-107`) | Haversine, **arrondi au km entier** | Perte de précision pour des distances courtes (< 1 km → 0) | Recherches par rayon et transport imprécis à courte distance |
| `parseBbox` (`geo.js:74-81`) | Contrôle de forme et d'ordre | Pas de contrôle de plage (lat > 90 acceptée), pas de plafond d'emprise, antiméridien non géré | Requête « monde entier » possible (bornée à 500 résultats) |
| `approximate` (`geo.js:40-44`) | Arrondi à `PUBLIC_COORD_DECIMALS` (2 par défaut ≈ 1,1 km) | Arrondi déterministe : pour un point isolé en zone rurale, 1,1 km peut suffire à identifier la ferme ; pas de bruit ni de regroupement | Protection de la vie privée limitée |

---

## 4. Confidentialité de la localisation

| Mécanisme | État | Preuve |
|---|---|---|
| Coordonnées exactes jamais exposées sur la carte publique | ✅ double arrondi | `public.service.js:232-240` |
| Mode `exact` choisi par le producteur | ⚠️ incohérent : exposé exactement par `GET /public/farms/:slug` (`public.service.js:56-60`) mais arrondi sur `/public/map` | comportement différent selon la route |
| Mode `private` | ❌ **fuite** : les anciennes `publicLatitude/publicLongitude` ne sont pas effacées lors du passage en privé (`farms.service.js:191`) et restent servies par `/public/map` et `/public/farms/:slug` | Constat **H-06** |
| Géométrie des parcelles | ✅ jamais servie publiquement | aucune route publique ne sélectionne `Plot.geometry` |
| Statistiques de sol publiques | ✅ k-anonymat par pays (`K_ANONYMITY`) | `public.service.js:345-370` |
| Événements de lot publics (QR) | ⚠️ `LotEvent.location` falsifiable inter-tenant via `/sync/push` | Constat **C-04** |
| Divulgation d'infrastructure | ⚠️ `GET /geospatial/health` renvoie l'URL interne du moteur | `integrations/geospatial.js:129,133` |

---

## 5. Moteur Python `geoai/`

### 5.1 Qualité

- Modules séparés et testés (`geoai/tests/`, 7 fichiers, ~1 450 lignes de tests) : sol, spectral, imagerie, fusion, sous-sol, interpolation, prévision.
- Bonne hygiène scientifique : rejets de points motivés (`_clean_points`), seuils minimaux (`MIN_POINTS=3`, `MIN_SPREAD_M=5`, `MIN_VARIOGRAM_PAIRS=3`), plafond de grille `MAX_CELLS = 20 000`, validation croisée leave-one-out du krigeage, provenance (`methodVersion`) renvoyée.
- Dépendances minimales et bornées (`numpy`, `scipy`, `Pillow`).

### 5.2 Sécurité et exploitation

| Constat | Preuve | Risque | Recommandation |
|---|---|---|---|
| Écoute sur toutes les interfaces par défaut | `server.py:219, 227` (`0.0.0.0`) | Moteur joignable depuis le réseau si le port n'est pas filtré | `127.0.0.1` par défaut |
| Jeton partagé **optionnel** | `server.py:37, 155-157` (`if not TOKEN: return True`) ; `GEOAI_TOKEN` vide dans `.env.example` | Appels directs non authentifiés | Obligatoire hors développement, refus au démarrage sinon |
| Comparaison du jeton non constante | `server.py:158` (`==`) | Attaque temporelle (théorique) | `hmac.compare_digest` |
| Corps max 12 Mo, `ThreadingHTTPServer` sans limite de threads | `server.py:36, 220` | Saturation CPU/mémoire par requêtes parallèles | Serveur WSGI/ASGI avec pool borné, ou file de travaux |
| Krigeage résolu **par cellule** (système n×n par élimination de Gauss en Python pur) | `interpolation.py:296-327, 606` | Coût O(cellules × n³) : jusqu'à 20 000 résolutions ; le délai Node (20 s) abandonne la requête mais le thread Python **continue** de calculer | Factoriser la matrice une fois (`scipy.linalg.lu_factor`) et réutiliser ; vectoriser ; plafond de points |
| Routes de calcul sans quota | `geospatial.routes.js:223-272` (pas de `writeLimiter`, pas de compteur) | Épuisement du moteur par un seul compte | Quota par organisation (`resource_usage`) |

### 5.3 Client Node (`integrations/geospatial.js`)

- Délai, reprise bornée (≤ 3), distinction 422 / 401-403 / 5xx : **correct**.
- Les variables sont relues dans `process.env` à chaque appel en plus de `env` validé (`:6-16`) : double source de configuration.
- Reprise automatique sur erreur réseau : acceptable car le moteur est sans état (« idempotent » documenté).

---

## 6. Imports de fichiers géospatiaux (`geospatialImport/`)

C'est la partie **la mieux conçue** du backend sur le plan sécurité :

| Contrôle | État | Preuve |
|---|---|---|
| Ordre limite de débit → authentification → lecture du corps | ✅ | `app.js` (`gardeDepot`, `gardeDepotMultipart`) |
| Plafonds de taille dédiés (base64 100 Mo, multipart 64 Mo) | ✅ configurables | `env.js:81-83` |
| Vérification des octets magiques et assainissement du nom | ✅ | `shared/fileMagic.js` |
| Clé de stockage construite côté serveur (organisation/type/id) | ✅ | `geospatialImport.service.js:336` |
| Garde anti-traversée de répertoire (stockage local) | ✅ | `integrations/storage.js:71-72` |
| Empreinte SHA-256 et refus des doublons par organisation | ✅ | `geospatialImport.service.js:247-266` + index unique |
| Quota par organisation, transactionnel | ✅ | `geospatialImport.service.js:301-370` |
| Parcelle/appareil rattachés vérifiés dans le tenant | ✅ | `:270, :287` |

Réserves :
- Le fichier est entièrement **bufferisé en mémoire** (base64 → +33 %, puis décodage) : avec 30 dépôts/min autorisés par IP en production, la pression mémoire reste possible.
- `quotaOctets` est une variable de module modifiable à chaud (`:106-116`, crochet de test) : à isoler des chemins de production.
- Le traitement (`geospatialProcessing.service.js`) relit l'import par `findUnique({ where: { id } })` sans filtre tenant (`:91, 106, 113, 136`) ; l'appelant le filtre en amont — à garder sous test.

---

## 7. Satellite, capteurs, anomalies

| Module | Constat |
|---|---|
| Satellite (`integrations/satellite.js`) | Fournisseur `simulated` par défaut (`env.js:321`), marqué `mode: 'SIMULATED'` ; `dataMode.js` interdit l'écriture de valeurs simulées en production — **correct**. Acquisition programmée désactivée par défaut (`SATELLITE_ACQUISITION_ENABLED=false`). Rejet nuageux paramétrable (40 %). |
| Capteurs IoT (`iot/`) | Ingestion par clé d'appareil hachée (SHA-256), lots ≤ 500 mesures, mode `REAL/CONFIGURATION/SIMULATED` déclaré par l'appareil (à contraindre côté serveur selon l'état de l'appareil). |
| Anomalies | Détection désactivée par défaut (`ANOMALY_DETECTION_ENABLED=false`) ; revue réservée à `AGRONOMIST`/admin — mais `AGRONOMIST` est obtenable librement (H-01) : un compte anonyme peut réhabiliter des mesures écartées. |
| Interpolation | Lit jusqu'à 5 000 mesures (`interpolation.service.js:35, 64`) ; fusion des points coïncidents (< 1 m) côté Python. |
| Laboratoire (`geodata/`) | Saisie de résultats inopérante (F-03). |

---

## 8. Performance et scalabilité spatiales

- Filtre bbox sur index B-tree composite `(lat, lng)` : seul le premier attribut est exploité efficacement pour une plage ; acceptable jusqu'à quelques centaines de milliers de lignes, dégradé au-delà.
- Pas de tuilage, pas de clustering côté serveur pour la carte publique (plafond 500 points).
- `soil-stats` publiques : toutes les analyses chargées en mémoire (`public.service.js:346`).
- Krigeage : voir §5.2.

---

## 9. Feuille de route géospatiale recommandée

| Priorité | Action | Constats couverts |
|---|---|---|
| P0 | Effacer `publicLatitude/Longitude` en mode privé + reprise des données | H-06 |
| P0 | Valider géométries et tenant dans `/sync/push` (réutiliser `plots.service`) | C-04 |
| P1 | Moteur GeoAI : écoute locale, jeton obligatoire, `compare_digest`, retrait de l'URL dans `/health`, quota | M-09 |
| P1 | Renseigner les emprises pays (idéalement polygones administratifs) et contrôler tous les sommets | F-04 |
| P2 | Corriger `centroidOf` (centroïde pondéré, sans double comptage du sommet de fermeture) et aligner sur `geoai/geometry.py` ; recalcul des centroïdes existants | §3 |
| P2 | Valider les polygones : fermeture, nombre max de sommets (ex. 5 000), auto-intersection, orientation ; supporter `MultiPolygon` | §2.1 |
| P2 | Comparer surface déclarée et calculée (alerte au-delà d'un écart, ex. 20 %) | §2.1 |
| P2 | `parseBbox` : bornes et plafond d'emprise ; `distanceKm` en mètres ou à 0,1 km | §3 |
| P3 | Activer **PostGIS** (disponible nativement sur Supabase) : colonnes `geography(Polygon,4326)`/`geography(Point,4326)`, index GIST, `ST_IsValid`, `ST_Within` (parcelle dans pays/exploitation), `ST_Intersects` (chevauchements), `ST_DWithin` (rayons) | §1, §2, §8 |
| P3 | Krigeage : factorisation unique, vectorisation numpy, file de travaux asynchrone | §5.2 |
| P3 | Confidentialité : arrondi + décalage aléatoire stable par exploitation (« jitter ») ou agrégation en grille pour les zones peu denses | §3 |

---

## 10. Conclusion

Le système géospatial est **fonctionnel et prudent dans son discours** (provenance, données simulées refusées en production, imports durcis), mais repose sur des primitives géométriques approximatives sans moteur spatial, avec des contrôles de cohérence annoncés mais inactifs (pays) ou absents (topologie). Les deux défauts à traiter avant production sont la **fuite de position en mode privé** (H-06) et la **porte dérobée géométrique et tenant de la synchronisation** (C-04).
