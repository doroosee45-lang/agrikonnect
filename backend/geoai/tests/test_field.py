"""Tests de terrain : horizons de sous-sol et qualité des séries de capteurs."""
import unittest
from datetime import datetime, timedelta, timezone

from geoai import config, sensors, subsurface


def sample(depth, clay, sand=40, om=2.0, ph=6.4, **extra):
    return {
        "depthCm": depth,
        "thicknessCm": extra.pop("thicknessCm", 20),
        "clay": clay,
        "sand": sand,
        "silt": max(0.0, 100 - clay - sand),
        "organicMatter": om,
        "ph": ph,
        "source": "lab",
        "measuredAt": "2026-08-15T00:00:00Z",
        **extra,
    }


class SubsurfaceTests(unittest.TestCase):
    def profile_samples(self):
        return [
            sample(0, clay=18, sand=50, om=3.4, ph=6.2),
            sample(20, clay=22, sand=46, om=2.6, ph=6.3),
            sample(40, clay=38, sand=28, om=1.2, ph=6.6),
            sample(60, clay=42, sand=24, om=0.8, ph=6.8),
            sample(90, clay=44, sand=22, om=0.5, ph=7.0),
        ]

    def test_horizons_segmentes_sur_rupture_d_argile(self):
        result = subsurface.profile(self.profile_samples())
        self.assertTrue(result["available"])
        self.assertGreaterEqual(len(result["horizons"]), 2)
        top = result["horizons"][0]
        self.assertEqual(top["topCm"], 0)
        self.assertAlmostEqual(top["bottomCm"], 40, delta=1)
        self.assertTrue(top["texture"])
        self.assertEqual(result["rootZone"]["depthCm"], 30)
        self.assertGreater(result["depthCoveredCm"], 100)

    def test_horizons_ordonnes_et_contigus(self):
        result = subsurface.profile(self.profile_samples())
        horizons = result["horizons"]
        for previous, current in zip(horizons, horizons[1:]):
            self.assertLessEqual(previous["bottomCm"], current["topCm"] + 0.01)
        self.assertTrue(all(h["source"] == "lab" for h in horizons))

    def test_decroissance_matiere_organique(self):
        decay = subsurface.organic_matter_decay(self.profile_samples())
        self.assertTrue(decay["available"])
        self.assertGreater(decay["decayPerCm"], 0)
        self.assertIsNotNone(decay["halfLifeCm"])
        self.assertGreater(decay["rSquared"], 0.5)

    def test_substratum_detecte(self):
        samples = self.profile_samples() + [{"depthCm": 120, "thicknessCm": 10, "lithology": "roche", "bedrock": True, "sand": 0, "clay": 0, "silt": 0}]
        result = subsurface.profile(samples)
        self.assertTrue(result["horizons"][-1]["isBedrock"])
        self.assertIsNone(result["horizons"][-1]["bottomCm"])
        self.assertEqual(result["depthToBedrock"]["valueCm"], 120)
        self.assertTrue(result["depthToBedrock"]["confident"])

    def test_substratum_non_atteint_n_est_pas_invente(self):
        result = subsurface.profile(self.profile_samples())
        self.assertIsNone(result["depthToBedrock"]["valueCm"])
        self.assertFalse(result["depthToBedrock"]["confident"])
        self.assertIn("searchedDepthCm", result["depthToBedrock"])
        self.assertTrue(any("substratum" in caveat for caveat in result["caveats"]))

    def test_aucun_prelevement(self):
        result = subsurface.profile([])
        self.assertFalse(result["available"])
        self.assertEqual(result["horizons"], [])

    def test_moins_de_trois_mesures_mo_pas_de_regression(self):
        decay = subsurface.organic_matter_decay([sample(0, 20, om=3.0), sample(20, 20, om=2.0)])
        self.assertFalse(decay["available"])
        self.assertIn("3", decay["reason"])


def readings(values, start="2026-09-01T00:00:00Z", step_hours=6):
    origin = datetime.fromisoformat(start.replace("Z", "+00:00"))
    return [
        {"at": (origin + timedelta(hours=index * step_hours)).isoformat(), "value": value}
        for index, value in enumerate(values)
    ]


class SensorTests(unittest.TestCase):
    def test_serie_propre(self):
        result = sensors.quality(readings([24.0, 24.5, 24.2, 24.8, 24.4, 24.6]), depth_cm=30)
        self.assertTrue(result["available"])
        self.assertEqual(result["outliers"], 0)
        self.assertFalse(result["stuckSensor"])
        self.assertFalse(result["drift"]["detected"])
        self.assertAlmostEqual(result["mean"], 24.42, delta=0.1)
        # 24,42 % sur 30 cm de sol → 73,3 mm d'eau
        self.assertAlmostEqual(result["waterStorageMm"], 73.3, delta=1.0)

    def test_valeur_aberrante_detectee(self):
        result = sensors.quality(readings([24.0, 24.4, 24.2, 99.0, 24.6, 24.1]))
        self.assertEqual(result["outliers"], 1)
        self.assertLess(result["mean"], 30)
        self.assertIn(3, result["outlierIndices"])

    def test_capteur_bloque(self):
        result = sensors.quality(readings([25.0] * 8))
        self.assertTrue(result["stuckSensor"])
        self.assertLess(result["confidence"], 1.0)

    def test_trous_signales(self):
        values = [24.0, 24.2, 24.4, 24.6]
        series = readings(values)
        series.append({"at": "2026-09-05T00:00:00Z", "value": 24.3})  # trou de plusieurs jours
        result = sensors.quality(series)
        self.assertGreaterEqual(len(result["gaps"]), 1)
        self.assertIn("from", result["gaps"][0])

    def test_derive_detectee(self):
        values = [20 + index * 1.5 for index in range(12)]
        result = sensors.quality(readings(values, step_hours=24))
        self.assertTrue(result["drift"]["detected"])
        self.assertGreater(result["drift"]["perDay"], 0)

    def test_valeurs_non_numeriques_ignorees(self):
        series = readings([24.0, 24.2, 24.4, 24.6])
        series.append({"at": "2026-09-02T00:00:00Z", "value": "n/a"})
        series.append({"value": 30})
        result = sensors.quality(series)
        self.assertEqual(result["readings"], 4)

    def test_serie_vide(self):
        result = sensors.quality([])
        self.assertFalse(result["available"])

    def test_calibration(self):
        result = sensors.calibrate(readings([10.0, 20.0]), offset=1.5, gain=2.0)
        self.assertEqual([reading["value"] for reading in result["readings"]], [21.5, 41.5])
        self.assertEqual(result["calibration"]["gain"], 2.0)


if __name__ == "__main__":
    unittest.main()


class AnomalyIdentificationTests(unittest.TestCase):
    """
    Les identifiants renvoyés, et non les seuls indices.

    `points` est filtré puis trié par date : un appelant qui reconstruirait
    l'ordre depuis `outlierIndices` signalerait les mauvaises mesures. Ces tests
    fixent le comportement sur une entrée délibérément hostile — mélangée, avec
    des entrées non numériques et non datées.
    """

    def _serie(self):
        return [
            {"id": "r_4", "at": "2026-09-04T00:00:00Z", "value": 24.6},
            {"id": "r_1", "at": "2026-09-01T00:00:00Z", "value": 24.0},
            {"id": "r_bad", "at": "2026-09-05T00:00:00Z", "value": "pas-un-nombre"},
            {"id": "r_3", "at": "2026-09-03T00:00:00Z", "value": 99.0},
            {"id": "r_2", "at": "2026-09-02T00:00:00Z", "value": 24.4},
            {"id": "r_nodate", "value": 24.5},
            {"id": "r_5", "at": "2026-09-05T00:00:00Z", "value": 24.1},
        ]

    def test_l_identifiant_de_la_mesure_aberrante_est_le_bon(self):
        result = sensors.quality(self._serie())
        self.assertTrue(result["available"])
        self.assertEqual(result["outliers"], 1)
        self.assertEqual(result["outlierReadingIds"], ["r_3"])
        # `r_3` est en 4e position dans l'entrée mais 3e après tri : l'indice seul
        # aurait désigné une autre mesure.
        self.assertNotIn("r_4", result["outlierReadingIds"])

    def test_les_identifiants_absents_ne_produisent_pas_de_trou_silencieux(self):
        sans_ids = [{"at": r["at"], "value": r["value"]} for r in self._serie() if "at" in r]
        result = sensors.quality(sans_ids)
        self.assertEqual(result["outliers"], 1)
        self.assertEqual(result["outlierReadingIds"], [], "sans identifiant, rien à renvoyer")

    def test_la_plage_figee_est_identifiee(self):
        serie = [
            {"id": f"s_{index}", "at": f"2026-09-0{index + 1}T00:00:00Z", "value": value}
            for index, value in enumerate([24.0, 25.0, 25.0, 25.0, 25.0, 25.0, 26.0])
        ]
        result = sensors.quality(serie)
        self.assertTrue(result["stuckSensor"])
        self.assertEqual(result["stuckReadingIds"], ["s_1", "s_2", "s_3", "s_4", "s_5"])

    def test_les_seuils_sont_surchargeables(self):
        serie = readings([24.0, 24.4, 24.2, 27.0, 24.6, 24.1])
        strict = sensors.quality(serie, mad_z_limit=1.5)
        large = sensors.quality(serie, mad_z_limit=20.0)
        self.assertGreater(strict["outliers"], large["outliers"])
        self.assertEqual(large["outliers"], 0, "un seuil très large ne signale rien")

    def test_les_seuils_appliques_sont_renvoyes(self):
        result = sensors.quality(
            readings([24.0, 24.5, 24.2]),
            mad_z_limit=4.2,
            stuck_min_points=7,
            stuck_epsilon=0.5,
            gap_factor=3.0,
        )
        self.assertEqual(result["thresholdsUsed"]["madZLimit"], 4.2)
        self.assertEqual(result["thresholdsUsed"]["stuckMinPoints"], 7)
        self.assertEqual(result["thresholdsUsed"]["stuckEpsilon"], 0.5)
        self.assertEqual(result["thresholdsUsed"]["gapFactor"], 3.0)

    def test_sans_surcharge_les_valeurs_du_moteur_sont_utilisees(self):
        result = sensors.quality(readings([24.0, 24.5, 24.2]))
        self.assertEqual(result["thresholdsUsed"]["madZLimit"], config.MAD_Z_LIMIT)
        self.assertEqual(result["thresholdsUsed"]["stuckMinPoints"], config.STUCK_MIN_POINTS)
