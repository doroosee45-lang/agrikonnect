"""Imagerie de proximité : photos de parcelle (caméra) et produits drone.

Deux usages distincts, tous deux calculés sur les pixels :

* **caméra** (photo de sol ou de culture prise au téléphone) : indices RGB de
  végétation (ExG, VARI, GLI), part de sol nu, texture (entropie, densité de
  contours, rugosité) — utile pour qualifier une surface sans laboratoire ;
* **drone** (orthophoto + modèle de hauteur de canopée) : couverture végétale,
  hauteur moyenne et P90 de la canopée, biomasse relative, trous de peuplement.

L'analyse d'image ne remplace jamais une analyse de sol : les sorties le disent
explicitement (`caveat`) et la confiance dépend de la résolution et de l'éclairage.
"""
from __future__ import annotations

import base64
import math
from typing import Any

import numpy as np

from . import config

try:  # Pillow est déclaré dans requirements.txt ; l'import reste optionnel.
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - environnement sans Pillow
    Image = None  # type: ignore


def decode_image(payload: dict[str, Any]) -> np.ndarray:
    """Décode une image PNG/JPEG depuis `base64`, `path` ou une matrice RGB déjà ouverte."""
    if payload.get("pixels"):
        array = np.asarray(payload["pixels"], dtype=np.float64)
        if array.ndim != 3 or array.shape[2] < 3:
            raise ValueError("`pixels` doit être une matrice H×W×3")
        return array[:, :, :3]

    if Image is None:
        raise ValueError("Le décodage d'image nécessite Pillow (pip install -r geoai/requirements.txt)")

    if payload.get("base64"):
        raw = base64.b64decode(payload["base64"].split(",")[-1])
        from io import BytesIO

        image = Image.open(BytesIO(raw))
    elif payload.get("path"):
        image = Image.open(payload["path"])
    else:
        raise ValueError("Fournir `base64`, `path` ou `pixels` pour analyser une image")

    return np.asarray(image.convert("RGB"), dtype=np.float64)


def _normalised_channels(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    total = rgb.sum(axis=2)
    total = np.where(total == 0, 1, total)
    return rgb[:, :, 0] / total, rgb[:, :, 1] / total, rgb[:, :, 2] / total, total


def excess_green(rgb: np.ndarray) -> np.ndarray:
    """ExG = 2g − r − b (canaux normalisés) : sépare végétation et sol."""
    r, g, b, _ = _normalised_channels(rgb)
    return 2 * g - r - b


def vari(rgb: np.ndarray) -> np.ndarray:
    """VARI = (G − R) / (G + R − B) : robuste à l'éclairage oblique."""
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    denominator = green + red - blue
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.divide(green - red, denominator, out=np.full_like(denominator, np.nan), where=denominator != 0)


def gli(rgb: np.ndarray) -> np.ndarray:
    """GLI = (2G − R − B) / (2G + R + B)."""
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    numerator = 2 * green - red - blue
    denominator = 2 * green + red + blue
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.divide(numerator, denominator, out=np.full_like(denominator, np.nan), where=denominator != 0)


def otsu_threshold(values: np.ndarray, bins: int = 256) -> float:
    """Seuil d'Otsu : sépare automatiquement végétation et sol sans réglage manuel."""
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return 0.0
    histogram, edges = np.histogram(finite, bins=bins)
    probabilities = histogram / histogram.sum()
    centres = (edges[:-1] + edges[1:]) / 2

    omega = np.cumsum(probabilities)
    mu = np.cumsum(probabilities * centres)
    mu_total = mu[-1]
    denominator = omega * (1 - omega)
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mu_total * omega - mu) ** 2 / denominator
    between = np.nan_to_num(between, nan=-1)
    return float(centres[int(np.argmax(between))])


def _entropy(gray: np.ndarray) -> float:
    histogram, _ = np.histogram(gray, bins=32, range=(0, 255))
    probabilities = histogram / max(histogram.sum(), 1)
    probabilities = probabilities[probabilities > 0]
    return float(-np.sum(probabilities * np.log2(probabilities)) / 5.0)  # normalisé 0–1


def _edge_density(gray: np.ndarray) -> float:
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    gradient_y, gradient_x = np.gradient(gray)
    magnitude = np.hypot(gradient_x, gradient_y)
    return float(np.mean(magnitude > 12))


def analyze_camera(payload: dict[str, Any]) -> dict[str, Any]:
    """Qualifie une photo de parcelle : végétation, sol nu, texture, exposition."""
    rgb = decode_image(payload)
    if rgb.shape[0] * rgb.shape[1] < 16:
        raise ValueError("Image trop petite pour une analyse fiable")

    exg = excess_green(rgb)
    threshold = otsu_threshold(exg)
    vegetation = exg > max(threshold, config.EXG_SOIL_THRESHOLD)
    vegetation_fraction = float(vegetation.mean())
    soil_fraction = 1 - vegetation_fraction

    gray = rgb.mean(axis=2)
    brightness = float(gray.mean())
    shadows = float((gray < 25).mean())

    vari_values = vari(rgb)
    gli_values = gli(rgb)
    finite_vari = vari_values[np.isfinite(vari_values)]
    finite_gli = gli_values[np.isfinite(gli_values)]

    texture_entropy = _entropy(gray)
    edges = _edge_density(gray)

    if vegetation_fraction >= 0.7:
        cover = "couvert dense"
    elif vegetation_fraction >= 0.4:
        cover = "couvert partiel"
    elif vegetation_fraction >= 0.15:
        cover = "végétation clairsemée"
    else:
        cover = "sol nu dominant"

    pixels = rgb.shape[0] * rgb.shape[1]
    confidence = 0.6
    caveats = [
        "Une photo ne mesure ni la texture, ni le pH, ni la matière organique : elle qualifie une surface visible.",
    ]
    if pixels < config.MIN_PIXELS_FOR_CONFIDENCE:
        confidence -= 0.15
        caveats.append("Image de faible résolution : la part de sol nu est approximative.")
    if shadows > 0.25:
        confidence -= 0.2
        caveats.append(f"{shadows:.0%} de pixels très sombres (ombre) : couverture sous-estimée.")
    if brightness < 45 or brightness > 220:
        confidence -= 0.1
        caveats.append("Exposition extrême (sous-exposition ou surexposition) : indices RGB biaisés.")

    return {
        "kind": "camera",
        "vegetationFraction": round(vegetation_fraction, 3),
        "soilFraction": round(soil_fraction, 3),
        "cover": cover,
        "indices": {
            "exgMean": round(float(np.nanmean(exg)), 4),
            "exgThreshold": round(threshold, 4),
            "variMean": round(float(finite_vari.mean()), 4) if finite_vari.size else None,
            "gliMean": round(float(finite_gli.mean()), 4) if finite_gli.size else None,
        },
        "texture": {
            "entropy": round(texture_entropy, 3),
            "edgeDensity": round(edges, 4),
            "brightness": round(brightness, 1),
            "shadowFraction": round(shadows, 3),
            "reading": "surface hétérogène (mottes/cailloux)" if texture_entropy > 0.6 else "surface homogène",
        },
        "resolution": {"width": int(rgb.shape[1]), "height": int(rgb.shape[0]), "pixels": int(pixels)},
        "confidence": round(max(0.0, min(1.0, confidence)), 3),
        "caveats": caveats,
        "method": "Canaux normalisés → ExG ; seuil d'Otsu sur l'ExG ; entropie et gradient pour la texture.",
    }


def analyze_drone(payload: dict[str, Any]) -> dict[str, Any]:
    """Orthophoto + modèle de hauteur de canopée (CHM) d'un vol drone."""
    rgb = decode_image(payload)
    chm = payload.get("chm")
    result: dict[str, Any] = {"kind": "drone"}

    exg = excess_green(rgb)
    threshold = otsu_threshold(exg)
    vegetation = exg > max(threshold, config.EXG_SOIL_THRESHOLD)
    result["vegetationFraction"] = round(float(vegetation.mean()), 3)
    result["soilFraction"] = round(1 - float(vegetation.mean()), 3)

    if chm:
        heights = np.asarray(chm, dtype=np.float64)
        heights = heights[np.isfinite(heights) & (heights >= 0)]
        if heights.size:
            canopy = heights[vegetation.ravel()[: heights.size]] if vegetation.size == heights.size else heights
            canopy = canopy[canopy > 0.05]
            result["canopy"] = {
                "meanM": round(float(np.mean(canopy)), 2) if canopy.size else 0.0,
                "p90M": round(float(np.percentile(canopy, 90)), 2) if canopy.size else 0.0,
                "maxM": round(float(np.max(canopy)), 2) if canopy.size else 0.0,
                "coverageFraction": round(float(canopy.size / heights.size), 3),
                "source": "drone",
                "method": "CHM (MNS − MNT) filtré > 5 cm, P90 robuste aux surplombs isolés.",
            }
            if canopy.size and float(np.percentile(canopy, 90)) < 0.25:
                result["establishment"] = "peuplement non installé ou très jeune"
            elif canopy.size:
                result["establishment"] = "peuplement installé"
        else:
            result["canopy"] = {"available": False, "reason": "CHM fourni mais sans valeur exploitable."}
    else:
        result["canopy"] = {"available": False, "reason": "Aucun modèle de hauteur (CHM) fourni : hauteur non estimable."}

    flight = payload.get("flight") or {}
    gsd = float(flight.get("gsdCm") or 3.0)
    confidence = 0.9 if gsd <= 5 else 0.75 if gsd <= 10 else 0.55

    result.update({
        "flight": {"gsdCm": gsd, "capturedAt": flight.get("capturedAt"), "sensor": flight.get("sensor", "RGB")},
        "confidence": confidence,
        "caveats": ["Le drone mesure la canopée et la couverture, pas la fertilité du sol."],
        "method": "Orthophoto géoréférencée + CHM ; seuil d'Otsu sur l'ExG pour la couverture.",
    })
    return result


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    kind = (payload.get("kind") or "camera").lower()
    if kind == "drone":
        return analyze_drone(payload)
    if kind == "camera":
        return analyze_camera(payload)
    raise ValueError(f"Type d'imagerie inconnu : {kind} (attendu : camera | drone)")
