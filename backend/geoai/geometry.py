"""Géométrie de parcelle : surface, centroïde, masque raster.

Aucune bibliothèque géospatiale lourde (GDAL/GEOS) n'est requise : les parcelles
du CDC sont de simples polygones GeoJSON, et les calculs se font sur des grilles
de pixels alignées sur la scène satellite.
"""
from __future__ import annotations

import math
from typing import Iterable, Sequence

import numpy as np

EARTH_RADIUS_M = 6_371_008.8


def _ring(geometry: dict | None) -> list[list[float]]:
    """Extrait l'anneau extérieur d'un Polygon / MultiPolygon GeoJSON."""
    if not geometry:
        return []
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates") or []
    if kind == "Polygon" and coordinates:
        return coordinates[0]
    if kind == "MultiPolygon" and coordinates:
        return max((polygon[0] for polygon in coordinates if polygon), key=len, default=[])
    if kind == "Feature":
        return _ring(geometry.get("geometry"))
    return []


def centroid(geometry: dict | None) -> tuple[float, float] | None:
    """Centroïde (lon, lat) — moyenne pondérée par l'aire, pas la moyenne des sommets."""
    ring = _ring(geometry)
    if len(ring) < 3:
        return None

    twice_area = 0.0
    cx = cy = 0.0
    for index, (x0, y0) in enumerate(ring):
        x1, y1 = ring[(index + 1) % len(ring)]
        cross = x0 * y1 - x1 * y0
        twice_area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross

    if abs(twice_area) < 1e-12:  # polygone dégénéré : on retombe sur la moyenne
        xs = [point[0] for point in ring]
        ys = [point[1] for point in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys))

    return (cx / (3 * twice_area), cy / (3 * twice_area))


def area_hectares(geometry: dict | None) -> float | None:
    """Surface géodésique approximative (formule sphérique), en hectares."""
    ring = _ring(geometry)
    if len(ring) < 3:
        return None

    reference_lat = math.radians(sum(point[1] for point in ring) / len(ring))
    total = 0.0
    for index, (lon0, lat0) in enumerate(ring):
        lon1, lat1 = ring[(index + 1) % len(ring)]
        x0 = math.radians(lon0) * math.cos(reference_lat) * EARTH_RADIUS_M
        y0 = math.radians(lat0) * EARTH_RADIUS_M
        x1 = math.radians(lon1) * math.cos(reference_lat) * EARTH_RADIUS_M
        y1 = math.radians(lat1) * EARTH_RADIUS_M
        total += x0 * y1 - x1 * y0

    return abs(total) / 2 / 10_000


def bbox(geometry: dict | None) -> tuple[float, float, float, float] | None:
    ring = _ring(geometry)
    if len(ring) < 3:
        return None
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    return (min(lons), min(lats), max(lons), max(lats))


def point_in_polygon(point: Sequence[float], geometry: dict | None) -> bool:
    """Ray casting (algorithme pair-impair), sans dépendance externe."""
    ring = _ring(geometry)
    if len(ring) < 3:
        return True  # pas de géométrie : on ne masque rien

    x, y = point
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


def polygon_mask(geometry: dict | None, grid: dict) -> np.ndarray:
    """Masque booléen du polygone sur une grille géoréférencée.

    `grid` = {"bbox": (min_lon, min_lat, max_lon, max_lat), "width": w, "height": h}
    aligné sur la scène satellite. Sans géométrie, tout le raster est retenu.
    """
    width = int(grid["width"])
    height = int(grid["height"])
    if not _ring(geometry):
        return np.ones((height, width), dtype=bool)

    min_lon, min_lat, max_lon, max_lat = grid["bbox"]
    lons = np.linspace(min_lon, max_lon, width, endpoint=False) + (max_lon - min_lon) / (2 * width)
    lats = np.linspace(max_lat, min_lat, height, endpoint=False) - (max_lat - min_lat) / (2 * height)

    mask = np.zeros((height, width), dtype=bool)
    for row, lat in enumerate(lats):
        for col, lon in enumerate(lons):
            mask[row, col] = point_in_polygon((float(lon), float(lat)), geometry)
    return mask


def downhill_slope_pct(centroid_point: Sequence[float], neighbour_heights: Iterable[tuple[float, float]]) -> float | None:
    """Pente locale (%) à partir de hauteurs voisines (m) et de leurs distances (m).

    Utilisée quand la parcelle n'a pas de MNT : on estime la pente par le plus
    fort gradient entre le centroïde et ses voisins connus. `None` si aucune
    donnée — jamais une valeur inventée.
    """
    pairs = list(neighbour_heights)
    if not pairs:
        return None
    slopes = [abs(height) / distance * 100 for distance, height in pairs if distance > 0]
    return max(slopes) if slopes else None
