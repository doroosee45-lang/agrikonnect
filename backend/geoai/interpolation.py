"""Interpolation spatiale des paramètres du sol — krigeage ordinaire.

Phase 6 du cahier des charges : à partir d'au moins trois sondes, produire une
carte interpolée **avec son incertitude**, signaler toute valeur aberrante **avec
son motif**, et rendre chaque nombre nécessaire à l'explication.

Pourquoi le krigeage et pas une moyenne mobile ou un IDW :

  - l'IDW invente une pondération (1/d^p) sans la fonder sur les données, et ne
    produit **aucune** incertitude crédible ;
  - le krigeage ajuste un variogramme **sur les mesures elles-mêmes** : la
    pondération et la variance de krigeage sortent toutes les deux des données.
    L'incertitude annoncée n'est donc pas décorative.

Le moteur n'accède à aucune base. Il reçoit des points, rend une grille.

Conventions numériques, explicitées parce qu'elles changent les résultats :

  - ``gamma(0) = 0`` et la diagonale de la matrice de krigeage vaut 0. Le pépite
    (``nugget``) représente l'erreur de mesure et vaut ``gamma(0+)``.
  - la variance de krigeage est ramenée à 0 si l'algèbre la rend négative
    (arrondi), et ce bornage est signalé dans ``clampedCells``.
  - les points strictement confondus sont moyennés avant calcul : deux valeurs
    différentes au même endroit rendent le système de krigeage singulier.
"""

import math

# --- Seuils de données suffisantes ------------------------------------------

MIN_POINTS = 3
"""Trois sondes : le minimum fixé par la phase 6 pour interpoler."""

MIN_DISTINCT_LOCATIONS = 3
"""Trois emplacements distincts : trois sondes au même endroit n'interpolent rien."""

MIN_SPREAD_M = 5.0
"""
Étendue minimale du nuage de points, en mètres.

En dessous, les sondes décrivent un point et non une parcelle : la « carte »
serait une extrapolation sans support spatial.
"""

MIN_SEPARATION_M = 1.0
"""En deçà, deux points sont considérés confondus et leurs valeurs moyennées."""

MIN_VARIOGRAM_PAIRS = 3
"""Nombre minimal de paires pour ajuster un variogramme."""

# --- Validation croisée et valeurs aberrantes -------------------------------

OUTLIER_Z = 2.5
"""
Résidu standardisé au-delà duquel une mesure est signalée aberrante.

Le résidu est standardisé par l'écart-type de krigeage **du point retiré** : une
mesure n'est aberrante que si elle s'écarte de ce que ses voisines prédisent de
plusieurs fois l'incertitude locale. Un seuil fixe en valeur absolue signalerait
comme aberrante toute mesure sur un sol naturellement hétérogène.
"""

EARTH_RADIUS_M = 6_371_000.0
MAX_CELLS = 20_000
"""Plafond de cellules : protège la charge utile sans changer la méthode."""


class InsufficientData(ValueError):
    """Données réelles insuffisantes pour interpoler — aucun rendu n'est produit."""


# --- Géométrie ---------------------------------------------------------------


def _haversine_m(lon1, lat1, lon2, lat2):
    """Distance orthodromique en mètres. Suffisamment exacte à l'échelle d'une parcelle."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def _meters_to_degrees(meters, latitude):
    """Conversion approchée mètres → degrés, suffisante à l'échelle d'une parcelle."""
    lat_deg = meters / 111_320.0
    cos_lat = math.cos(math.radians(latitude))
    # Près des pôles la longitude se resserre ; on borne pour éviter la division par 0.
    lon_deg = meters / (111_320.0 * max(cos_lat, 1e-6))
    return lon_deg, lat_deg


# --- Validation des entrées --------------------------------------------------


def _positive(payload, key, default, maximum=None):
    """
    Lit un nombre strictement positif.

    Distingue l'absence d'une valeur nulle : ``payload.get(key) or default``
    transformerait un ``0`` explicite en valeur par défaut et laisserait passer
    une entrée invalide.
    """
    raw = payload.get(key, default)
    if raw is None:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{key} doit être un nombre") from exc
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{key} doit être strictement positif")
    if maximum is not None and value > maximum:
        raise ValueError(f"{key} ne peut pas dépasser {maximum}")
    return value


def _clean_points(raw_points):
    """
    Normalise les points et écarte ceux qui ne sont pas exploitables.

    Un point rejeté est **compté et motivé**, jamais ignoré en silence : une
    carte calculée sur 4 points alors que 9 ont été fournis serait trompeuse.
    """
    if not isinstance(raw_points, list):
        raise ValueError("points doit être une liste")

    points = []
    rejected = []
    for index, raw in enumerate(raw_points):
        if not isinstance(raw, dict):
            rejected.append({"index": index, "reason": "point invalide"})
            continue

        coordinates = raw.get("coordinates")
        if not isinstance(coordinates, (list, tuple)) or len(coordinates) != 2:
            rejected.append({"index": index, "id": raw.get("id"), "reason": "coordonnées absentes ou mal formées"})
            continue
        try:
            lon = float(coordinates[0])
            lat = float(coordinates[1])
        except (TypeError, ValueError):
            rejected.append({"index": index, "id": raw.get("id"), "reason": "coordonnées non numériques"})
            continue
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            rejected.append({"index": index, "id": raw.get("id"), "reason": "coordonnées hors du monde"})
            continue

        try:
            value = float(raw.get("value"))
        except (TypeError, ValueError):
            rejected.append({"index": index, "id": raw.get("id"), "reason": "valeur non numérique"})
            continue
        if not math.isfinite(value):
            rejected.append({"index": index, "id": raw.get("id"), "reason": "valeur non finie"})
            continue

        points.append({
            "id": raw.get("id") or f"point_{index}",
            "lon": lon,
            "lat": lat,
            "value": value,
            "source": raw.get("source") or "unknown",
        })

    return points, rejected


def _merge_coincident(points):
    """
    Moyenne les points strictement confondus.

    Deux mesures différentes au même emplacement rendent le système de krigeage
    singulier. Les moyennner est la seule issue honnête : choisir l'une des deux
    serait arbitraire, et les garder toutes les deux ferait échouer le calcul.
    """
    groups = []
    for point in points:
        placed = False
        for group in groups:
            anchor = group[0]
            if _haversine_m(anchor["lon"], anchor["lat"], point["lon"], point["lat"]) < MIN_SEPARATION_M:
                group.append(point)
                placed = True
                break
        if not placed:
            groups.append([point])

    merged = []
    for group in groups:
        n = len(group)
        merged.append({
            "id": group[0]["id"] if n == 1 else "+".join(str(p["id"]) for p in group),
            "lon": sum(p["lon"] for p in group) / n,
            "lat": sum(p["lat"] for p in group) / n,
            "value": sum(p["value"] for p in group) / n,
            "source": group[0]["source"] if n == 1 else "merged",
            "mergedCount": n,
        })
    return merged


# --- Variogramme -------------------------------------------------------------


def _pair_distances(points):
    """Toutes les paires distinctes, avec leur distance en mètres."""
    pairs = []
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            distance = _haversine_m(points[i]["lon"], points[i]["lat"], points[j]["lon"], points[j]["lat"])
            if distance <= 0:
                continue
            pairs.append((distance, points[i]["value"], points[j]["value"]))
    return pairs


def _empirical_variogram(points, bin_count=8):
    """
    Variogramme empirique, groupé par classes de distance.

    gamma(h) = moyenne de 0,5 * (zi - zj)^2 sur les paires de la classe.
    """
    pairs = _pair_distances(points)
    if len(pairs) < MIN_VARIOGRAM_PAIRS:
        return [], len(pairs), 0.0

    max_distance = max(distance for distance, _, _ in pairs)
    width = max_distance / bin_count
    buckets = [[] for _ in range(bin_count)]
    for distance, value_a, value_b in pairs:
        index = min(int(distance / width), bin_count - 1)
        buckets[index].append(0.5 * (value_a - value_b) ** 2)

    binned = []
    for index, bucket in enumerate(buckets):
        if not bucket:
            continue
        binned.append({
            "h": round((index + 0.5) * width, 3),
            "gamma": round(sum(bucket) / len(bucket), 6),
            "pairs": len(bucket),
        })
    return binned, len(pairs), max_distance


def _gamma_exponential(nugget, sill, range_m, distance):
    """Modèle exponentiel : gamma(h) = nugget + (sill - nugget) * (1 - exp(-h / range))."""
    if distance <= 0:
        return 0.0
    return nugget + (sill - nugget) * (1.0 - math.exp(-distance / range_m))


def _fit_variogram(binned, max_distance):
    """
    Ajuste un modèle exponentiel par recherche sur grille.

    Une recherche sur grille plutôt qu'une optimisation itérative : le problème
    est à deux paramètres, le domaine est borné, et le résultat est reproductible
    — aucune dépendance à une condition initiale.
    """
    if not binned or max_distance <= 0:
        raise InsufficientData("trop peu de paires pour ajuster un variogramme")

    # Le palier est estimé sur les classes les plus éloignées : c'est là que la
    # corrélation spatiale s'éteint.
    far = [entry for entry in binned if entry["h"] >= max_distance * 0.5] or binned
    sill = sum(entry["gamma"] * entry["pairs"] for entry in far) / sum(entry["pairs"] for entry in far)
    if sill <= 0:
        # Variance nulle partout : le champ est constant, l'interpolation est triviale.
        return {"model": "exponential", "nugget": 0.0, "sill": 0.0, "rangeM": round(max_distance, 3),
                "constant": True, "sse": 0.0}

    best = None
    for nugget_ratio in (0.0, 0.05, 0.1, 0.2, 0.35, 0.5):
        nugget = sill * nugget_ratio
        for range_ratio in (0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.5, 2.5):
            range_m = max_distance * range_ratio
            sse = 0.0
            for entry in binned:
                predicted = _gamma_exponential(nugget, sill, range_m, entry["h"])
                sse += entry["pairs"] * (entry["gamma"] - predicted) ** 2
            if best is None or sse < best["sse"]:
                best = {
                    "model": "exponential",
                    "nugget": round(nugget, 6),
                    "sill": round(sill, 6),
                    "rangeM": round(range_m, 3),
                    "constant": False,
                    "sse": round(sse, 8),
                }
    return best


def _solve_linear(matrix, vector):
    """
    Résolution par élimination de Gauss avec pivot partiel.

    Renvoie ``None`` si le système est singulier : l'appelant doit alors refuser
    de produire une valeur plutôt que de rendre un résultat numérique fantaisiste.
    """
    n = len(matrix)
    # Copie : la résolution ne doit pas modifier la matrice de l'appelant.
    a = [row[:] + [vector[i]] for i, row in enumerate(matrix)]

    for column in range(n):
        pivot = max(range(column, n), key=lambda r: abs(a[r][column]))
        if abs(a[pivot][column]) < 1e-12:
            return None
        a[column], a[pivot] = a[pivot], a[column]
        divisor = a[column][column]
        for row in range(column + 1, n):
            factor = a[row][column] / divisor
            if factor == 0.0:
                continue
            for k in range(column, n + 1):
                a[row][k] -= factor * a[column][k]

    solution = [0.0] * n
    for row in range(n - 1, -1, -1):
        total = a[row][n] - sum(a[row][k] * solution[k] for k in range(row + 1, n))
        solution[row] = total / a[row][row]
    return solution


def _kriging_estimate(points, target_lon, target_lat, model):
    """
    Krigeage ordinaire en un point.

    @return (valeur, écart-type, bornée) ou ``None`` si le système est singulier.
    """
    n = len(points)

    if model.get("constant") or model["sill"] == 0.0:
        # Champ sans variance spatiale : tous les gamma sont nuls, la matrice de
        # krigeage est dégénérée et le système admet une infinité de solutions
        # (tout vecteur de poids sommant à 1). La solution de variance minimale
        # est alors **déterminée** : la moyenne arithmétique, de variance nulle.
        # Refuser de répondre ici écarterait un sol parfaitement uniforme, qui
        # est le cas le plus simple à interpoler.
        mean_value = sum(point["value"] for point in points) / n
        return mean_value, 0.0, False

    size = n + 1
    matrix = [[0.0] * size for _ in range(size)]

    for i in range(n):
        for j in range(n):
            if i == j:
                # gamma(0) = 0 : la diagonale porte le zéro du variogramme, le
                # pépite représentant l'erreur de mesure et non la corrélation.
                continue
            matrix[i][j] = _gamma_exponential(
                model["nugget"], model["sill"], model["rangeM"],
                _haversine_m(points[i]["lon"], points[i]["lat"], points[j]["lon"], points[j]["lat"]),
            )
        matrix[i][n] = 1.0
        matrix[n][i] = 1.0

    rhs = [
        _gamma_exponential(
            model["nugget"], model["sill"], model["rangeM"],
            _haversine_m(points[i]["lon"], points[i]["lat"], target_lon, target_lat),
        )
        for i in range(n)
    ] + [1.0]

    weights = _solve_linear(matrix, rhs)
    if weights is None:
        return None

    value = sum(weights[i] * points[i]["value"] for i in range(n))
    # Variance de krigeage : somme pondérée des gamma vers la cible, plus le
    # multiplicateur de Lagrange.
    variance = sum(weights[i] * rhs[i] for i in range(n)) + weights[n]
    clamped = variance < 0.0
    std_dev = math.sqrt(max(variance, 0.0))
    return value, std_dev, clamped


# --- Préparation commune -----------------------------------------------------


def _prepare(payload):
    """Valide l'entrée et prépare les points. Commun à la grille et au LOO."""
    parameter = payload.get("parameter")
    if not isinstance(parameter, str) or not parameter.strip():
        raise ValueError("parameter est requis")

    points, rejected = _clean_points(payload.get("points"))
    if len(points) < MIN_POINTS:
        raise InsufficientData(
            f"au moins {MIN_POINTS} points mesurés sont requis pour interpoler, "
            f"{len(points)} reçu(s)"
        )

    merged = _merge_coincident(points)
    if len(merged) < MIN_DISTINCT_LOCATIONS:
        raise InsufficientData(
            f"au moins {MIN_DISTINCT_LOCATIONS} emplacements distincts sont requis, "
            f"{len(merged)} trouvé(s)"
        )

    spread = 0.0
    for i in range(len(merged)):
        for j in range(i + 1, len(merged)):
            spread = max(spread, _haversine_m(merged[i]["lon"], merged[i]["lat"], merged[j]["lon"], merged[j]["lat"]))
    if spread < MIN_SPREAD_M:
        raise InsufficientData(
            f"les points s'étendent sur {round(spread, 2)} m, moins que le minimum de "
            f"{MIN_SPREAD_M} m : ils décrivent un point, pas une parcelle"
        )

    binned, pair_count, max_distance = _empirical_variogram(merged)
    if pair_count < MIN_VARIOGRAM_PAIRS:
        raise InsufficientData(
            f"{pair_count} paire(s) exploitable(s), moins que le minimum de {MIN_VARIOGRAM_PAIRS}"
        )
    model = _fit_variogram(binned, max_distance)

    sources = sorted({point["source"] for point in points})
    merged_sources = [point["id"] for point in merged if point.get("mergedCount", 1) > 1]

    diagnostics = {
        "parameter": parameter.strip(),
        "pointCount": len(points),
        "locationCount": len(merged),
        "rejectedPoints": rejected,
        "mergedLocations": merged_sources,
        "pairCount": pair_count,
        "spreadM": round(spread, 3),
        "maxPairDistanceM": round(max_distance, 3),
        "sources": sources,
        "variogram": {
            "model": model["model"],
            "nugget": model["nugget"],
            "sill": model["sill"],
            "rangeM": model["rangeM"],
            "constant": model.get("constant", False),
            "fitSse": model["sse"],
            "empirical": binned,
        },
    }
    return parameter.strip(), points, merged, model, diagnostics


def _leave_one_out(merged, model):
    """
    Validation croisée « laisser-une-sonde-dehors ».

    Chaque mesure est retirée à son tour et prédite depuis les autres. C'est la
    seule évaluation honnête disponible ici : il n'y a pas de vérité terrain
    indépendante, et réutiliser la mesure dans son propre ajustement mesurerait
    la capacité du modèle à se recopier.
    """
    errors = []
    details = []
    for index, target in enumerate(merged):
        others = [point for i, point in enumerate(merged) if i != index]
        if len(others) < MIN_POINTS - 1:
            continue
        estimate = _kriging_estimate(others, target["lon"], target["lat"], model)
        if estimate is None:
            details.append({
                "id": target["id"],
                "skipped": True,
                "reason": "système de krigeage singulier sans ce point",
            })
            continue
        predicted, std_dev, _clamped = estimate
        error = target["value"] - predicted
        standardized = abs(error) / std_dev if std_dev > 0 else None
        errors.append(error)
        details.append({
            "id": target["id"],
            "observed": target["value"],
            "predicted": round(predicted, 6),
            "error": round(error, 6),
            "absError": round(abs(error), 6),
            "stdDev": round(std_dev, 6),
            "standardizedError": None if standardized is None else round(standardized, 4),
            "source": target["source"],
        })

    if not errors:
        raise InsufficientData("validation croisée impossible : trop peu de points")

    n = len(errors)
    mae = sum(abs(error) for error in errors) / n
    rmse = math.sqrt(sum(error ** 2 for error in errors) / n)
    mean_error = sum(errors) / n

    return {
        "method": "leave-one-probe-out",
        "n": n,
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "meanError": round(mean_error, 6),
        "details": details,
    }, details


def _detect_outliers(details):
    """
    Valeurs aberrantes, chacune avec son motif chiffré.

    Le motif cite le résidu, l'écart-type local et le seuil : un agriculteur ou
    un agronome doit pouvoir vérifier le jugement, pas seulement le subir.
    """
    outliers = []
    for entry in details:
        standardized = entry.get("standardizedError")
        if standardized is None:
            continue
        if standardized >= OUTLIER_Z:
            outliers.append({
                "id": entry["id"],
                "observed": entry["observed"],
                "predicted": entry["predicted"],
                "error": entry["error"],
                "stdDev": entry["stdDev"],
                "standardizedError": standardized,
                "threshold": OUTLIER_Z,
                "source": entry.get("source"),
                "reason": (
                    f"écart de {entry['error']} entre la mesure ({entry['observed']}) et la "
                    f"prédiction des sondes voisines ({entry['predicted']}), soit "
                    f"{standardized} fois l'incertitude locale de {entry['stdDev']} "
                    f"(seuil {OUTLIER_Z})"
                ),
            })
    return outliers


# --- Points d'entrée ---------------------------------------------------------


def leave_one_out(payload):
    """Évaluation seule, sans carte : sert à qualifier la méthode et ses sorties."""
    parameter, points, merged, model, diagnostics = _prepare(payload)
    cross_validation, details = _leave_one_out(merged, model)
    outliers = _detect_outliers(details)

    return {
        "parameter": parameter,
        "sufficient": True,
        "diagnostics": diagnostics,
        "crossValidation": cross_validation,
        "outliers": outliers,
        "outlierThresholdZ": OUTLIER_Z,
    }


def interpolate_grid(payload):
    """
    Carte interpolée avec incertitude, valeurs aberrantes et validation croisée.

    Refuse de produire quoi que ce soit si les données sont insuffisantes :
    lève `InsufficientData`, que le serveur traduit en 422 avec le motif.
    """
    parameter, points, merged, model, diagnostics = _prepare(payload)

    cross_validation, details = _leave_one_out(merged, model)
    outliers = _detect_outliers(details)

    # --- Grille -------------------------------------------------------------
    lons = [point["lon"] for point in merged]
    lats = [point["lat"] for point in merged]
    bbox = payload.get("bbox")
    if bbox is not None:
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            raise ValueError("bbox doit contenir [ouest, sud, est, nord]")
        west, south, east, north = (float(value) for value in bbox)
        if west >= east or south >= north:
            raise ValueError("bbox invalide : ouest < est et sud < nord sont requis")
    else:
        west, east = min(lons), max(lons)
        south, north = min(lats), max(lats)

    resolution_m = _positive(payload, "resolutionM", 25.0, maximum=5000.0)
    centre_lat = (south + north) / 2.0
    step_lon, step_lat = _meters_to_degrees(resolution_m, centre_lat)

    columns = max(2, int((east - west) / step_lon) + 1)
    rows = max(2, int((north - south) / step_lat) + 1)
    if columns * rows > MAX_CELLS:
        # Plutôt que tronquer la carte, on l'épaissit : la couverture reste
        # complète, seule la finesse diminue, et le changement est déclaré.
        scale = math.sqrt(columns * rows / float(MAX_CELLS))
        columns = max(2, int(columns / scale))
        rows = max(2, int(rows / scale))
        step_lon = (east - west) / (columns - 1)
        step_lat = (north - south) / (rows - 1)
        resolution_m = round(resolution_m * scale, 3)

    cells = []
    clamped_cells = 0
    unsolved_cells = 0
    sd_min = None
    sd_max = 0.0
    for row in range(rows):
        lat = north - row * step_lat
        for column in range(columns):
            lon = west + column * step_lon
            estimate = _kriging_estimate(merged, lon, lat, model)
            if estimate is None:
                unsolved_cells += 1
                continue
            value, std_dev, clamped = estimate
            if clamped:
                clamped_cells += 1
            sd_min = std_dev if sd_min is None else min(sd_min, std_dev)
            sd_max = max(sd_max, std_dev)
            cells.append({
                "lon": round(lon, 8),
                "lat": round(lat, 8),
                "value": round(value, 6),
                "sd": round(std_dev, 6),
            })

    if not cells:
        raise InsufficientData("aucune cellule n'a pu être calculée")

    observed_min = min(point["value"] for point in merged)
    observed_max = max(point["value"] for point in merged)

    return {
        "parameter": parameter,
        "sufficient": True,
        "method": "ordinary-kriging",
        "uncertainty": "kriging-standard-deviation",
        "diagnostics": diagnostics,
        "crossValidation": cross_validation,
        "outliers": outliers,
        "outlierThresholdZ": OUTLIER_Z,
        "grid": {
            "bbox": [west, south, east, north],
            "columns": columns,
            "rows": rows,
            "resolutionM": resolution_m,
            "requestedResolutionM": payload.get("resolutionM"),
            "cellCount": len(cells),
            "clampedCells": clamped_cells,
            "unsolvedCells": unsolved_cells,
            "sdMin": None if sd_min is None else round(sd_min, 6),
            "sdMax": round(sd_max, 6),
            "cells": cells,
        },
        "observed": {
            "min": round(observed_min, 6),
            "max": round(observed_max, 6),
            "mean": round(sum(p["value"] for p in merged) / len(merged), 6),
        },
        "sources": diagnostics["sources"],
    }
