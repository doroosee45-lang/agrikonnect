"""Prévision des paramètres du sol, évaluée sur un découpage **chronologique**.

Règles du cahier des charges appliquées ici, sans exception :

* **Pas de prévision sans données réelles suffisantes.** En dessous du seuil,
  la fonction répond ``sufficient: false`` avec un motif explicite — jamais une
  valeur plausible qui donnerait l'illusion d'une prévision.
* **Découpage chronologique, jamais aléatoire.** Le dernier tiers de la série
  est mis de côté *avant* tout ajustement. Un tirage aléatoire ferait fuiter le
  futur dans l'entraînement et gonflerait les métriques.
* **La persistance est la référence à battre.** Prédire « la dernière valeur
  observée » est le modèle nul. Une méthode qui ne fait pas mieux n'a aucune
  valeur : ``beatsBaseline`` reste faux et l'appelant ne doit pas s'en servir.
* **Aucune dépendance externe.** Bibliothèque standard uniquement, comme le
  reste du moteur.

Le moteur ne lit jamais la base de données : il reçoit une série et rend une
série. Node reste seul propriétaire des données et des autorisations.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Sequence

# ── Seuils d'honnêteté ───────────────────────────────────────────────────────
# En dessous, on refuse de prévoir plutôt que de produire du bruit ajusté.
MIN_POINTS = 12
MIN_SPAN_DAYS = 7.0
# Dernier tiers mis de côté pour l'évaluation. Jamais utilisé à l'ajustement.
TEST_FRACTION = 0.3
MIN_TEST_POINTS = 4
# Largeur de l'intervalle de prévision, en écarts-types résiduels.
INTERVAL_Z = 1.96
# Au-delà, l'extrapolation linéaire diverge : la tendance est amortie.
DAMPING_HORIZON_DAYS = 30.0

DAY_SECONDS = 86_400.0


def _positive(payload: dict[str, Any], key: str, default: float) -> float:
    """Lit un nombre strictement positif, en distinguant l'absence du zéro.

    ``payload.get(key) or default`` remplacerait silencieusement un ``0``
    explicite par la valeur par défaut : une entrée invalide passerait alors
    pour une entrée valide.
    """
    raw = payload.get(key)
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError) as error:
        raise ValueError(f"« {key} » doit être un nombre") from error
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"« {key} » doit être un nombre strictement positif")
    return value


class InsufficientData(ValueError):
    """Données insuffisantes — signalée comme telle, jamais contournée."""


def _parse_instant(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        # Accepte les millisecondes (convention JavaScript) comme les secondes.
        seconds = float(value) / 1000.0 if abs(float(value)) > 1e11 else float(value)
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"Date illisible : « {value} »") from error
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    raise ValueError(f"Date invalide : {value!r}")


def _clean_series(series: Sequence[dict[str, Any]]) -> list[tuple[float, float, datetime]]:
    """Normalise et trie une série en ``[(jours depuis l'origine, valeur, instant)]``.

    Les points non numériques sont écartés **et comptés** : une mesure corrompue
    ne doit ni faire échouer la prévision, ni être traitée comme une valeur.
    """
    points: list[tuple[datetime, float]] = []
    for index, item in enumerate(series):
        if not isinstance(item, dict):
            raise ValueError(f"Le point n°{index} n'est pas un objet")
        if "at" not in item:
            raise ValueError(f"Le point n°{index} n'a pas de date (« at »)")
        raw_value = item.get("value")
        if raw_value is None or isinstance(raw_value, bool):
            continue
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(value):
            continue
        points.append((_parse_instant(item["at"]), value))

    points.sort(key=lambda point: point[0])
    if not points:
        return []
    origin = points[0][0]
    return [
        ((instant - origin).total_seconds() / DAY_SECONDS, value, instant)
        for instant, value in points
    ]


def _linear_fit(xs: Sequence[float], ys: Sequence[float]) -> tuple[float, float, float]:
    """Moindres carrés sur une droite. Retourne ``(pente, ordonnée, écart-type résiduel)``.

    Une pente nulle est le comportement correct sur une série constante : ce
    n'est pas une erreur, c'est l'absence de tendance détectable.
    """
    n = len(xs)
    if n == 0:
        return 0.0, 0.0, 0.0
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    slope = sxy / sxx if sxx > 0 else 0.0
    intercept = mean_y - slope * mean_x
    residuals = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
    # Degrés de liberté : deux paramètres estimés. En dessous de 3 points,
    # l'écart-type n'a pas de sens et vaut 0 (pas d'intervalle inventé).
    if n > 2:
        variance = sum(r * r for r in residuals) / (n - 2)
    else:
        variance = 0.0
    return slope, intercept, math.sqrt(variance)


def _metrics(actual: Sequence[float], predicted: Sequence[float]) -> dict[str, Any]:
    n = len(actual)
    if n == 0:
        return {"mae": None, "rmse": None, "n": 0}
    errors = [a - p for a, p in zip(actual, predicted)]
    mae = sum(abs(e) for e in errors) / n
    rmse = math.sqrt(sum(e * e for e in errors) / n)
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "n": n}


def _predict(slope: float, intercept: float, anchor_x: float, target_x: float) -> float:
    """Valeur de la droite en ``target_x``, amortie au-delà de l'ancrage.

    L'ancrage est le dernier point sur lequel on s'appuie (fin de
    l'entraînement pour l'évaluation, dernière observation pour la projection).
    Le terme ``slope * anchor_x`` est indispensable : sans lui, la droite est
    évaluée près de l'origine au lieu de l'être là où les données s'arrêtent, et
    l'erreur croît avec la longueur de la série.
    """
    return intercept + slope * anchor_x + _damped_trend(slope, target_x - anchor_x)


def _damped_trend(slope: float, days_ahead: float) -> float:
    """Amortit la tendance au-delà de l'horizon d'ajustement.

    Une droite prolongée indéfiniment finirait par prédire une humidité de
    400 % ou un pH de −3. L'amortissement ramène progressivement la pente vers
    zéro : plus on s'éloigne des données, plus la prévision redevient prudente.
    """
    if days_ahead <= DAMPING_HORIZON_DAYS:
        return slope * days_ahead
    damp = DAMPING_HORIZON_DAYS * (1.0 - math.exp(-(days_ahead - DAMPING_HORIZON_DAYS) / DAMPING_HORIZON_DAYS))
    return slope * (DAMPING_HORIZON_DAYS + damp)


def forecast_soil(payload: dict[str, Any]) -> dict[str, Any]:
    """Prévoit un paramètre du sol à partir d'une série d'observations réelles.

    Attend :
      ``parameter``   nom du paramètre (reporté tel quel, jamais interprété) ;
      ``series``      ``[{"at": iso|ms, "value": nombre}]`` ;
      ``horizonDays`` horizon demandé (défaut 14) ;
      ``stepDays``    pas entre deux points prévus (défaut 1) ;
      ``now``         instant de référence (défaut : dernière observation).

    Rend un dictionnaire dont ``sufficient`` dit si la prévision est fondée.
    """
    parameter = str(payload.get("parameter") or "").strip()
    if not parameter:
        raise ValueError("Le paramètre est requis (« parameter »)")

    raw_series = payload.get("series")
    if not isinstance(raw_series, list):
        raise ValueError("« series » doit être une liste de points {at, value}")

    horizon_days = _positive(payload, "horizonDays", 14.0)
    step_days = _positive(payload, "stepDays", 1.0)
    if not math.isfinite(horizon_days) or horizon_days <= 0:
        raise ValueError("« horizonDays » doit être un nombre de jours strictement positif")
    if not math.isfinite(step_days) or step_days <= 0:
        raise ValueError("« stepDays » doit être un pas strictement positif")
    if horizon_days > 365:
        raise ValueError("« horizonDays » ne peut pas dépasser 365 jours")

    series = _clean_series(raw_series)
    rejected = len(raw_series) - len(series)

    def insufficient(reason: str) -> dict[str, Any]:
        return {
            "parameter": parameter,
            "sufficient": False,
            "reason": reason,
            "method": None,
            "values": [],
            "evaluation": None,
            "observationCount": len(series),
            "rejectedPoints": rejected,
        }

    if len(series) < MIN_POINTS:
        return insufficient(
            f"{len(series)} observation(s) exploitable(s) : il en faut au moins {MIN_POINTS}. "
            "Aucune prévision n'est produite."
        )

    span_days = series[-1][0] - series[0][0]
    if span_days < MIN_SPAN_DAYS:
        return insufficient(
            f"{len(series)} observations réparties sur {span_days:.1f} jour(s) : "
            f"il faut au moins {MIN_SPAN_DAYS:.0f} jours d'historique. "
            "Une série trop courte ne distingue pas une tendance d'un bruit."
        )

    # ── Découpage chronologique : le tiers final n'est jamais ajusté ──────
    split_index = max(1, int(round(len(series) * (1.0 - TEST_FRACTION))))
    train = series[:split_index]
    test = series[split_index:]

    if len(test) < MIN_TEST_POINTS:
        return insufficient(
            f"Le découpage chronologique ne laisse que {len(test)} point(s) pour l'évaluation "
            f"(minimum {MIN_TEST_POINTS}) : les métriques ne seraient pas significatives."
        )

    train_x = [point[0] for point in train]
    train_y = [point[1] for point in train]
    slope, intercept, train_resid = _linear_fit(train_x, train_y)

    # Évaluation sur le tiers réservé, pour la tendance comme pour la persistance.
    test_x = [point[0] for point in test]
    test_y = [point[1] for point in test]
    last_train_value = train[-1][1]

    anchor_x = train[-1][0]
    model_predicted = [_predict(slope, intercept, anchor_x, x) for x in test_x]
    baseline_predicted = [last_train_value] * len(test_y)

    model_metrics = _metrics(test_y, model_predicted)
    baseline_metrics = _metrics(test_y, baseline_predicted)

    # Strictement meilleur : à égalité, la méthode complexe n'apporte rien.
    beats = (
        model_metrics["mae"] is not None
        and baseline_metrics["mae"] is not None
        and model_metrics["mae"] < baseline_metrics["mae"]
    )
    improvement = None
    if model_metrics["mae"] is not None and baseline_metrics["mae"]:
        improvement = round(
            100.0 * (baseline_metrics["mae"] - model_metrics["mae"]) / baseline_metrics["mae"], 2
        )

    # Écart-type résiduel sur la fenêtre de test : c'est l'erreur réellement
    # constatée hors échantillon, pas l'erreur d'ajustement (trop optimiste).
    test_residuals = [a - p for a, p in zip(test_y, model_predicted)]
    if len(test_residuals) > 1:
        mean_residual = sum(test_residuals) / len(test_residuals)
        residual_std = math.sqrt(
            sum((r - mean_residual) ** 2 for r in test_residuals) / (len(test_residuals) - 1)
        )
    else:
        residual_std = 0.0

    # ── Projection au-delà de la dernière observation ─────────────────────
    last_instant = series[-1][2]
    last_x = series[-1][0]
    anchor_instant = _parse_instant(payload["now"]) if payload.get("now") else last_instant

    values: list[dict[str, Any]] = []
    step = step_days
    while step <= horizon_days + 1e-9:
        at = anchor_instant + timedelta(days=step)
        centre = _predict(slope, intercept, last_x, last_x + step)
        # L'incertitude croît avec l'horizon : racine du temps écoulé.
        widening = math.sqrt(max(step, 0.0) / max(step_days, 1e-9)) if step_days > 0 else 1.0
        half_width = INTERVAL_Z * residual_std * math.sqrt(widening) if residual_std > 0 else None
        # Un écart-type résiduel réduit au bruit d'arrondi (série parfaitement
        # régulière) donnerait une bande de largeur nulle après arrondi : ce
        # serait affirmer une certitude que les données ne prouvent pas.
        if half_width is not None and round(half_width, 4) <= 0.0:
            half_width = None
        values.append(
            {
                "at": at.isoformat().replace("+00:00", "Z"),
                "value": round(centre, 4),
                # Bandes nulles = incertitude non quantifiable (série sans bruit
                # résiduel). Renvoyer une bande de largeur nulle affirmerait une
                # certitude que les données ne prouvent pas.
                "low": round(centre - half_width, 4) if half_width is not None else None,
                "high": round(centre + half_width, 4) if half_width is not None else None,
            }
        )
        step += step_days

    split_at = last_instant - timedelta(days=last_x - anchor_x)

    return {
        "parameter": parameter,
        "sufficient": True,
        "reason": None,
        "method": "linear-trend-damped",
        "baselineMethod": "persistence",
        "observationCount": len(series),
        "rejectedPoints": rejected,
        "spanDays": round(span_days, 2),
        "horizonDays": horizon_days,
        "stepDays": step_days,
        "model": {
            "slopePerDay": round(slope, 6),
            "intercept": round(intercept, 4),
            "dampingHorizonDays": DAMPING_HORIZON_DAYS,
            "residualStdTrain": round(train_resid, 4),
        },
        "evaluation": {
            "split": "chronological",
            "testFraction": TEST_FRACTION,
            "splitAt": split_at.isoformat().replace("+00:00", "Z"),
            "trainPoints": len(train),
            "testPoints": len(test),
            "model": model_metrics,
            "baseline": baseline_metrics,
            "beatsBaseline": beats,
            "improvementPct": improvement,
            "residualStdTest": round(residual_std, 4),
        },
        "values": values,
        "sources": ["measured_sensor"],
    }


def backtest(payload: dict[str, Any]) -> dict[str, Any]:
    """Évalue une méthode sur un découpage chronologique, sans prévoir.

    Sert au versionnage des modèles : c'est cette évaluation — et non une
    impression — qui décide de la promotion en production.
    """
    result = forecast_soil({**payload, "horizonDays": payload.get("horizonDays") or 14})
    evaluation = result.get("evaluation")
    return {
        "parameter": result["parameter"],
        "sufficient": result["sufficient"],
        "reason": result.get("reason"),
        "method": result.get("method"),
        "baselineMethod": result.get("baselineMethod"),
        "observationCount": result["observationCount"],
        "evaluation": evaluation,
        # La promotion exige une preuve, jamais une promesse.
        "promotable": bool(result["sufficient"] and evaluation and evaluation["beatsBaseline"]),
    }
