"""Pédologie : texture USDA, groupe hydrologique, contraintes et réserves.

Chaque fonction renvoie la valeur, la méthode utilisée et la source de chaque
entrée : le backend ne doit jamais afficher un chiffre sans provenance.
"""
from __future__ import annotations

from typing import Any

from . import config


def _clamp_percentages(sand: float, silt: float, clay: float) -> tuple[float, float, float]:
    total = sand + silt + clay
    if total <= 0:
        raise ValueError("Texture impossible : somme des fractions nulle")
    if abs(total - 100) > 0.5:  # normalisation explicite, jamais silencieuse
        factor = 100.0 / total
        sand, silt, clay = sand * factor, silt * factor, clay * factor
    return round(sand, 2), round(silt, 2), round(clay, 2)


def classify_texture(sand: float, silt: float, clay: float) -> dict[str, Any]:
    """Classe texturale USDA (12 classes) et groupe hydrologique associé."""
    sand, silt, clay = _clamp_percentages(sand, silt, clay)

    s_c = silt + 1.5 * clay
    s_c2 = silt + 2.0 * clay

    if s_c < 15:
        texture = "sable"
    elif s_c2 < 30:
        texture = "sable limoneux"
    elif (clay >= 7 and clay < 20 and sand > 52 and s_c2 >= 30) or (clay < 7 and silt < 50 and s_c2 >= 30):
        texture = "limon sableux"
    elif clay >= 7 and clay < 27 and silt >= 28 and silt < 50 and sand <= 52:
        texture = "limon"
    elif (silt >= 50 and 12 <= clay < 27) or (silt >= 50 and silt < 80 and clay < 12):
        texture = "limon fin"
    elif silt >= 80 and clay < 12:
        texture = "limon fin"
    elif 20 <= clay < 35 and silt < 28 and sand > 45:
        texture = "limon argilo-sableux"
    elif 27 <= clay < 40 and 20 < sand <= 45:
        texture = "limon argileux"
    elif 27 <= clay < 40 and sand <= 20:
        texture = "limon argileux fin"
    elif clay >= 35 and sand > 45:
        texture = "argile sableuse"
    elif clay >= 40 and silt >= 40:
        texture = "argile limoneuse"
    elif clay >= 40:
        texture = "argile"
    else:  # zone frontière : on le dit, on n'invente pas une classe
        texture = "non classé"

    return {
        "sand": sand,
        "silt": silt,
        "clay": clay,
        "class": texture,
        "hydrologicGroup": config.HYDROLOGIC_GROUP.get(texture),
        "waterHoldingMmPerCm": config.WATER_HOLDING_MM_PER_CM.get(texture),
        "method": "USDA textural triangle (12 classes), fractions normalisées à 100 %",
        "source": "lab",
        "classified": texture != "non classé",
    }


def classify_ph(ph: float) -> dict[str, Any]:
    for low, high, label in config.PH_CLASSES:
        if low <= ph < high:
            return {"value": ph, "class": label, "source": "lab"}
    return {"value": ph, "class": "non déterminé", "source": "lab"}


def classify_organic_matter(om: float) -> dict[str, Any]:
    for low, high, label in config.ORGANIC_MATTER_CLASSES:
        if low <= om < high:
            return {"value": om, "unit": "%", "class": label, "source": "lab"}
    return {"value": om, "unit": "%", "class": "non déterminé", "source": "lab"}


def classify_salinity(ec: float) -> dict[str, Any]:
    for low, high, label in config.SALINITY_CLASSES:
        if low <= ec < high:
            return {"value": ec, "unit": "dS/m", "class": label, "source": "lab"}
    return {"value": ec, "unit": "dS/m", "class": "non déterminé", "source": "lab"}


def erosion_risk(slope_pct: float | None, texture: str | None, rainfall_mm: float | None) -> dict[str, Any]:
    """Risque d'érosion hydrique — heuristique explicite, pas un modèle opaque.

    Trois facteurs seulement, chacun exposé avec sa contribution : pente,
    sensibilité texturale (battance/ruissellement) et agressivité climatique.
    """
    factors: list[dict[str, Any]] = []
    score = 0.0

    if slope_pct is None:
        factors.append({"factor": "pente", "available": False, "contribution": 0.0})
    else:
        slope_points = min(slope_pct / 15.0, 1.0) * 3.0  # 15 % de pente = saturation
        score += slope_points
        factors.append({"factor": "pente", "value": round(slope_pct, 2), "unit": "%", "contribution": round(slope_points, 2)})

    sensitivity = {
        "sable": 0.4, "sable limoneux": 0.8, "limon sableux": 1.4, "limon": 1.2,
        "limon fin": 1.8, "limon argilo-sableux": 1.6, "limon argileux": 1.3,
        "limon argileux fin": 1.7, "argile sableuse": 1.2, "argile limoneuse": 1.0,
        "argile": 1.0, "non classé": 1.2,
    }.get(texture or "non classé", 1.2)
    score += sensitivity
    factors.append({"factor": "sensibilité texturale", "value": texture, "contribution": sensitivity})

    if rainfall_mm is None:
        factors.append({"factor": "agressivité climatique", "available": False, "contribution": 0.0})
    else:
        rain_points = min(rainfall_mm / 1200.0, 1.0) * 2.0
        score += rain_points
        factors.append({"factor": "agressivité climatique", "value": rainfall_mm, "unit": "mm/an", "contribution": round(rain_points, 2)})

    if score >= 4.5:
        level = "élevé"
    elif score >= 3.0:
        level = "moyen"
    else:
        level = "faible"

    return {
        "level": level,
        "score": round(score, 2),
        "maxScore": 6.0,
        "factors": factors,
        "caveat": "Indice relatif à trois facteurs : ne remplace pas une étude d'érosion de terrain.",
    }


def constraints(profile: dict[str, Any], erosion: dict[str, Any]) -> list[dict[str, Any]]:
    """Contraintes explicites, chacune avec sa raison et sa source.

    Aucun « score global » : le CDC refuse les notes opaques. L'utilisateur voit
    la liste des limites, dans l'ordre de gravité.
    """
    found: list[dict[str, Any]] = []

    texture = profile.get("texture") or {}
    clay = texture.get("clay")
    sand = texture.get("sand")

    if clay is not None and clay >= 40:
        found.append({
            "code": "DRAINAGE_LIMITE",
            "severity": "forte",
            "label": "Drainage limité (argile ≥ 40 %)",
            "reason": f"Teneur en argile {clay:.0f} % : risque d'engorgement et de compaction.",
            "source": "lab",
        })
    if sand is not None and sand >= 75:
        found.append({
            "code": "FAIBLE_RETENTION",
            "severity": "moyenne",
            "label": "Faible rétention en eau (sable ≥ 75 %)",
            "reason": f"Teneur en sable {sand:.0f} % : les apports en eau sont lessivés rapidement.",
            "source": "lab",
        })

    ph = profile.get("ph") or {}
    ph_value = ph.get("value")
    if ph_value is not None and (ph_value < 5.2 or ph_value > 8.2):
        found.append({
            "code": "PH_CONTRAINTE",
            "severity": "moyenne",
            "label": f"pH {ph.get('class')}",
            "reason": f"pH eau {ph_value:.1f} : la disponibilité de plusieurs nutriments est réduite.",
            "source": "lab",
        })

    salinity = profile.get("salinity") or {}
    if salinity.get("class") in {"modérément salé", "fortement salé"}:
        found.append({
            "code": "SALINITE",
            "severity": "forte",
            "label": f"Salinité {salinity.get('class')}",
            "reason": f"Conductivité {salinity.get('value')} dS/m : cultures sensibles pénalisées.",
            "source": "lab",
        })

    organic = profile.get("organicMatter") or {}
    if organic.get("class") in {"très faible", "faible"}:
        found.append({
            "code": "MATIERE_ORGANIQUE_FAIBLE",
            "severity": "moyenne",
            "label": f"Matière organique {organic.get('class')}",
            "reason": f"{organic.get('value')} % : structure fragile, activité biologique limitée.",
            "source": "lab",
        })

    if erosion.get("level") == "élevé":
        found.append({
            "code": "EROSION",
            "severity": "forte",
            "label": "Risque d'érosion élevé",
            "reason": "Pente, texture et pluviométrie se cumulent : sol nu à éviter en saison des pluies.",
            "source": "derived",
        })

    order = {"forte": 0, "moyenne": 1, "faible": 2}
    found.sort(key=lambda item: order.get(item["severity"], 3))
    return found


def build_profile(samples: list[dict[str, Any]]) -> dict[str, Any]:
    """Profil agronomique de la couche labourée à partir d'un ou plusieurs prélèvements.

    Les prélèvements sont pondérés par leur profondeur de recouvrement : un
    prélèvement 0–20 cm ne décrit pas la même chose qu'un 20–60 cm.
    """
    usable = [sample for sample in samples if sample.get("sand") is not None and sample.get("clay") is not None]
    if not usable:
        return {"available": False, "reason": "Aucun prélèvement avec texture complète (sable/limon/argile)."}

    weights = [float(sample.get("weight", 1.0)) or 1.0 for sample in usable]
    total_weight = sum(weights)

    def weighted(field: str) -> float | None:
        pairs = [(sample[field], weight) for sample, weight in zip(usable, weights) if sample.get(field) is not None]
        if not pairs:
            return None
        return sum(value * weight for value, weight in pairs) / sum(weight for _, weight in pairs)

    sand = weighted("sand") or 0.0
    clay = weighted("clay") or 0.0
    silt = weighted("silt")
    if silt is None:
        silt = max(0.0, 100.0 - sand - clay)

    texture = classify_texture(sand, silt, clay)

    profile: dict[str, Any] = {
        "available": True,
        "texture": texture,
        "samplesUsed": len(usable),
        "totalWeight": round(total_weight, 3),
    }

    ph = weighted("ph")
    if ph is not None:
        profile["ph"] = classify_ph(round(ph, 2))

    organic = weighted("organicMatter")
    if organic is not None:
        profile["organicMatter"] = classify_organic_matter(round(organic, 2))

    ec = weighted("ec")
    if ec is not None:
        profile["salinity"] = classify_salinity(round(ec, 3))

    moisture = weighted("moisture")
    if moisture is not None:
        profile["moisture"] = {"value": round(moisture, 3), "unit": "vol %", "source": "sensor" if any(s.get("source") == "sensor" for s in usable) else "lab"}

    return profile
