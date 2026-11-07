"""Télédétection optique : indices spectraux, masque de nuages, phénologie.

Fonctionne avec les bandes brutes d'une scène (Sentinel-2 L2A, Landsat 8/9) ou
avec des pixels déjà extraits. Toute valeur renvoyée porte sa méthode, sa
résolution et la part de pixels réellement exploitables — un indice calculé sur
10 % de pixels valides n'est pas présenté comme une vérité.
"""
from __future__ import annotations

import math
from typing import Any, Iterable

import numpy as np

from . import config
from .geometry import polygon_mask

NODATA = (-9999.0, -32768.0)


def _array(values: Any) -> np.ndarray:
    array = np.asarray(values, dtype=np.float64)
    for nodata in NODATA:
        array = np.where(array == nodata, np.nan, array)
    array = np.where(np.abs(array) > 100000, np.nan, array)
    return array


def _safe_ratio(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = np.divide(numerator, denominator, out=np.full_like(numerator, np.nan, dtype=np.float64), where=denominator != 0)
    return ratio


def ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """(NIR − R) / (NIR + R) — vigueur végétale, saturée au-delà de NDVI 0,8."""
    return _safe_ratio(nir - red, nir + red)


def ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """(G − NIR) / (G + NIR) — eau libre et humidité de surface."""
    return _safe_ratio(green - nir, green + nir)


def ndmi(nir: np.ndarray, swir: np.ndarray) -> np.ndarray:
    """(NIR − SWIR) / (NIR + SWIR) — teneur en eau de la végétation."""
    return _safe_ratio(nir - swir, nir + swir)


def savi(nir: np.ndarray, red: np.ndarray, factor: float = 0.5) -> np.ndarray:
    """Soil Adjusted Vegetation Index — moins sensible au sol nu que le NDVI."""
    return _safe_ratio((nir - red) * (1 + factor), nir + red + factor)


def msavi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """Modified SAVI — utile en couvert partiel (stades jeunes)."""
    inner = (2 * nir + 1) ** 2 - 8 * (nir - red)
    return _safe_ratio(2 * nir + 1 - np.sqrt(np.maximum(inner, 0)), 2)


def bsi(swir: np.ndarray, red: np.ndarray, nir: np.ndarray, blue: np.ndarray) -> np.ndarray:
    """Bare Soil Index — plus la valeur est haute, plus le sol est à nu."""
    return _safe_ratio((swir + red) - (nir + blue), (swir + red) + (nir + blue))


def gndvi(nir: np.ndarray, green: np.ndarray) -> np.ndarray:
    """Green NDVI — plus sensible à la teneur en chlorophylle/azote foliaire."""
    return _safe_ratio(nir - green, nir + green)


INDEX_METHODS = {
    "ndvi": "NDVI = (B8 − B4) / (B8 + B4), Sentinel-2 L2A, 10 m",
    "ndwi": "NDWI = (B3 − B8) / (B3 + B8), Sentinel-2 L2A, 10 m",
    "ndmi": "NDMI = (B8 − B11) / (B8 + B11), Sentinel-2 L2A, 20 m rééchantillonné",
    "savi": "SAVI = 1,5 × (B8 − B4) / (B8 + B4 + 0,5)",
    "msavi": "MSAVI2 = (2·B8 + 1 − √((2·B8 + 1)² − 8·(B8 − B4))) / 2",
    "bsi": "BSI = ((B11 + B4) − (B8 + B2)) / ((B11 + B4) + (B8 + B2))",
    "gndvi": "GNDVI = (B8 − B3) / (B8 + B3)",
}


def _stats(values: np.ndarray, mask: np.ndarray) -> dict[str, Any]:
    pixels = values[mask & np.isfinite(values)]
    total = int(mask.sum())
    if pixels.size == 0:
        return {"available": False, "validFraction": 0.0, "reason": "Aucun pixel exploitable dans la parcelle."}
    return {
        "available": True,
        "mean": round(float(np.mean(pixels)), 4),
        "median": round(float(np.median(pixels)), 4),
        "p10": round(float(np.percentile(pixels, 10)), 4),
        "p90": round(float(np.percentile(pixels, 90)), 4),
        "std": round(float(np.std(pixels)), 4),
        "pixels": int(pixels.size),
        "validFraction": round(float(pixels.size / total), 3) if total else 0.0,
    }


def vegetation_condition(ndvi_mean: float | None) -> dict[str, Any]:
    if ndvi_mean is None:
        return {"level": "inconnu", "reason": "NDVI indisponible sur cette scène."}
    if ndvi_mean < config.NDVI_SOIL_CEILING:
        return {
            "level": "sol nu dominant",
            "reason": f"NDVI moyen {ndvi_mean:.2f} < {config.NDVI_SOIL_CEILING} : le sol est majoritairement à nu.",
        }
    if ndvi_mean < config.NDVI_VEGETATION_FLOOR:
        return {
            "level": "couvert partiel",
            "reason": f"NDVI moyen {ndvi_mean:.2f} : végétation clairsemée ou stade précoce.",
        }
    if ndvi_mean < 0.65:
        return {"level": "végétation établie", "reason": f"NDVI moyen {ndvi_mean:.2f} : couvert actif."}
    return {"level": "végétation dense", "reason": f"NDVI moyen {ndvi_mean:.2f} : couvert fermé."}


def analyze_scene(payload: dict[str, Any]) -> dict[str, Any]:
    """Calcule les indices d'une scène et les statistiques zonales de la parcelle."""
    bands = payload.get("bands") or {}
    geometry = payload.get("geometry")
    scene = payload.get("scene") or {}
    grid = scene.get("grid") or {}

    required = {"B4", "B8"}
    missing = [band for band in required if band not in bands]
    if missing:
        raise ValueError(f"Bandes manquantes pour le NDVI : {', '.join(missing)}")

    parsed = {name: _array(values) for name, values in bands.items()}
    shape = parsed["B8"].shape
    for name, array in parsed.items():
        if array.shape != shape:
            raise ValueError(f"La bande {name} a une forme {array.shape} incompatible avec {shape}")
    if len(shape) != 2:
        raise ValueError("Chaque bande doit être une matrice 2D (lignes × colonnes)")

    # Masque : géométrie de la parcelle ∩ pixels valides.
    if grid.get("bbox") and grid.get("width") and grid.get("height"):
        mask = polygon_mask(geometry, grid)
        if mask.shape != shape:
            mask = np.ones(shape, dtype=bool)
    else:
        mask = np.ones(shape, dtype=bool)

    invalid = np.zeros(shape, dtype=bool)
    for array in parsed.values():
        invalid |= ~np.isfinite(array)
    if "SCL" in parsed:
        scl = parsed["SCL"]
        for value in config.S2_INVALID_SCL:
            invalid |= scl == value

    valid_mask = mask & ~invalid
    cloud_fraction = round(float((invalid & mask).sum() / max(mask.sum(), 1)), 3)

    indices: dict[str, Any] = {}
    computations = {
        "ndvi": lambda: ndvi(parsed["B8"], parsed["B4"]),
        "ndwi": (lambda: ndwi(parsed["B3"], parsed["B8"])) if {"B3", "B8"} <= parsed.keys() else None,
        "ndmi": (lambda: ndmi(parsed["B8"], parsed["B11"])) if {"B8", "B11"} <= parsed.keys() else None,
        "savi": lambda: savi(parsed["B8"], parsed["B4"]),
        "msavi": lambda: msavi(parsed["B8"], parsed["B4"]),
        "bsi": (lambda: bsi(parsed["B11"], parsed["B4"], parsed["B8"], parsed["B2"]))
        if {"B11", "B4", "B8", "B2"} <= parsed.keys()
        else None,
        "gndvi": (lambda: gndvi(parsed["B8"], parsed["B3"])) if {"B3", "B8"} <= parsed.keys() else None,
    }

    for name, compute in computations.items():
        if compute is None:
            indices[name] = {"available": False, "reason": "Bande spectrale absente de la scène."}
            continue
        values = compute()
        indices[name] = {**_stats(values, valid_mask), "method": INDEX_METHODS[name]}

    ndvi_stats = indices.get("ndvi") or {}
    ndvi_mean = ndvi_stats.get("mean")
    bsi_mean = (indices.get("bsi") or {}).get("mean")

    bare_soil_pixels = None
    if ndvi_stats.get("available"):
        soil_fraction = float(np.mean(ndvi(parsed["B8"], parsed["B4"])[valid_mask] < config.NDVI_SOIL_CEILING))
        bare_soil_pixels = round(soil_fraction, 3)

    condition = vegetation_condition(ndvi_mean)

    # Confiance : pixels valides, absence de nuages, résolution suffisante.
    valid_fraction = ndvi_stats.get("validFraction", 0.0)
    resolution = float(scene.get("resolutionM") or 10)
    resolution_factor = min(1.0, 10.0 / max(resolution, 1.0))
    confidence = round(max(0.0, min(1.0, valid_fraction * (1 - cloud_fraction) * resolution_factor)), 3)

    caveats: list[str] = []
    if cloud_fraction > 0.3:
        caveats.append(f"{cloud_fraction:.0%} de la parcelle est masquée (nuages/ombres/nodata) : indice partiel.")
    if valid_fraction < 0.5:
        caveats.append("Moins de la moitié des pixels sont exploitables : résultat à confirmer par une mesure terrain.")
    if resolution > 20:
        caveats.append("Résolution grossière : peu adaptée à une parcelle de moins d'un hectare.")

    return {
        "scene": {
            "id": scene.get("id"),
            "source": scene.get("source", "satellite"),
            "capturedAt": scene.get("capturedAt"),
            "cloudFraction": cloud_fraction,
            "resolutionM": resolution,
        },
        "indices": indices,
        "bareSoilFraction": bare_soil_pixels,
        "vegetation": condition,
        "bsiMean": bsi_mean,
        "confidence": confidence,
        "caveats": caveats,
        "method": "Réflectances de surface L2A ; masque SCL (nuages, ombres, neige) + nodata.",
    }


def phenology(series: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Phénologie d'une série NDVI : démarrage, pic, fin de saison, tendance.

    La série doit contenir au moins 4 observations valides ; sinon on répond
    « non déterminable » plutôt que d'extrapoler.
    """
    points = [
        (str(item.get("date")), float(item["ndvi"]))
        for item in series
        if item.get("ndvi") is not None and item.get("date") is not None and math.isfinite(float(item["ndvi"]))
    ]
    points.sort(key=lambda item: item[0])
    if len(points) < 4:
        return {
            "available": False,
            "reason": f"{len(points)} observation(s) valide(s) : au moins 4 sont nécessaires pour décrire une saison.",
            "observations": len(points),
        }

    values = np.array([value for _, value in points], dtype=float)
    baseline = float(np.percentile(values, 20))
    threshold = max(config.NDVI_SOS_THRESHOLD, baseline + 0.1)

    sos_index = next((index for index, value in enumerate(values) if value >= threshold), None)
    peak_index = int(np.argmax(values))
    eos_index = next(
        (index for index in range(len(values) - 1, -1, -1) if values[index] >= threshold),
        None,
    )

    times = np.arange(len(values), dtype=float)
    slope = float(np.polyfit(times, values, 1)[0]) if len(values) > 2 else 0.0

    if slope > 0.01:
        trend = "verdissement"
    elif slope < -0.01:
        trend = "sénescence"
    else:
        trend = "stable"

    return {
        "available": True,
        "observations": len(values),
        "seasonStart": points[sos_index][0] if sos_index is not None else None,
        "peak": {"date": points[peak_index][0], "ndvi": round(float(values[peak_index]), 3)},
        "seasonEnd": points[eos_index][0] if eos_index is not None else None,
        "seasonLengthObservations": (eos_index - sos_index + 1) if sos_index is not None and eos_index is not None else None,
        "baseline": round(baseline, 3),
        "threshold": round(threshold, 3),
        "trend": trend,
        "slopePerObservation": round(slope, 4),
        "anomaly": {
            "last": round(float(values[-1]), 3),
            "zScore": round(float((values[-1] - values.mean()) / values.std()), 2) if values.std() > 0 else 0.0,
        },
        "method": "Seuil de démarrage = max(0,20 ; P20 + 0,10) sur la série NDVI ; tendance = régression linéaire.",
    }
