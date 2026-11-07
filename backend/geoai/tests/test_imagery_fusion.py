"""Tests d'imagerie (caméra/drone) et de fusion multi-sources."""
import base64
import io
import unittest
from datetime import datetime, timedelta, timezone

import numpy as np

from geoai import fusion, imagery


def half_green_image(size=80):
    """Moitié supérieure végétation, moitié inférieure sol nu."""
    rgb = np.zeros((size, size, 3), dtype=np.float64)
    rgb[: size // 2, :, :] = [40, 130, 45]
    rgb[size // 2 :, :, :] = [155, 115, 75]
    return rgb


class CameraTests(unittest.TestCase):
    def test_separation_vegetation_sol(self):
        result = imagery.analyze_camera({"pixels": half_green_image().tolist()})
        self.assertAlmostEqual(result["vegetationFraction"], 0.5, delta=0.05)
        self.assertAlmostEqual(result["soilFraction"], 0.5, delta=0.05)
        self.assertEqual(result["cover"], "couvert partiel")
        self.assertIn("exgMean", result["indices"])
        self.assertTrue(any("ne mesure ni la texture" in caveat for caveat in result["caveats"]))

    def test_vegetation_dominante(self):
        rgb = np.zeros((60, 60, 3))
        rgb[:, :, :] = [35, 140, 40]
        result = imagery.analyze_camera({"pixels": rgb.tolist()})
        self.assertGreater(result["vegetationFraction"], 0.9)
        self.assertEqual(result["cover"], "couvert dense")

    def test_sol_nu(self):
        rgb = np.zeros((60, 60, 3))
        rgb[:, :, :] = [160, 120, 80]
        result = imagery.analyze_camera({"pixels": rgb.tolist()})
        self.assertLess(result["vegetationFraction"], 0.1)
        self.assertEqual(result["cover"], "sol nu dominant")

    def test_image_sombre_reduit_la_confiance(self):
        rgb = half_green_image()
        rgb[:30, :, :] = 2  # ombre profonde (37 % de l’image)
        result = imagery.analyze_camera({"pixels": rgb.tolist()})
        self.assertLess(result["confidence"], 0.6)
        self.assertGreater(result["texture"]["shadowFraction"], 0.0)

    def test_base64_png(self):
        from PIL import Image

        buffer = io.BytesIO()
        Image.fromarray(half_green_image().astype("uint8")).save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode()
        result = imagery.analyze_camera({"base64": f"data:image/png;base64,{encoded}"})
        self.assertAlmostEqual(result["vegetationFraction"], 0.5, delta=0.05)
        self.assertEqual(result["resolution"]["width"], 80)

    def test_payload_invalide(self):
        with self.assertRaises(ValueError):
            imagery.analyze_camera({})
        with self.assertRaises(ValueError):
            imagery.analyze({"kind": "radar", "pixels": [[[0, 0, 0]]]})


class DroneTests(unittest.TestCase):
    def test_chm_et_couverture(self):
        rgb = np.zeros((50, 50, 3))
        rgb[:, :, :] = [35, 140, 40]
        chm = np.full((50, 50), 0.9)
        chm[0:5, :] = 0.0
        result = imagery.analyze_drone({"pixels": rgb.tolist(), "chm": chm.tolist(), "flight": {"gsdCm": 3}})
        self.assertAlmostEqual(result["vegetationFraction"], 1.0, delta=0.05)
        self.assertAlmostEqual(result["canopy"]["meanM"], 0.9, delta=0.05)
        self.assertEqual(result["establishment"], "peuplement installé")
        self.assertEqual(result["confidence"], 0.9)

    def test_sans_chm_hauteur_non_estimee(self):
        rgb = np.zeros((30, 30, 3))
        rgb[:, :, :] = [40, 130, 45]
        result = imagery.analyze_drone({"pixels": rgb.tolist()})
        self.assertFalse(result["canopy"]["available"])
        self.assertIn("reason", result["canopy"])

    def test_jeune_peuplement(self):
        rgb = np.zeros((30, 30, 3))
        rgb[:, :, :] = [40, 130, 45]
        chm = np.full((30, 30), 0.1)
        result = imagery.analyze_drone({"pixels": rgb.tolist(), "chm": chm.tolist()})
        self.assertEqual(result["establishment"], "peuplement non installé ou très jeune")


class FusionTests(unittest.TestCase):
    def observation(self, parameter, value, source, days_ago=1, quality=1.0, unit=None):
        return {
            "parameter": parameter,
            "value": value,
            "source": source,
            "quality": quality,
            "unit": unit,
            "measuredAt": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
        }

    def test_priorite_laboratoire_sur_declare(self):
        result = fusion.fuse([
            self.observation("clay", 34.0, "lab"),
            self.observation("clay", 33.0, "declared"),
        ])
        clay = result["parameters"]["clay"]
        self.assertEqual(clay["source"], "lab")
        self.assertEqual(clay["value"], 34.0)
        self.assertEqual(len(clay["alternatives"]), 1)
        self.assertGreater(clay["confidence"], 0.8)
        self.assertEqual(result["priorityOrder"][0], "lab")
        self.assertEqual(result["conflicts"], [])

    def test_conflit_entre_sources_signale(self):
        result = fusion.fuse([
            self.observation("clay", 45.0, "lab"),
            self.observation("clay", 18.0, "camera"),
        ])
        self.assertEqual(len(result["parameters"]["clay"]["conflicts"]), 1)
        conflict = result["conflicts"][0]
        self.assertEqual(conflict["parameter"], "clay")
        self.assertGreater(conflict["relativeGap"], 0.35)
        self.assertIn("prioritaire", conflict["resolution"])

    def test_grandeur_dynamique_fraicheur_prime(self):
        result = fusion.fuse([
            self.observation("moisture", 12.0, "lab", days_ago=1400),
            self.observation("moisture", 28.0, "sensor", days_ago=0),
        ])
        moisture = result["parameters"]["moisture"]
        self.assertEqual(moisture["source"], "sensor")
        alternative = moisture["alternatives"][0]
        self.assertEqual(alternative["source"], "lab")
        self.assertTrue(alternative["demoted"])
        self.assertIn("fraîcheur", alternative["demotionReason"])

    def test_grandeur_stationnaire_priorite_conservee(self):
        result = fusion.fuse([
            self.observation("textureIndex", 30.0, "lab", days_ago=1400),
            self.observation("textureIndex", 29.0, "sensor", days_ago=0),
        ])
        self.assertEqual(result["parameters"]["textureIndex"]["source"], "lab")

    def test_intervalle_et_moyenne_ponderee(self):
        result = fusion.fuse([
            self.observation("ph", 6.0, "lab"),
            self.observation("ph", 7.0, "satellite"),
        ])
        ph = result["parameters"]["ph"]
        self.assertLess(ph["interval"][0], ph["value"])
        self.assertGreater(ph["interval"][1], ph["value"])
        self.assertAlmostEqual(ph["weightedMean"], 6.42, delta=0.1)

    def test_observations_invalides_ignorees(self):
        result = fusion.fuse([
            self.observation("ph", None, "lab"),
            {"parameter": "ph", "value": "abc", "source": "lab"},
            self.observation("sable", 40, "sensor"),
        ])
        self.assertEqual(list(result["parameters"].keys()), ["sable"])

    def test_fusion_vide(self):
        result = fusion.fuse([])
        self.assertEqual(result["parameters"], {})
        self.assertEqual(result["sourcesUsed"], [])


if __name__ == "__main__":
    unittest.main()
