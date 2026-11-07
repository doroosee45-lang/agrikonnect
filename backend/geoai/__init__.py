"""AGRIKONNECT AFRICA — moteur géospatial et pédologique (Python).

Le backend Node/Express reste le propriétaire des données (Postgres/Supabase) et
des règles d'autorisation. Ce service Python fait uniquement le **calcul
scientifique** impossible à exprimer proprement en JavaScript :

  * indices spectraux et phénologie sur scènes satellite (Sentinel-2, Landsat) ;
  * classification de texture USDA, groupe hydrologique, risques (érosion,
    drainage, salinité) à partir d'analyses de sol ;
  * reconstitution du **sous-sol** (horizons, profondeur du substratum) par
    interpolation de prélèvements à la tarière / carottage ;
  * contrôle qualité de séries de **capteurs** (valeurs aberrantes, capteur
    bloqué, dérive, trous) et conversion humidité → millimètres d'eau ;
  * analyse d'**images** (caméra de parcelle, drone) : couverture végétale,
    sol nu, indices de végétation RGB, texture ;
  * **fusion** multi-sources avec priorités explicites (laboratoire > capteur >
    satellite > drone > caméra > déclaré) et détection de conflits.

Aucune recommandation agronomique n'est produite sans jeu de règles validé :
le moteur décrit, il ne prescrit pas (CDC S1 / SOIL-04).
"""

__version__ = "1.0.0"

from .engine import analyze_plot  # noqa: F401

__all__ = ["analyze_plot", "__version__"]
