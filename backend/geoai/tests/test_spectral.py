"""Tests de télédétection : indices, masque nuage, statistiques zonales, phénologie."""
import unittest

import numpy as np

from geoai import spectral
from geoai.geometry import area_hectares, centroid, point_in_polygon, polygon_mask

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[15.0, -4.0], [15.01, -4.0], [15.01, -3.99], [15.0, -3.99], [15.0, -4.0]]],
}


def scene(red=0.10, nir=0.50, size=6, scl_value=None):
    bands = {
        "B2": np.full((size, size), 0.05),
        "B3": np.full((size, size), 0.08),
        "B4": np.full((size, size), red),
        "B8": np.full((size, size), nir),
        "B11": np.full((size, size), 0.20),
    }
    if scl_value is not None:
        scl = np.full((size, size), 4.0)
        scl[0, 0] = scl_value
        bands["SCL"] = scl
    return {"scene": {"id": "S2-TEST", "capturedAt": "2026-09-01T10:00:00Z", "resolutionM": 10}, "bands": bands}


class IndexTests(unittest.TestCase):
    def test_ndvi_valeur_attendue(self):
        result = spectral.analyze_scene(scene())
        self.assertAlmostEqual(result["indices"]["ndvi"]["mean"], 0.6667, places=3)
        self.assertTrue(result["indices"]["ndvi"]["available"])
        self.assertIn("B8", result["indices"]["ndvi"]["method"])

    def test_sol_nu_dominant(self):
        result = spectral.analyze_scene(scene(red=0.30, nir=0.34))  # NDVI ≈ 0,0625
        self.assertEqual(result["vegetation"]["level"], "sol nu dominant")
        self.assertGreater(result["bareSoilFraction"], 0.9)

    def test_vegetation_dense(self):
        result = spectral.analyze_scene(scene(red=0.05, nir=0.55))
        self.assertEqual(result["vegetation"]["level"], "végétation dense")

    def test_indices_absents_signales(self):
        payload = scene()
        del payload["bands"]["B11"]
        result = spectral.analyze_scene(payload)
        self.assertFalse(result["indices"]["ndmi"]["available"])
        self.assertIn("reason", result["indices"]["ndmi"])
        self.assertTrue(result["indices"]["ndvi"]["available"])

    def test_bande_manquante_leve_une_erreur(self):
        payload = scene()
        del payload["bands"]["B4"]
        with self.assertRaises(ValueError):
            spectral.analyze_scene(payload)

    def test_nuages_masques_et_confiance(self):
        result = spectral.analyze_scene(scene(scl_value=9))  # 1 pixel sur 36 en nuage
        self.assertGreater(result["scene"]["cloudFraction"], 0)
        self.assertEqual(result["indices"]["ndvi"]["pixels"], 35)
        self.assertLess(result["confidence"], 1.0)

    def test_donnees_entierement_masquees(self):
        payload = scene()
        payload["bands"]["SCL"] = np.full((6, 6), 9.0)
        result = spectral.analyze_scene(payload)
        self.assertFalse(result["indices"]["ndvi"]["available"])
        self.assertEqual(result["confidence"], 0.0)
        self.assertTrue(result["caveats"])


class GeometryTests(unittest.TestCase):
    def test_point_dans_polygone(self):
        self.assertTrue(point_in_polygon((15.005, -3.995), SQUARE))
        self.assertFalse(point_in_polygon((15.02, -3.995), SQUARE))

    def test_aire_et_centroide(self):
        area = area_hectares(SQUARE)
        self.assertAlmostEqual(area, 123.6, delta=5)  # 0,01° × 0,01° ≈ 123 ha à cette latitude
        lon, lat = centroid(SQUARE)
        self.assertAlmostEqual(lon, 15.005, places=3)
        self.assertAlmostEqual(lat, -3.995, places=3)

    def test_masque_zonale(self):
        grid = {"bbox": (14.99, -4.01, 15.02, -3.98), "width": 12, "height": 12}
        mask = polygon_mask(SQUARE, grid)
        self.assertGreater(mask.sum(), 0)
        self.assertLess(mask.sum(), mask.size)

    def test_sans_geometrie_tout_le_raster(self):
        mask = polygon_mask(None, {"bbox": (0, 0, 1, 1), "width": 3, "height": 3})
        self.assertEqual(int(mask.sum()), 9)


class PhenologyTests(unittest.TestCase):
    def series(self):
        values = [0.20, 0.26, 0.40, 0.62, 0.71, 0.66, 0.45, 0.28, 0.18]
        return [{"date": f"2026-{month:02d}-15", "ndvi": value} for month, value in zip(range(1, 10), values)]

    def test_saison_detectee(self):
        result = spectral.phenology(self.series())
        self.assertTrue(result["available"])
        self.assertIsNotNone(result["seasonStart"])
        self.assertEqual(result["peak"]["ndvi"], 0.71)
        self.assertIn(result["trend"], {"verdissement", "sénescence", "stable"})
        self.assertIn("zScore", result["anomaly"])

    def test_serie_trop_courte(self):
        result = spectral.phenology(self.series()[:2])
        self.assertFalse(result["available"])
        self.assertIn("4", result["reason"])

    def test_valeurs_non_numeriques_ignorees(self):
        series = self.series() + [{"date": "2026-10-15", "ndvi": None}]
        result = spectral.phenology(series)
        self.assertEqual(result["observations"], 9)


if __name__ == "__main__":
    unittest.main()
