"""Tests de pédologie : triangle USDA, classes, contraintes, profil pondéré."""
import unittest

from geoai import soil


class TextureTests(unittest.TestCase):
    def test_triangle_usda_reference_points(self):
        cases = [
            ((92, 5, 3), "sable"),
            ((80, 15, 5), "sable limoneux"),
            ((65, 25, 10), "limon sableux"),
            ((40, 40, 20), "limon"),
            ((20, 65, 15), "limon fin"),
            ((55, 15, 30), "limon argilo-sableux"),
            ((33, 33, 34), "limon argileux"),
            ((10, 55, 35), "limon argileux fin"),
            ((55, 10, 35), "argile sableuse"),
            ((15, 45, 40), "argile limoneuse"),
            ((25, 25, 50), "argile"),
        ]
        for (sand, silt, clay), expected in cases:
            with self.subTest(expected=expected):
                result = soil.classify_texture(sand, silt, clay)
                self.assertEqual(result["class"], expected, (sand, silt, clay))
                self.assertTrue(result["classified"])

    def test_normalisation_et_groupe_hydrologique(self):
        result = soil.classify_texture(60, 30, 30)  # somme 120 → normalisée
        self.assertAlmostEqual(result["sand"] + result["silt"] + result["clay"], 100, places=1)
        self.assertIn(result["hydrologicGroup"], {"A", "B", "C", "D"})
        self.assertIsNotNone(result["waterHoldingMmPerCm"])

    def test_fractions_nulles_refusees(self):
        with self.assertRaises(ValueError):
            soil.classify_texture(0, 0, 0)


class ClassificationTests(unittest.TestCase):
    def test_ph(self):
        self.assertEqual(soil.classify_ph(5.7)["class"], "acide")
        self.assertEqual(soil.classify_ph(5.2)["class"], "très acide")
        self.assertEqual(soil.classify_ph(7.0)["class"], "neutre")
        self.assertEqual(soil.classify_ph(8.6)["class"], "alcalin")

    def test_matiere_organique_et_salinite(self):
        self.assertEqual(soil.classify_organic_matter(0.6)["class"], "très faible")
        self.assertEqual(soil.classify_organic_matter(4.0)["class"], "bonne")
        self.assertEqual(soil.classify_salinity(1.2)["class"], "modérément salé")


class ErosionTests(unittest.TestCase):
    def test_pente_forte_texture_fine_pluie_forte_donne_risque_eleve(self):
        result = soil.erosion_risk(18, "limon fin", 1600)
        self.assertEqual(result["level"], "élevé")
        self.assertEqual(len(result["factors"]), 3)
        self.assertTrue(all("contribution" in factor for factor in result["factors"]))

    def test_donnees_manquantes_ne_sont_pas_inventees(self):
        result = soil.erosion_risk(None, "sable", None)
        missing = [factor for factor in result["factors"] if factor.get("available") is False]
        self.assertEqual(len(missing), 2)
        self.assertEqual(result["level"], "faible")


class ConstraintsTests(unittest.TestCase):
    def test_contraintes_ordonnees_par_gravite(self):
        profile = {
            "texture": soil.classify_texture(20, 20, 60),
            "ph": soil.classify_ph(4.9),
            "salinity": soil.classify_salinity(1.9),
            "organicMatter": soil.classify_organic_matter(0.5),
        }
        limits = soil.constraints(profile, {"level": "élevé"})
        severities = [item["severity"] for item in limits]
        self.assertEqual(severities, sorted(severities, key=lambda value: {"forte": 0, "moyenne": 1}.get(value, 2)))
        self.assertTrue(all("reason" in item for item in limits))
        codes = {item["code"] for item in limits}
        self.assertIn("DRAINAGE_LIMITE", codes)
        self.assertIn("SALINITE", codes)
        self.assertIn("EROSION", codes)


class ProfileTests(unittest.TestCase):
    def test_profil_pondere_et_sans_donnee(self):
        empty = soil.build_profile([])
        self.assertFalse(empty["available"])
        self.assertIn("reason", empty)

        profile = soil.build_profile([
            {"sand": 30, "silt": 40, "clay": 30, "ph": 6.4, "organicMatter": 2.4, "ec": 0.15},
            {"sand": 34, "silt": 38, "clay": 28, "ph": 6.8, "organicMatter": 2.0, "ec": 0.18},
        ])
        self.assertTrue(profile["available"])
        self.assertEqual(profile["samplesUsed"], 2)
        self.assertAlmostEqual(profile["ph"]["value"], 6.6, places=1)
        self.assertEqual(profile["texture"]["source"], "lab")


if __name__ == "__main__":
    unittest.main()
