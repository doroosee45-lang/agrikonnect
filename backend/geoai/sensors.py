"""Contrôle qualité de séries de capteurs de sol (humidité, température, EC, pH).

Un capteur qui dérive, qui se bloque ou qui saute des mesures produit des
décisions agronomiques fausses. Ce module ne se contente pas de moyenner : il
qualifie chaque point, détecte les pannes classiques et convertit l'humidité
volumique en millimètres d'eau utilisables par la plante.
"""
from __future__ import annotations

import math
from statistics import median
from typing import Any

import numpy as np

from . import config


def _epoch(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("Z", "+00:00")
    from datetime import datetime, timezone

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def _mad_outliers(values: np.ndarray, *, limit: float | None = None) -> np.ndarray:
    """Écart absolu médian : robuste aux valeurs extrêmes, contrairement à l'écart-type.

    `limit` permet au backend d'imposer son propre seuil : la valeur par défaut
    vient de `config.py`, mais la source de vérité déclarée est le fichier de
    configuration matériel du backend, qui le transmet à chaque appel.
    """
    threshold = config.MAD_Z_LIMIT if limit is None else float(limit)
    centre = np.median(values)
    deviations = np.abs(values - centre)
    mad = np.median(deviations)
    if mad == 0:
        # Toutes les valeurs proches : on utilise un plancher relatif pour éviter
        # de déclarer aberrante une série parfaitement stable.
        scale = max(np.std(values), abs(centre) * 1e-3, 1e-9)
        return np.abs(values - centre) / scale > threshold
    return 0.6745 * deviations / mad > threshold


def quality(
    readings: list[dict[str, Any]],
    *,
    unit: str = "vol %",
    depth_cm: float = 30.0,
    mad_z_limit: float | None = None,
    stuck_min_points: int | None = None,
    stuck_epsilon: float | None = None,
    gap_factor: float | None = None,
) -> dict[str, Any]:
    """Qualifie une série de mesures et renvoie les valeurs propres + les défauts détectés.

    Les seuils sont **surchargeables** : leur source de vérité déclarée est le
    fichier de configuration matériel du backend (`src/config/hardware.js`,
    section `anomalies`), qui les transmet à chaque appel. Les valeurs de
    `config.py` ne servent que de repli quand rien n'est fourni.
    """
    mad_limit = config.MAD_Z_LIMIT if mad_z_limit is None else float(mad_z_limit)
    stuck_points = config.STUCK_MIN_POINTS if stuck_min_points is None else int(stuck_min_points)
    stuck_eps = config.STUCK_EPSILON if stuck_epsilon is None else float(stuck_epsilon)
    gap_mult = config.GAP_FACTOR if gap_factor is None else float(gap_factor)
    points: list[tuple[float, float, dict[str, Any]]] = []
    for reading in readings:
        stamp = _epoch(reading.get("at") or reading.get("timestamp"))
        value = reading.get("value", reading.get("reading"))
        if stamp is None or value is None:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(numeric):
            points.append((stamp, numeric, reading))
    points.sort(key=lambda item: item[0])

    if not points:
        return {
            "available": False,
            "reason": "Aucune mesure numérique datée : série inexploitable.",
            "readings": 0,
        }

    values = np.array([point[1] for point in points], dtype=float)
    stamps = np.array([point[0] for point in points], dtype=float)

    outliers = _mad_outliers(values, limit=mad_limit)
    keep = ~outliers
    clean = values[keep]
    clean_stamps = stamps[keep]

    # Capteur bloqué : même valeur sur au moins 5 points consécutifs.
    stuck = False
    stuck_indices: list[int] = []
    run_start = 0
    for index in range(1, len(values)):
        if abs(values[index] - values[index - 1]) <= stuck_eps:
            if index - run_start + 1 >= stuck_points:
                stuck = True
                stuck_indices = list(range(run_start, index + 1))
                break
        else:
            run_start = index

    # Trous : intervalle supérieur à 2,5 × l'intervalle médian.
    gaps: list[dict[str, Any]] = []
    if len(stamps) > 1:
        deltas = np.diff(stamps)
        typical = float(np.median(deltas))
        if typical > 0:
            for index, delta in enumerate(deltas):
                if delta > typical * gap_mult:
                    gaps.append({
                        "from": points[index][0],
                        "to": points[index + 1][0],
                        "missing": round(float(delta / typical) - 1),
                    })

    # Dérive : pente sur la série nettoyée, comparée à l'amplitude.
    drift: dict[str, Any] = {"detected": False}
    if len(clean) >= 4 and (clean_stamps[-1] - clean_stamps[0]) > 0:
        offset = clean_stamps - clean_stamps[0]
        slope, intercept = np.polyfit(offset, clean, 1)
        span_days = (clean_stamps[-1] - clean_stamps[0]) / 86400
        drift_total = float(slope) * span_days * 86400
        residual = clean - (intercept + slope * offset)
        noise = float(np.std(residual))
        mean_value = abs(float(np.mean(clean))) or 1e-9
        # Une dérive est retenue quand la tendance dépasse nettement le bruit
        # (3 σ du résidu) **et** qu'elle représente plus de 10 % de la valeur.
        significant = abs(drift_total) > 3 * noise if noise > 0 else abs(drift_total) > mean_value * 0.02
        if significant and abs(drift_total) > mean_value * 0.10:
            drift = {
                "detected": True,
                "perDay": round(float(slope) * 86400, 4),
                "total": round(drift_total, 3),
                "noise": round(noise, 4),
                "reason": "La dérive cumulée dépasse l'amplitude observée : suspecter un encrassement ou une dérive de calibration.",
            }

    mean = float(np.mean(clean))
    # Conversion humidité volumique → hauteur d'eau (mm) sur l'épaisseur prospectée.
    millimetres = round(mean / 100.0 * depth_cm * 10.0, 2) if unit.startswith("vol") else None

    confidence = round(
        max(0.0, min(1.0, (1 - float(outliers.mean())) * (1 - 0.5 * bool(stuck)) * (1 - 0.2 * bool(gaps)))),
        3,
    )

    return {
        "available": True,
        "readings": len(values),
        "validReadings": int((~outliers).sum()),
        "outliers": int(outliers.sum()),
        "outlierIndices": [int(index) for index in np.where(outliers)[0][:20]],
        # Identifiants des mesures aberrantes.
        #
        # `outlierIndices` seul est inutilisable côté backend : `points` est
        # filtré (mesures non numériques ou non datées écartées) puis trié par
        # date, donc ces indices ne correspondent pas à la liste envoyée.
        # Renvoyer les identifiants supprime toute reconstruction d'ordre côté
        # appelant — la seule source d'erreur silencieuse possible ici.
        "outlierReadingIds": [
            points[int(index)][2].get("id")
            for index in np.where(outliers)[0][:50]
            if points[int(index)][2].get("id")
        ],
        "mean": round(mean, 3),
        "median": round(float(median(clean.tolist())), 3),
        "min": round(float(np.min(clean)), 3),
        "max": round(float(np.max(clean)), 3),
        "std": round(float(np.std(clean)), 3),
        "unit": unit,
        "period": {"from": points[0][0], "to": points[-1][0], "spanDays": round((stamps[-1] - stamps[0]) / 86400, 2)},
        "stuckSensor": stuck,
        "stuckReadingIds": [
            points[index][2].get("id")
            for index in stuck_indices
            if points[index][2].get("id")
        ],
        "drift": drift,
        "gaps": gaps,
        "waterStorageMm": millimetres,
        "waterStorageReason": (
            f"Humidité volumique moyenne {mean:.1f} % × {depth_cm:.0f} cm de sol = {millimetres} mm d'eau."
            if millimetres is not None
            else "Conversion en mm non applicable à cette grandeur."
        ),
        "confidence": confidence,
        # Seuils réellement appliqués : le résultat doit être reproductible.
        "thresholdsUsed": {
            "madZLimit": mad_limit,
            "stuckMinPoints": stuck_points,
            "stuckEpsilon": stuck_eps,
            "gapFactor": gap_mult,
        },
        "method": "Aberrations = score MAD robuste (|0,6745·(x−médiane)/MAD| > 3,5) ; trous = intervalle > 2,5 × médiane.",
    }


def calibrate(readings: list[dict[str, Any]], *, offset: float = 0.0, gain: float = 1.0) -> dict[str, Any]:
    """Applique une calibration linéaire documentée (pente + décalage) à une série."""
    adjusted: list[dict[str, Any]] = []
    for reading in readings:
        value = reading.get("value", reading.get("reading"))
        if value is None:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        adjusted.append({**reading, "value": round(numeric * gain + offset, 4), "calibration": {"gain": gain, "offset": offset}})
    return {
        "readings": adjusted,
        "count": len(adjusted),
        "calibration": {"gain": gain, "offset": offset, "method": "y = gain × x + offset (certificat de calibration du fabricant)"},
    }
