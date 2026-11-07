"""Constantes scientifiques et paramètres de fiabilité.

Toutes les valeurs sont explicites et justifiées : rien n'est appris à la volée,
rien n'est inventé. Les seuils sont ceux de la littérature pédologique et de la
télédétection optique utilisée en Afrique subsaharienne (Sentinel-2, 10 m).
"""

# ─────────────────────────── Fiabilité des sources (CDC §6.5) ───────────────────────────
# Priorité imposée : laboratoire > capteur > satellite > drone > caméra > déclaré.
SOURCE_RELIABILITY = {
    "lab": 0.95,
    "sensor": 0.85,
    "satellite": 0.70,
    "drone": 0.80,
    "camera": 0.55,
    "declared": 0.40,
}

SOURCE_PRIORITY = ["lab", "sensor", "satellite", "drone", "camera", "declared"]

# Demi-vie de fraîcheur (jours) : une mesure ancienne perd de son poids.
FRESHNESS_HALF_LIFE_DAYS = 365.0

# ─────────────────────────── Texture USDA ───────────────────────────
# Groupes hydrologiques (SCS/NRCS) : A drainant → D peu drainant.
HYDROLOGIC_GROUP = {
    "sable": "A",
    "sable limoneux": "A",
    "limon sableux": "B",
    "limon": "B",
    "limon fin": "B",
    "limon argilo-sableux": "C",
    "limon argileux": "C",
    "limon argileux fin": "C",
    "argile sableuse": "D",
    "argile limoneuse": "D",
    "argile": "D",
}

# Réserve utile approximative (mm d'eau par cm de sol) par classe de texture.
WATER_HOLDING_MM_PER_CM = {
    "sable": 0.6,
    "sable limoneux": 0.8,
    "limon sableux": 1.2,
    "limon": 1.6,
    "limon fin": 1.8,
    "limon argilo-sableux": 1.7,
    "limon argileux": 1.9,
    "limon argileux fin": 2.0,
    "argile sableuse": 1.8,
    "argile limoneuse": 1.9,
    "argile": 1.6,
}

# Seuils d'interprétation classiques.
PH_CLASSES = [
    (0.0, 4.5, "extrêmement acide"),
    (4.5, 5.5, "très acide"),
    (5.5, 6.0, "acide"),
    (6.0, 6.8, "légèrement acide"),
    (6.8, 7.4, "neutre"),
    (7.4, 8.2, "légèrement alcalin"),
    (8.2, 9.0, "alcalin"),
    (9.0, 14.0, "très alcalin"),
]

ORGANIC_MATTER_CLASSES = [
    (0.0, 1.0, "très faible"),
    (1.0, 2.0, "faible"),
    (2.0, 3.0, "moyenne"),
    (3.0, 5.0, "bonne"),
    (5.0, 100.0, "très bonne"),
]

# Conductivité électrique (dS/m, extrait 1:5) → salinité.
SALINITY_CLASSES = [
    (0.0, 0.2, "non salé"),
    (0.2, 0.4, "très légèrement salé"),
    (0.4, 0.8, "légèrement salé"),
    (0.8, 1.6, "modérément salé"),
    (1.6, 100.0, "fortement salé"),
]

# ─────────────────────────── Télédétection ───────────────────────────
# Classes Sentinel-2 L2A considérées comme non fiables (nuages, ombres, neige).
S2_INVALID_SCL = {0, 1, 3, 8, 9, 10, 11}

NDVI_SOIL_CEILING = 0.25  # en dessous : sol nu dominant
NDVI_VEGETATION_FLOOR = 0.45  # au-dessus : végétation établie
NDVI_SOS_THRESHOLD = 0.20  # seuil de démarrage de saison (SOS)

# ─────────────────────────── Capteurs ───────────────────────────
MAD_Z_LIMIT = 3.5  # détection d'aberration robuste
STUCK_MIN_POINTS = 5
STUCK_EPSILON = 1e-6
GAP_FACTOR = 2.5  # un trou = intervalle > 2,5 × intervalle médian

# ─────────────────────────── Imagerie ───────────────────────────
EXG_SOIL_THRESHOLD = 0.02  # Excès de vert normalisé sous lequel = sol nu
MIN_PIXELS_FOR_CONFIDENCE = 2500  # ~50×50 px : en dessous, confiance réduite

# ─────────────────────────── Fusion ───────────────────────────
# Écart relatif au-delà duquel deux sources sont jugées incompatibles.
CONFLICT_RELATIVE_TOLERANCE = {
    "clay": 0.35,
    "sand": 0.35,
    "silt": 0.35,
    "ph": 0.20,
    "organicMatter": 0.50,
    "moisture": 0.60,
    "ec": 0.60,
    "default": 0.40,
}

# Profondeur d'enracinement prise en compte pour la réserve utile (cm).
ROOT_ZONE_CM = 30
SUB_SOIL_BOTTOM_CM = 100
