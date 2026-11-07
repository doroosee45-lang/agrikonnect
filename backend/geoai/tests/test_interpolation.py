"""Tests du krigeage ordinaire — phase 6.

Trois exigences du cahier des charges sont vérifiées ici, chacune par un test
dédié :

  * au moins trois sondes produisent une carte **avec incertitude** ;
  * une valeur aberrante est signalée **avec son motif** ;
  * **chaque nombre** cité dans un motif existe dans les données rendues.

S'y ajoutent les garde-fous : refus explicite en dessous des seuils, absence de
fuite dans la validation croisée, et absence de dépassement au-delà des valeurs
mesurées.
"""

import math
import unittest

from geoai.interpolation import (
    MAX_CELLS,
    MIN_DISTINCT_LOCATIONS,
    MIN_POINTS,
    MIN_SPREAD_M,
    OUTLIER_Z,
    InsufficientData,
    interpolate_grid,
    leave_one_out,
)

BASE_LON = 18.25
BASE_LAT = 0.048
DEG_M = 0.001  # ~111 m


def grid_points(rows=3, cols=3, bad=None, bad_value=9.9, noise=0.0, seed=1):
    """Champ linéaire connu : pH = 6.0 + 0.01 * (distance est en m) / 100."""
    import random

    rng = random.Random(seed)
    points = []
    for row in range(rows):
        for col in range(cols):
            value = 6.0 + 0.01 * (col * 111.0) / 100.0
            if bad is not None and (row, col) == bad:
                value = bad_value
            if noise:
                value += rng.gauss(0.0, noise)
            points.append({
                "id": f"s{row}{col}",
                "coordinates": [round(BASE_LON + col * DEG_M, 6), round(BASE_LAT + row * DEG_M, 6)],
                "value": round(value, 4),
                "source": "measured_sensor",
            })
    return points


class TestSuffisanceDesDonnees(unittest.TestCase):
    """Le moteur refuse d'interpoler sans support spatial réel."""

    def test_moins_de_trois_points_est_refuse(self):
        with self.assertRaises(InsufficientData) as caught:
            interpolate_grid({"parameter": "ph", "points": grid_points()[:2]})
        self.assertIn(str(MIN_POINTS), str(caught.exception))

    def test_trois_points_suffisent(self):
        # La borne basse doit fonctionner, pas seulement le cas confortable.
        points = grid_points()[:3]
        result = interpolate_grid({"parameter": "ph", "points": points})
        self.assertTrue(result["sufficient"])
        self.assertEqual(result["diagnostics"]["pointCount"], 3)
        self.assertGreater(result["grid"]["cellCount"], 0)

    def test_points_confondus_sont_refuses(self):
        coincident = [
            {"id": "a", "coordinates": [BASE_LON, BASE_LAT], "value": 6.0},
            {"id": "b", "coordinates": [BASE_LON, BASE_LAT], "value": 6.1},
            {"id": "c", "coordinates": [BASE_LON, BASE_LAT], "value": 6.2},
        ]
        with self.assertRaises(InsufficientData) as caught:
            interpolate_grid({"parameter": "ph", "points": coincident})
        self.assertIn(str(MIN_DISTINCT_LOCATIONS), str(caught.exception))

    def test_une_etendue_trop_faible_est_refusee(self):
        # Trois emplacements distincts (2,2 m d'écart, au-dessus du seuil de
        # fusion) mais une étendue totale de 4,4 m : ils décrivent un point,
        # pas une parcelle. L'écart est choisi pour que ce soit bien le test
        # d'étendue qui se déclenche, et non celui des emplacements confondus.
        step = 2e-5  # ~2,2 m
        tiny = [
            {"id": "a", "coordinates": [BASE_LON, BASE_LAT], "value": 6.0},
            {"id": "b", "coordinates": [BASE_LON + step, BASE_LAT], "value": 6.1},
            {"id": "c", "coordinates": [BASE_LON + 2 * step, BASE_LAT], "value": 6.2},
        ]
        with self.assertRaises(InsufficientData) as caught:
            interpolate_grid({"parameter": "ph", "points": tiny})
        self.assertIn(str(MIN_SPREAD_M), str(caught.exception))

    def test_points_invalides_sont_comptes_et_motives(self):
        points = grid_points() + [
            {"id": "x1", "coordinates": None, "value": 6.0},
            {"id": "x2", "coordinates": [BASE_LON, BASE_LAT], "value": "abc"},
            {"id": "x3", "coordinates": [999.0, BASE_LAT], "value": 6.0},
        ]
        result = interpolate_grid({"parameter": "ph", "points": points})
        rejected = result["diagnostics"]["rejectedPoints"]
        self.assertEqual(len(rejected), 3, "un point rejeté n'est jamais ignoré en silence")
        self.assertEqual(result["diagnostics"]["pointCount"], 9)
        reasons = {entry["id"]: entry["reason"] for entry in rejected}
        self.assertIn("coordonnées", reasons["x1"])
        self.assertIn("numérique", reasons["x2"])
        self.assertIn("hors du monde", reasons["x3"])

    def test_points_confondus_distincts_sont_moyennes_et_signales(self):
        points = grid_points() + [
            # Même emplacement que s00, valeur différente : moyenné, pas choisi.
            {"id": "doublon", "coordinates": [BASE_LON, BASE_LAT], "value": 8.0},
        ]
        result = interpolate_grid({"parameter": "ph", "points": points})
        self.assertEqual(result["diagnostics"]["locationCount"], 9)
        self.assertTrue(result["diagnostics"]["mergedLocations"], "la fusion doit être déclarée")


class TestQualiteDeLaCarte(unittest.TestCase):
    """Une carte interpolée doit être cohérente avec les mesures qui la fondent."""

    def setUp(self):
        self.points = grid_points(noise=0.03, seed=11)
        self.result = interpolate_grid({"parameter": "ph", "points": self.points, "resolutionM": 20})

    def test_la_methode_et_l_incertitude_sont_declarees(self):
        self.assertEqual(self.result["method"], "ordinary-kriging")
        self.assertEqual(self.result["uncertainty"], "kriging-standard-deviation")

    def test_chaque_cellule_porte_une_valeur_et_un_ecart_type(self):
        for cell in self.result["grid"]["cells"]:
            self.assertIn("value", cell)
            self.assertIn("sd", cell)
            self.assertGreaterEqual(cell["sd"], 0.0, "un écart-type négatif n'a pas de sens")
            self.assertTrue(math.isfinite(cell["value"]))

    def test_l_incertitude_croit_en_s_eloignant_des_sondes(self):
        # Exactitude aux points de mesure : la variance de krigeage y est nulle.
        probe = self.points[0]["coordinates"]
        closest = min(
            self.result["grid"]["cells"],
            key=lambda c: (c["lon"] - probe[0]) ** 2 + (c["lat"] - probe[1]) ** 2,
        )
        self.assertLess(closest["sd"], self.result["grid"]["sdMax"])
        self.assertGreater(self.result["grid"]["sdMax"], 0.0, "l'incertitude doit être informative")

    def test_la_grille_ne_depasse_pas_les_valeurs_mesurees(self):
        # Le krigeage interpole, il n'extrapole pas : aucune cellule ne doit
        # sortir de l'étendue observée, sous peine d'inventer un sol impossible.
        values = [cell["value"] for cell in self.result["grid"]["cells"]]
        self.assertGreaterEqual(min(values), self.result["observed"]["min"] - 1e-9)
        self.assertLessEqual(max(values), self.result["observed"]["max"] + 1e-9)

    def test_le_variogramme_est_ajuste_sur_les_donnees(self):
        variogram = self.result["diagnostics"]["variogram"]
        self.assertEqual(variogram["model"], "exponential")
        self.assertGreater(variogram["sill"], 0.0)
        self.assertGreater(variogram["rangeM"], 0.0)
        self.assertTrue(variogram["empirical"], "le variogramme empirique doit être rendu")

    def test_les_sources_des_mesures_sont_rendues(self):
        points = grid_points()
        points[0]["source"] = "measured_lab"
        result = interpolate_grid({"parameter": "ph", "points": points})
        self.assertEqual(result["sources"], ["measured_lab", "measured_sensor"])


class TestValidationCroisee(unittest.TestCase):
    """« Laisser une sonde dehors » : la seule évaluation honnête disponible."""

    def test_erreur_faible_sur_un_champ_lineaire(self):
        result = interpolate_grid({"parameter": "ph", "points": grid_points()})
        cross = result["crossValidation"]
        self.assertEqual(cross["method"], "leave-one-probe-out")
        self.assertEqual(cross["n"], 9)
        self.assertLess(cross["mae"], 0.01, "un champ linéaire doit être presque exactement reconstruit")
        # Non-biaisé : propriété fondamentale du krigeage ordinaire.
        self.assertLess(abs(cross["meanError"]), 1e-6)

    def test_chaque_sonde_est_evaluee_avec_ses_nombres(self):
        result = interpolate_grid({"parameter": "ph", "points": grid_points()})
        for entry in result["crossValidation"]["details"]:
            if entry.get("skipped"):
                self.assertIn("reason", entry, "un point sauté doit en donner le motif")
                continue
            for field in ("id", "observed", "predicted", "error", "absError", "stdDev", "standardizedError"):
                self.assertIn(field, entry, f"champ {field} manquant")
            self.assertAlmostEqual(
                entry["error"], entry["observed"] - entry["predicted"], places=5,
            )

    def test_aucune_fuite_de_la_sonde_retiree(self):
        """
        La sonde évaluée ne doit pas servir à sa propre prédiction.

        S'il y avait fuite, l'erreur serait exactement nulle pour chaque point.
        On injecte une valeur aberrante : avec fuite son erreur serait 0, sans
        fuite elle est grande. C'est le test qui distingue les deux.
        """
        result = interpolate_grid({"parameter": "ph", "points": grid_points(bad=(1, 1), bad_value=9.9)})
        detail = next(
            entry for entry in result["crossValidation"]["details"] if entry.get("id") == "s11"
        )
        self.assertGreater(detail["absError"], 1.0, "la sonde retirée n'a pas servi à sa prédiction")
        self.assertAlmostEqual(detail["observed"], 9.9)

    def test_le_endpoint_loo_seul_rend_la_meme_evaluation(self):
        points = grid_points(noise=0.02, seed=3)
        grid_result = interpolate_grid({"parameter": "ph", "points": points})
        loo_result = leave_one_out({"parameter": "ph", "points": points})

        self.assertTrue(loo_result["sufficient"])
        self.assertNotIn("grid", loo_result, "le endpoint d'évaluation ne produit pas de carte")
        self.assertEqual(
            loo_result["crossValidation"]["mae"],
            grid_result["crossValidation"]["mae"],
            "les deux points d'entrée doivent évaluer de façon identique",
        )


class TestValeursAberrantes(unittest.TestCase):
    """Une valeur aberrante est signalée avec son motif chiffré."""

    def test_aucune_aberration_sur_un_champ_propre(self):
        result = interpolate_grid({"parameter": "ph", "points": grid_points(noise=0.02, seed=5)})
        self.assertEqual(result["outliers"], [])
        self.assertEqual(result["outlierThresholdZ"], OUTLIER_Z)

    def test_une_mesure_isolee_est_signalee(self):
        result = interpolate_grid({"parameter": "ph", "points": grid_points(bad=(1, 1), bad_value=9.9)})
        self.assertEqual(len(result["outliers"]), 1)
        outlier = result["outliers"][0]
        self.assertEqual(outlier["id"], "s11")
        self.assertGreaterEqual(outlier["standardizedError"], OUTLIER_Z)
        self.assertEqual(outlier["threshold"], OUTLIER_Z)

    def test_le_motif_cite_la_mesure_la_prediction_et_le_seuil(self):
        result = interpolate_grid({"parameter": "ph", "points": grid_points(bad=(1, 1), bad_value=9.9)})
        reason = result["outliers"][0]["reason"]
        self.assertIn("9.9", reason, "la mesure observée")
        self.assertIn(str(OUTLIER_Z), reason, "le seuil appliqué")
        self.assertIn("incertitude locale", reason)

    def test_chaque_nombre_du_motif_existe_dans_les_donnees(self):
        """
        Exigence du CDC : tout nombre de l'explication doit exister dans les
        données du moteur. On extrait les nombres du motif et on vérifie que
        chacun correspond à un champ rendu — sinon le motif invente.
        """
        result = interpolate_grid({"parameter": "ph", "points": grid_points(bad=(1, 1), bad_value=9.9)})
        outlier = result["outliers"][0]
        reason = outlier["reason"]

        numbers = {
            float(token.replace(",", "."))
            for token in reason.replace("(", " ").replace(")", " ").replace(",", " ").split()
            if token.replace(".", "").replace("-", "").isdigit()
        }
        self.assertTrue(numbers, "le motif doit contenir des nombres à vérifier")

        allowed = {
            float(outlier[field])
            for field in ("observed", "predicted", "error", "stdDev", "standardizedError", "threshold")
        }
        for number in numbers:
            self.assertTrue(
                any(abs(number - value) < 1e-6 for value in allowed),
                f"le nombre {number} du motif ne correspond à aucune donnée rendue ({sorted(allowed)})",
            )

    def test_une_heterogeneite_naturelle_n_est_pas_une_aberration(self):
        # Un champ fortement contrasté mais régulier ne doit pas produire de
        # fausses alertes : le seuil est standardisé par l'incertitude locale.
        points = grid_points(rows=4, cols=4, noise=0.15, seed=17)
        result = interpolate_grid({"parameter": "ph", "points": points})
        self.assertLessEqual(len(result["outliers"]), 1)


class TestGrilleEtEntrees(unittest.TestCase):
    """Contrôle de la charge utile et refus des entrées invalides."""

    def test_la_bbox_est_respectee(self):
        points = grid_points()
        bbox = [BASE_LON - 0.001, BASE_LAT - 0.001, BASE_LON + 0.003, BASE_LAT + 0.003]
        result = interpolate_grid({"parameter": "ph", "points": points, "bbox": bbox, "resolutionM": 20})
        self.assertEqual(result["grid"]["bbox"], bbox)
        for cell in result["grid"]["cells"]:
            self.assertGreaterEqual(cell["lon"], bbox[0] - 1e-9)
            self.assertLessEqual(cell["lon"], bbox[2] + 1e-9)
            self.assertGreaterEqual(cell["lat"], bbox[1] - 1e-9)
            self.assertLessEqual(cell["lat"], bbox[3] + 1e-9)

    def test_une_bbox_invalide_est_refusee(self):
        points = grid_points()
        with self.assertRaises(ValueError):
            interpolate_grid({"parameter": "ph", "points": points, "bbox": [1, 2, 3]})
        with self.assertRaises(ValueError):
            # ouest >= est
            interpolate_grid({"parameter": "ph", "points": points, "bbox": [0.05, 0.04, 0.04, 0.05]})

    def test_le_plafond_de_cellules_epaissit_la_grille_sans_la_tronquer(self):
        points = grid_points()
        result = interpolate_grid({"parameter": "ph", "points": points, "resolutionM": 0.5})
        self.assertLessEqual(result["grid"]["cellCount"], MAX_CELLS)
        self.assertGreater(result["grid"]["resolutionM"], 0.5, "la résolution effective est déclarée")
        self.assertEqual(result["grid"]["requestedResolutionM"], 0.5, "la demande d'origine reste lisible")
        # La couverture reste complète : la carte n'est pas amputée.
        self.assertEqual(result["grid"]["cellCount"], result["grid"]["columns"] * result["grid"]["rows"])

    def test_une_resolution_nulle_est_refusee(self):
        with self.assertRaises(ValueError):
            interpolate_grid({"parameter": "ph", "points": grid_points(), "resolutionM": 0})

    def test_un_parametre_absent_est_refuse(self):
        with self.assertRaises(ValueError):
            interpolate_grid({"points": grid_points()})
        with self.assertRaises(ValueError):
            interpolate_grid({"parameter": "   ", "points": grid_points()})

    def test_des_points_non_liste_sont_refuses(self):
        with self.assertRaises(ValueError):
            interpolate_grid({"parameter": "ph", "points": "pas-une-liste"})

    def test_un_champ_constant_est_signale_comme_tel(self):
        points = [
            {"id": f"c{i}", "coordinates": [BASE_LON + i * DEG_M, BASE_LAT], "value": 6.5}
            for i in range(4)
        ]
        result = interpolate_grid({"parameter": "ph", "points": points})
        self.assertTrue(result["diagnostics"]["variogram"]["constant"])
        for cell in result["grid"]["cells"]:
            self.assertAlmostEqual(cell["value"], 6.5, places=6, msg="un champ constant se reproduit")


if __name__ == "__main__":
    unittest.main()
