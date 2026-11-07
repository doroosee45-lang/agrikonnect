"""Orchestrateur : une parcelle → un diagnostic de sol complet et traçable.

Entrées (JSON) :
    {
      "plot": {"id", "areaHa", "geometry", "slopePct", "rainfallMm", "elevationM"},
      "samples":  [{"depthCm", "sand", "silt", "clay", "ph", "organicMatter", "ec",
                    "moisture", "lithology", "bedrock", "measuredAt", "source"}],
      "sensors":  {"moisture": [{"at", "value"}], "temperature": [...]},
      "scenes":   [{"scene": {...}, "bands": {...}}],
      "series":   [{"date", "ndvi"}]                    # série NDVI déjà agrégée
      "imagery":  {"camera": {...}, "drone": {...}},
      "declared": {"clay", "sand", "ph", ...},
      "allowRecommendations": false
    }

Sortie : sol, sous-sol, satellite, capteurs, imagerie, fusion, confiance, limites.
Aucune prescription agronomique : le moteur décrit et explique (CDC S1).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from . import __version__, config, fusion, imagery, sensors, soil, spectral, subsurface, geometry


def _overall_confidence(parts: list[tuple[str, float | None, float]]) -> dict[str, Any]:
    """Moyenne pondérée des confiances disponibles + liste de ce qui manque."""
    available = [(name, value, weight) for name, value, weight in parts if value is not None]
    missing = [name for name, value, _ in parts if value is None]
    if not available:
        return {"score": 0.0, "level": "indéterminée", "components": {}, "missing": missing}
    # Les composantes manquantes gardent leur poids : une donnée absente fait
    # baisser la confiance au lieu d'être redistribuée sur les autres.
    total = sum(weight for _, _, weight in parts)
    score = sum(value * weight for _, value, weight in available) / total
    level = "élevée" if score >= 0.75 else "moyenne" if score >= 0.5 else "faible"
    return {
        "score": round(score, 3),
        "level": level,
        "components": {name: round(value, 3) for name, value, _ in available},
        "missing": missing,
    }


def _soil_observations(samples: list[dict[str, Any]], declared: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Transforme prélèvements et valeurs déclarées en observations fusionnables."""
    observations: list[dict[str, Any]] = []

    for sample in samples:
        source = str(sample.get("source") or "lab")
        measured_at = sample.get("measuredAt")
        for parameter in ("clay", "sand", "silt", "ph", "organicMatter", "ec", "moisture"):
            value = sample.get(parameter)
            if value is None:
                continue
            observations.append({
                "parameter": parameter,
                "value": value,
                "source": source,
                "unit": {"moisture": "vol %", "ec": "dS/m"}.get(parameter),
                "measuredAt": measured_at,
                "quality": float(sample.get("quality", 1.0) or 1.0),
            })

    for parameter, value in (declared or {}).items():
        if value is None or parameter not in {"clay", "sand", "silt", "ph", "organicMatter", "ec", "moisture"}:
            continue
        observations.append({
            "parameter": parameter,
            "value": value,
            "source": "declared",
            "unit": {"moisture": "vol %", "ec": "dS/m"}.get(parameter),
            "quality": 0.6,
        })

    return observations


def analyze_plot(payload: dict[str, Any]) -> dict[str, Any]:
    plot = payload.get("plot") or {}
    samples = payload.get("samples") or []
    declared = payload.get("declared") or {}
    sensor_payload = payload.get("sensors") or {}
    scenes = payload.get("scenes") or []
    imagery_payload = payload.get("imagery") or {}
    allow_recommendations = bool(payload.get("allowRecommendations"))

    caveats: list[str] = []

    # ── 1. Sol : profil de la couche labourée ────────────────────────────────
    profile = soil.build_profile(samples)
    if not profile.get("available") and declared:
        profile = soil.build_profile([{**declared, "source": "declared"}])
        if profile.get("available"):
            caveats.append("Profil de sol établi uniquement sur des valeurs déclarées : non vérifié.")

    texture_class = (profile.get("texture") or {}).get("class")
    erosion = soil.erosion_risk(plot.get("slopePct"), texture_class, plot.get("rainfallMm"))
    limits = soil.constraints(profile, erosion)

    # ── 2. Sous-sol ─────────────────────────────────────────────────────────
    subsoil = subsurface.profile(samples)

    # ── 3. Satellite : scènes + phénologie ──────────────────────────────────
    scene_results: list[dict[str, Any]] = []
    for entry in scenes:
        try:
            scene_results.append(spectral.analyze_scene(entry))
        except Exception as error:  # une scène illisible ne doit pas annuler le diagnostic
            scene_results.append({"error": str(error), "scene": (entry.get("scene") or {}).get("id")})

    latest = next((result for result in reversed(scene_results) if "indices" in result), None)
    series = payload.get("series") or []
    if not series and len(scene_results) >= 4:
        series = [
            {"date": (result.get("scene") or {}).get("capturedAt"), "ndvi": (result["indices"].get("ndvi") or {}).get("mean")}
            for result in scene_results
        ]
    phenology = spectral.phenology(series) if series else {"available": False, "reason": "Aucune série NDVI fournie."}

    # ── 4. Capteurs ─────────────────────────────────────────────────────────
    sensor_results: dict[str, Any] = {}
    for parameter, readings in (sensor_payload.items() if isinstance(sensor_payload, dict) else []):
        unit = "vol %" if parameter == "moisture" else "°C" if parameter == "temperature" else "dS/m"
        depth = float((plot.get("sensorDepthCm") or 30) if parameter == "moisture" else 0)
        sensor_results[parameter] = sensors.quality(readings, unit=unit, depth_cm=depth)

    # ── 5. Imagerie (caméra / drone) ────────────────────────────────────────
    imagery_results: dict[str, Any] = {}
    for kind in ("camera", "drone"):
        entry = imagery_payload.get(kind)
        if entry is None:
            continue
        if not entry:
            imagery_results[kind] = {"available": False, "reason": "Aucune donnée d'imagerie fournie pour cette source."}
            continue
        try:
            imagery_results[kind] = imagery.analyze({**entry, "kind": kind})
        except Exception as error:
            imagery_results[kind] = {"available": False, "reason": str(error)}

    # ── 6. Fusion multi-sources ─────────────────────────────────────────────
    observations = _soil_observations(samples, declared)
    moisture_sensor = sensor_results.get("moisture") or {}
    if moisture_sensor.get("available"):
        observations.append({
            "parameter": "moisture",
            "value": moisture_sensor["mean"],
            "source": "sensor",
            "unit": "vol %",
            "quality": moisture_sensor.get("confidence", 0.8),
            "measuredAt": datetime.now(timezone.utc).isoformat(),
        })
    fused = fusion.fuse(observations)

    # ── 7. Points d'attention et confiance ──────────────────────────────────
    if not samples:
        caveats.append("Aucun prélèvement de sol : le diagnostic repose sur du déclaratif et/ou de la télédétection.")
    if moisture_sensor.get("stuckSensor"):
        caveats.append("Un capteur d'humidité semble bloqué : ses valeurs ne sont pas utilisées pour une décision.")
    if (moisture_sensor.get("drift") or {}).get("detected"):
        caveats.append("Dérive détectée sur le capteur d'humidité : recalibration recommandée avant usage.")
    if latest and latest.get("confidence", 0) < 0.5:
        caveats.append("La scène satellite la plus récente est peu exploitable (nuages/nodata).")

    confidence = _overall_confidence([
        ("sol", 0.9 if samples else (0.45 if declared else None), 0.35),
        ("sous-sol", subsoil.get("confidence"), 0.20),
        ("satellite", (latest or {}).get("confidence"), 0.20),
        ("capteurs", (moisture_sensor or {}).get("confidence"), 0.15),
        ("imagerie", (imagery_results.get("drone") or imagery_results.get("camera") or {}).get("confidence"), 0.10),
    ])

    recommendations: list[dict[str, Any]] = []
    if allow_recommendations:
        recommendations = [
            {
                "code": "VERIFIER_SUR_LE_TERRAIN",
                "label": "Confirmer le diagnostic par un prélèvement de sol",
                "reason": "Toute prescription exige une analyse de laboratoire datée (aucun dosage n'est calculé ici).",
            }
        ] if not samples else []
    else:
        caveats.append("Recommandations désactivées : le moteur ne prescrit rien sans jeu de règles agronomiques validé (CDC S1).")

    return {
        "plotId": plot.get("id"),
        "areaHa": plot.get("areaHa") or (geometry.area_hectares(plot.get("geometry")) if plot.get("geometry") else None),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engine": {"name": "agrikonnect-geoai", "version": __version__},
        "soil": profile,
        "erosion": erosion,
        "constraints": limits,
        "subsoil": subsoil,
        "satellite": {
            "scenesAnalyzed": len(scene_results),
            "latest": latest,
            "phenology": phenology,
            "errors": [result for result in scene_results if "error" in result],
        },
        "sensors": sensor_results,
        "imagery": imagery_results,
        "fusion": fused,
        "confidence": confidence,
        "caveats": caveats,
        "recommendations": recommendations,
        "disclaimer": (
            "Diagnostic indicatif produit à partir des données fournies. "
            "Il ne remplace pas une analyse de laboratoire ni une visite agronomique, "
            "et ne constitue pas une certification."
        ),
    }
