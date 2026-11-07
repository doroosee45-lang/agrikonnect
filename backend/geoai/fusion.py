"""Fusion multi-sources : une valeur, sa provenance, sa confiance, ses conflits.

Règle du CDC (§6.5) : la priorité est **laboratoire > capteur > satellite >
drone > caméra > déclaré**. On ne moyenne donc pas aveuglément : la source la
plus fiable l'emporte, les autres sont exposées comme alternatives, et un
désaccord important entre sources est signalé au lieu d'être lissé.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from . import config


def _age_days(measured_at: Any) -> float:
    if not measured_at:
        return 0.0
    text = str(measured_at).replace("Z", "+00:00")
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        return 0.0
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - moment).total_seconds() / 86400)


def _weight(observation: dict[str, Any]) -> float:
    source = str(observation.get("source") or "declared")
    reliability = config.SOURCE_RELIABILITY.get(source, 0.3)
    quality = float(observation.get("quality", 1.0) or 1.0)
    freshness = 0.5 ** (_age_days(observation.get("measuredAt")) / config.FRESHNESS_HALF_LIFE_DAYS)
    return max(0.01, reliability * max(0.0, min(1.0, quality)) * freshness)


# Grandeurs **dynamiques** : elles vieillissent vite (humidité, température, EC),
# donc la fraîcheur peut primer sur la hiérarchie des sources. Les grandeurs
# **stationnaires** (texture, pH, matière organique) ne vieillissent pas : la
# source la plus fiable reste prioritaire même si la mesure est ancienne.
DYNAMIC_PARAMETERS = {"moisture", "temperature", "ec"}


def _priority_rank(source: str) -> int:
    try:
        return config.SOURCE_PRIORITY.index(source)
    except ValueError:
        return len(config.SOURCE_PRIORITY)


def fuse(observations: list[dict[str, Any]]) -> dict[str, Any]:
    """Fusionne des observations `{parameter, value, source, unit?, measuredAt?, quality?}`."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for observation in observations:
        parameter = observation.get("parameter")
        value = observation.get("value")
        if not parameter or value is None:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(numeric):
            continue
        grouped.setdefault(parameter, []).append({**observation, "value": numeric})

    parameters: dict[str, Any] = {}
    conflicts: list[dict[str, Any]] = []

    for parameter, items in grouped.items():
        enriched = [
            {
                **item,
                "weight": round(_weight(item), 4),
                "reliability": config.SOURCE_RELIABILITY.get(str(item.get("source")), 0.3),
            }
            for item in items
        ]
        if parameter in DYNAMIC_PARAMETERS:
            enriched.sort(key=lambda item: (-item["weight"], _priority_rank(str(item.get("source")))))
        else:
            enriched.sort(key=lambda item: (_priority_rank(str(item.get("source"))), -item["weight"]))

        primary = enriched[0]
        total_weight = sum(item["weight"] for item in enriched)
        weighted_mean = sum(item["value"] * item["weight"] for item in enriched) / total_weight
        variance = sum(item["weight"] * (item["value"] - weighted_mean) ** 2 for item in enriched) / total_weight
        spread = math.sqrt(variance)

        tolerance = config.CONFLICT_RELATIVE_TOLERANCE.get(parameter, config.CONFLICT_RELATIVE_TOLERANCE["default"])
        parameter_conflicts: list[dict[str, Any]] = []
        for index, first in enumerate(enriched):
            for second in enriched[index + 1:]:
                reference = max(abs(first["value"]), abs(second["value"]), 1e-9)
                relative = abs(first["value"] - second["value"]) / reference
                if relative > tolerance:
                    parameter_conflicts.append({
                        "parameter": parameter,
                        "sources": [first.get("source"), second.get("source")],
                        "values": [round(first["value"], 3), round(second["value"], 3)],
                        "relativeGap": round(relative, 3),
                        "resolution": f"La source prioritaire ({primary.get('source')}) est retenue ; l'écart reste affiché.",
                    })

        conflicts.extend(parameter_conflicts)

        # Confiance : accord entre sources + fiabilité de la source retenue.
        agreement = 1.0 - min(1.0, spread / max(abs(weighted_mean), 1e-9))
        confidence = round(max(0.0, min(1.0, primary["reliability"] * (0.6 + 0.4 * agreement))), 3)

        parameters[parameter] = {
            "value": round(primary["value"], 3),
            "unit": primary.get("unit"),
            "source": primary.get("source"),
            "measuredAt": primary.get("measuredAt"),
            "confidence": confidence,
            "interval": [round(primary["value"] - spread, 3), round(primary["value"] + spread, 3)],
            "weightedMean": round(weighted_mean, 3),
            "sources": len(enriched),
            "alternatives": [
                {
                    "source": item.get("source"),
                    "value": round(item["value"], 3),
                    "weight": item["weight"],
                    "reliability": item["reliability"],
                    "measuredAt": item.get("measuredAt"),
                    # Une source plus fiable mais écartée pour cause de fraîcheur
                    # doit être visible : l'utilisateur peut vouloir la rafraîchir.
                    "demoted": _priority_rank(str(item.get("source"))) < _priority_rank(str(primary.get("source"))),
                    "demotionReason": (
                        f"Source plus fiable mais mesure de {round(_age_days(item.get('measuredAt')))} jours "
                        "(grandeur dynamique : la fraîcheur prime)."
                        if parameter in DYNAMIC_PARAMETERS
                        and _priority_rank(str(item.get("source"))) < _priority_rank(str(primary.get("source")))
                        else None
                    ),
                }
                for item in enriched[1:]
            ],
            "conflicts": parameter_conflicts,
            "staleness": (
                None
                if _age_days(primary.get("measuredAt")) < 2 * config.FRESHNESS_HALF_LIFE_DAYS
                else f"Mesure de {round(_age_days(primary.get('measuredAt')))} jours : à rafraîchir avant une décision."
            ),
            "explanation": (
                f"Valeur retenue : {primary.get('source')} ({primary['value']:.2f}), "
                f"la plus fiable parmi {len(enriched)} source(s) selon l'ordre "
                f"{' > '.join(config.SOURCE_PRIORITY)}."
            ),
        }

    return {
        "parameters": parameters,
        "conflicts": conflicts,
        "priorityOrder": config.SOURCE_PRIORITY,
        "reliability": config.SOURCE_RELIABILITY,
        "method": "Poids = fiabilité(source) × qualité × fraîcheur (demi-vie 365 j) ; source prioritaire retenue ; écart-type pondéré exposé.",
        "sourcesUsed": sorted({str(item.get("source")) for items in grouped.values() for item in items}),
    }
