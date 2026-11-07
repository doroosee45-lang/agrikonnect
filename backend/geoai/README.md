# AGRIKONNECT — moteur géospatial et pédologique (Python)

Service de calcul **scientifique** appelé par l'API Node. Il ne lit jamais la
base : le backend lui envoie un JSON, il renvoie un diagnostic traçable.

```bash
pip install -r geoai/requirements.txt
python3 geoai/server.py            # http://0.0.0.0:8100 (GEOAI_PORT)
python3 -m unittest discover -s geoai/tests -t .   # 70 tests
```

## Ce qui est réellement calculé

| Source | Module | Sorties |
|---|---|---|
| **Satellite** (Sentinel‑2 L2A) | `spectral.py` | NDVI, NDWI, NDMI, SAVI, MSAVI, BSI, GNDVI ; masque SCL/nuages ; statistiques zonales (moyenne, médiane, P10, P90, part de pixels valides) ; phénologie (démarrage de saison, pic, fin, tendance, anomalie z) |
| **Sol** (analyses) | `soil.py` | texture USDA (12 classes) depuis sable/limon/argile, groupe hydrologique, réserve utile, classes pH / matière organique / salinité, risque d'érosion à 3 facteurs expliqués, liste de contraintes hiérarchisées |
| **Sous‑sol** (tarière, carottage) | `subsurface.py` | segmentation d'horizons sur ruptures mesurées (argile ≥ 8 pts, MO × 1,8, pH ≥ 0,8, lithologie), décroissance exponentielle de la MO `OM(z)=OM₀·e^(−kz)` avec R², profondeur du substratum (ou « inconnue »), confiance selon la profondeur couverte |
| **Capteurs** | `sensors.py` | aberrations MAD (|z|>3,5), capteur bloqué (≥5 points identiques), trous (>2,5 × intervalle médian), dérive (tendance > 3σ du résidu **et** >10 % de la valeur), conversion humidité volumique → **mm d'eau** sur l'épaisseur prospectée |
| **Caméra / drone** | `imagery.py` | ExG, VARI, GLI, seuil d'Otsu, part de végétation et de sol nu, entropie/contours (texture), ombres ; drone : CHM → hauteur moyenne, P90, couverture, installation du peuplement |
| **Fusion** | `fusion.py` | priorité **laboratoire > capteur > satellite > drone > caméra > déclaré**, poids = fiabilité × qualité × fraîcheur (demi‑vie 365 j), intervalle d'incertitude, alternatives, **conflits** entre sources signalés, déclassement d'une source fiable mais périmée pour les grandeurs dynamiques (humidité, EC, température) |
| **Parcelle** | `geometry.py` | surface géodésique, centroïde pondéré, test point‑dans‑polygone (ray casting), masque raster de la parcelle |

## API HTTP

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/health` | disponibilité + version |
| GET | `/v1/meta` | seuils, ordre de priorité des sources, liste des endpoints |
| POST | `/v1/soil/analyze` | diagnostic complet d'une parcelle (orchestrateur `engine.py`) |
| POST | `/v1/soil/texture` | texture USDA + groupe hydrologique |
| POST | `/v1/subsurface/profile` | horizons + substratum |
| POST | `/v1/spectral/indices` | indices + statistiques zonales d'une scène |
| POST | `/v1/spectral/phenology` | phénologie d'une série NDVI |
| POST | `/v1/sensors/quality` | contrôle qualité d'une série de capteur |
| POST | `/v1/imagery/analyze` | photo (caméra) ou produit drone |
| POST | `/v1/fusion` | fusion d'observations multi‑sources |

Erreurs : `422 invalid_payload` / `missing_field` (payload refusé), `404`, `500`.
Si `GEOAI_TOKEN` est défini, l'en‑tête `X-GeoAI-Token` est obligatoire.

## Principes non négociables

1. **Aucune donnée inventée** : sans prélèvement, le sous‑sol est déclaré
   « inconnu » ; sans série suffisante (< 4 points), la phénologie est
   « non déterminable » ; une bande absente désactive l'indice correspondant.
2. **Chaque valeur porte sa provenance** (`lab`, `sensor`, `satellite`,
   `drone`, `camera`, `declared`) et sa confiance.
3. **Aucune prescription** : `recommendations` reste vide sauf demande explicite ;
   le CDC S1 réserve les recommandations à un jeu de règles agronomiques validé.
4. **Toujours la mise en garde** : « ne remplace pas une analyse de laboratoire,
   ne constitue pas une certification ».
