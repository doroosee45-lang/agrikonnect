"""Reconstitution du sous-sol à partir de prélèvements (tarière, carottage, fosse).

Le sous-sol n'est jamais « deviné » : le moteur décrit ce que les prélèvements
montrent, segmente les horizons sur des changements mesurés, ajuste la décroissance
de la matière organique (modèle exponentiel de Jenny) et signale explicitement
toute profondeur extrapolée.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from . import config
from .soil import classify_texture

# Seuils de segmentation : un horizon change quand la texture ou la matière
# organique varient au-delà de ces écarts (valeurs pédologiques usuelles).
CLAY_JUMP_POINTS = 8.0
ORGANIC_RATIO_JUMP = 1.8
PH_JUMP = 0.8


def _normalise(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for sample in samples:
        depth = sample.get("depthCm", sample.get("topCm"))
        if depth is None:
            continue
        record = dict(sample)
        record["depthCm"] = float(depth)
        record["thicknessCm"] = float(sample.get("thicknessCm") or 20.0)
        cleaned.append(record)
    cleaned.sort(key=lambda item: item["depthCm"])
    return cleaned


def _is_bedrock(sample: dict[str, Any]) -> bool:
    lithology = str(sample.get("lithology") or "").lower()
    return bool(sample.get("bedrock")) or lithology in {"roche", "bedrock", "roche mère", "roche-mere", "cuirasse"}


def _horizon_label(index: int, sample: dict[str, Any]) -> str:
    if _is_bedrock(sample):
        return "R"
    organic = sample.get("organicMatter")
    clay = sample.get("clay") or 0.0
    if index == 0:
        return "A" if (organic is None or organic >= 1.0) else "Ap"
    if clay >= 35:
        return "Bt"
    return "B" if index == 1 else "C"


def segment_horizons(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Segmente les prélèvements en horizons sur des ruptures mesurées."""
    ordered = _normalise(samples)
    if not ordered:
        return []

    groups: list[list[dict[str, Any]]] = [[ordered[0]]]
    for sample in ordered[1:]:
        previous = groups[-1][-1]
        new_horizon = False

        if _is_bedrock(sample) or _is_bedrock(previous):
            new_horizon = True
        if abs(float(sample.get("clay") or 0) - float(previous.get("clay") or 0)) >= CLAY_JUMP_POINTS:
            new_horizon = True
        previous_om = previous.get("organicMatter")
        current_om = sample.get("organicMatter")
        if previous_om and current_om:
            ratio = max(previous_om, current_om) / max(min(previous_om, current_om), 1e-6)
            if ratio >= ORGANIC_RATIO_JUMP:
                new_horizon = True
        if abs(float(sample.get("ph") or 0) - float(previous.get("ph") or 0)) >= PH_JUMP:
            new_horizon = True
        if sample.get("lithology") and previous.get("lithology") and sample["lithology"] != previous["lithology"]:
            new_horizon = True

        if new_horizon:
            groups.append([sample])
        else:
            groups[-1].append(sample)

    horizons: list[dict[str, Any]] = []
    for index, group in enumerate(groups):
        top = group[0]["depthCm"]
        if _is_bedrock(group[0]):
            bottom = top
        else:
            bottom = max(item["depthCm"] + item["thicknessCm"] for item in group)

        clay = float(np.mean([item.get("clay") or 0 for item in group])) if any(item.get("clay") is not None for item in group) else None
        sand_values = [item.get("sand") for item in group if item.get("sand") is not None]
        silt_values = [item.get("silt") for item in group if item.get("silt") is not None]
        sand = float(np.mean(sand_values)) if sand_values else None
        silt = float(np.mean(silt_values)) if silt_values else None
        if silt is None and sand is not None and clay is not None:
            silt = max(0.0, 100.0 - sand - clay)

        texture = None
        if not _is_bedrock(group[0]) and sand is not None and silt is not None and clay is not None and (sand + silt + clay) > 0:
            texture = classify_texture(sand, silt, clay)["class"]

        organic = [item.get("organicMatter") for item in group if item.get("organicMatter") is not None]
        ph_values = [item.get("ph") for item in group if item.get("ph") is not None]

        horizons.append({
            "label": _horizon_label(index, group[0]),
            "topCm": round(top, 1),
            "bottomCm": round(bottom, 1) if not _is_bedrock(group[0]) else None,
            "texture": texture,
            "clay": round(clay, 1) if clay is not None else None,
            "sand": round(sand, 1) if sand is not None else None,
            "silt": round(silt, 1) if silt is not None else None,
            "organicMatter": round(float(np.mean(organic)), 2) if organic else None,
            "ph": round(float(np.mean(ph_values)), 2) if ph_values else None,
            "isBedrock": _is_bedrock(group[0]),
            "samples": len(group),
            "source": "lab",
        })
    return horizons


def organic_matter_decay(samples: list[dict[str, Any]]) -> dict[str, Any]:
    """Ajuste OM(z) = OM0 · e^(−k·z) : la matière organique décroît avec la profondeur."""
    points = [
        (float(sample["depthCm"]), float(sample["organicMatter"]))
        for sample in _normalise(samples)
        if sample.get("organicMatter") and float(sample["organicMatter"]) > 0
    ]
    if len(points) < 3:
        return {"available": False, "reason": "Moins de 3 mesures de matière organique : décroissance non estimable."}

    depths = np.array([point[0] for point in points])
    organic = np.array([point[1] for point in points])
    slope, intercept = np.polyfit(depths, np.log(organic), 1)
    fitted = np.exp(intercept + slope * depths)
    ss_res = float(np.sum((organic - fitted) ** 2))
    ss_tot = float(np.sum((organic - organic.mean()) ** 2))
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "available": True,
        "surfaceOrganicMatter": round(float(np.exp(intercept)), 3),
        "decayPerCm": round(float(-slope), 5),
        "halfLifeCm": round(float(np.log(2) / -slope), 1) if slope < 0 else None,
        "rSquared": round(r_squared, 3),
        "method": "Régression log-linéaire OM(z) = OM₀·e^(−k·z) sur les prélèvements datés en profondeur.",
        "source": "lab",
    }


def depth_to_bedrock(samples: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = _normalise(samples)
    for sample in ordered:
        if _is_bedrock(sample):
            return {
                "valueCm": round(float(sample["depthCm"]), 1),
                "confident": True,
                "extrapolated": False,
                "source": "lab",
                "reason": f"Roche rencontrée à {sample['depthCm']:.0f} cm.",
            }
    deepest = ordered[-1]["depthCm"] + ordered[-1]["thicknessCm"] if ordered else 0
    return {
        "valueCm": None,
        "confident": False,
        "extrapolated": False,
        "reason": f"Aucune roche atteinte jusqu'à {deepest:.0f} cm : profondeur inconnue sous ce niveau.",
        "searchedDepthCm": round(deepest, 1),
        "source": "lab",
    }


def profile(samples: list[dict[str, Any]]) -> dict[str, Any]:
    """Profil de sous-sol complet : horizons, décroissance, substratum, confiance."""
    ordered = _normalise(samples)
    horizons = segment_horizons(samples)
    bedrock = depth_to_bedrock(samples)

    if not ordered:
        return {
            "available": False,
            "reason": "Aucun prélèvement de sol fourni : le sous-sol ne peut pas être décrit.",
            "horizons": [],
        }

    deepest = ordered[-1]["depthCm"] + (0.0 if _is_bedrock(ordered[-1]) else ordered[-1]["thicknessCm"])
    coverage = min(1.0, deepest / config.SUB_SOIL_BOTTOM_CM)
    sample_factor = min(1.0, len(ordered) / 5)
    confidence = round(0.55 * coverage + 0.45 * sample_factor, 3)

    root_zone = [horizon for horizon in horizons if horizon["topCm"] < config.ROOT_ZONE_CM]
    sub_soil = [horizon for horizon in horizons if horizon["topCm"] >= config.ROOT_ZONE_CM]

    caveats: list[str] = []
    if deepest < config.SUB_SOIL_BOTTOM_CM:
        caveats.append(
            f"Prélèvements arrêtés à {deepest:.0f} cm : le sous-sol profond n'est pas décrit (aucune extrapolation présentée comme mesure)."
        )
    if not bedrock["confident"]:
        caveats.append("Profondeur du substratum inconnue : un carottage plus profond est nécessaire.")

    return {
        "available": True,
        "samplesUsed": len(ordered),
        "depthCoveredCm": round(float(deepest), 1),
        "horizons": horizons,
        "rootZone": {"depthCm": config.ROOT_ZONE_CM, "horizons": [h["label"] for h in root_zone]},
        "subSoil": {"depthCm": config.SUB_SOIL_BOTTOM_CM, "horizons": [h["label"] for h in sub_soil]},
        "organicMatterDecay": organic_matter_decay(samples),
        "depthToBedrock": bedrock,
        "confidence": confidence,
        "caveats": caveats,
        "method": "Segmentation d'horizons sur ruptures (argile ≥ 8 pts, MO × 1,8, pH ≥ 0,8, lithologie) + ajustement exponentiel de la MO.",
    }
