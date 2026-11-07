"""Tests de prévision : seuils d'honnêteté, découpage chronologique, référence à battre."""
import math
import random
import unittest
from datetime import datetime, timedelta, timezone

from geoai import forecast

BASE = datetime(2026, 8, 1, tzinfo=timezone.utc)


def make_series(count, fn, step_days=1.0, start=BASE):
    return [
        {"at": (start + timedelta(days=step_days * i)).isoformat(), "value": round(fn(i), 4)}
        for i in range(count)
    ]


def noisy_series(count, fn, sigma=1.5, seed=7, step_days=1.0):
    rng = random.Random(seed)
    return [
        {
            "at": (BASE + timedelta(days=step_days * i)).isoformat(),
            "value": round(fn(i) + rng.gauss(0.0, sigma), 4),
        }
        for i in range(count)
    ]


class InsufficientDataTests(unittest.TestCase):
    """Règle : pas de prévision sans données réelles suffisantes."""

    def test_trop_peu_de_points_refuse_sans_deviner(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": make_series(6, lambda i: 30 + i)}
        )
        self.assertFalse(result["sufficient"])
        self.assertEqual(result["values"], [], "aucune valeur ne doit être produite")
        self.assertIsNone(result["evaluation"])
        self.assertIn(str(forecast.MIN_POINTS), result["reason"])

    def test_serie_trop_courte_dans_le_temps_refusee(self):
        # 20 points, mais sur 5 jours : aucune tendance n'est distinguable du bruit.
        series = make_series(20, lambda i: 30.0, step_days=0.25)
        result = forecast.forecast_soil({"parameter": "moisture", "series": series})
        self.assertFalse(result["sufficient"])
        self.assertEqual(result["values"], [])
        self.assertIn("jour", result["reason"])

    def test_serie_vide_refusee(self):
        result = forecast.forecast_soil({"parameter": "ph", "series": []})
        self.assertFalse(result["sufficient"])
        self.assertEqual(result["observationCount"], 0)

    def test_points_tous_corrompus_refuses(self):
        series = [{"at": (BASE + timedelta(days=i)).isoformat(), "value": None} for i in range(40)]
        result = forecast.forecast_soil({"parameter": "ph", "series": series})
        self.assertFalse(result["sufficient"])
        self.assertEqual(result["observationCount"], 0)
        self.assertEqual(result["rejectedPoints"], 40)

    def test_trop_peu_de_points_de_test_refuse(self):
        # 12 points : le tiers réservé ne laisse que 4 points, limite basse.
        borderline = forecast.forecast_soil(
            {"parameter": "ph", "series": make_series(12, lambda i: 6.0 + 0.01 * i)}
        )
        self.assertTrue(borderline["sufficient"])
        self.assertGreaterEqual(borderline["evaluation"]["testPoints"], forecast.MIN_TEST_POINTS)


class EntréesInvalidesTests(unittest.TestCase):
    def test_parametre_requis(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil({"series": make_series(20, lambda i: 30.0)})

    def test_series_doit_etre_une_liste(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil({"parameter": "ph", "series": "pas une liste"})

    def test_horizon_invalide(self):
        series = make_series(20, lambda i: 30.0)
        for horizon in (0, -3):
            with self.assertRaises(ValueError):
                forecast.forecast_soil({"parameter": "ph", "series": series, "horizonDays": horizon})

    def test_horizon_au_dela_d_une_campagne(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil(
                {"parameter": "ph", "series": make_series(20, lambda i: 30.0), "horizonDays": 900}
            )

    def test_pas_invalide(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil(
                {"parameter": "ph", "series": make_series(20, lambda i: 30.0), "stepDays": 0}
            )

    def test_point_sans_date_refuse(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil({"parameter": "ph", "series": [{"value": 6.5}]})

    def test_date_illisible_refusee(self):
        with self.assertRaises(ValueError):
            forecast.forecast_soil({"parameter": "ph", "series": [{"at": "hier", "value": 6.5}]})


class DécoupageChronologiqueTests(unittest.TestCase):
    """Règle : le découpage est chronologique, jamais aléatoire."""

    def test_le_decoupage_est_chronologique(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": make_series(40, lambda i: 40 - 0.3 * i)}
        )
        self.assertEqual(result["evaluation"]["split"], "chronological")
        self.assertEqual(result["evaluation"]["trainPoints"], 28)
        self.assertEqual(result["evaluation"]["testPoints"], 12)

    def test_la_frontiere_separe_reellement_le_passe_du_futur(self):
        series = make_series(40, lambda i: 40 - 0.3 * i)
        result = forecast.forecast_soil({"parameter": "moisture", "series": series})
        split_at = datetime.fromisoformat(result["evaluation"]["splitAt"].replace("Z", "+00:00"))
        # 28 points d'entraînement à 1 jour d'écart : le 28e point est le 27 août.
        self.assertEqual(split_at, BASE + timedelta(days=27))
        self.assertLess(split_at, BASE + timedelta(days=39), "le test porte bien sur la fin")

    def test_aucune_fuite_du_futur_dans_l_ajustement(self):
        """Une rupture brutale en fin de série ne doit pas influencer l'ajustement.

        Si le futur fuitait dans l'entraînement, la pente serait tirée vers le
        bas par la rupture et la prévision s'effondrerait.
        """
        series = make_series(40, lambda i: 40 - 0.3 * i)
        for i in range(28, 40):  # rupture sur le tiers de test uniquement
            series[i]["value"] = 5.0
        result = forecast.forecast_soil({"parameter": "moisture", "series": series, "horizonDays": 3})
        # La pente ajustée sur l'entraînement reste proche de -0,3.
        self.assertAlmostEqual(result["model"]["slopePerDay"], -0.3, delta=0.01)


class RéférenceÀBattreTests(unittest.TestCase):
    """Règle : la persistance est le modèle nul ; il faut faire strictement mieux."""

    def test_tendance_claire_bat_la_persistance(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": make_series(40, lambda i: 40 - 0.3 * i)}
        )
        evaluation = result["evaluation"]
        self.assertLess(evaluation["model"]["mae"], evaluation["baseline"]["mae"])
        self.assertTrue(evaluation["beatsBaseline"])
        self.assertGreater(evaluation["improvementPct"], 0)

    def test_serie_constante_ne_bat_pas_la_persistance(self):
        result = forecast.forecast_soil(
            {"parameter": "ph", "series": make_series(40, lambda i: 6.5)}
        )
        evaluation = result["evaluation"]
        self.assertEqual(result["model"]["slopePerDay"], 0.0)
        self.assertEqual(evaluation["model"]["mae"], evaluation["baseline"]["mae"])
        # À égalité, la méthode complexe n'apporte rien : pas de promotion.
        self.assertFalse(evaluation["beatsBaseline"])

    def test_bruit_pur_ne_bat_pas_la_persistance(self):
        rng = random.Random(3)
        series = [
            {"at": (BASE + timedelta(days=i)).isoformat(), "value": round(rng.gauss(30, 4), 4)}
            for i in range(80)
        ]
        result = forecast.forecast_soil({"parameter": "moisture", "series": series})
        self.assertFalse(
            result["evaluation"]["beatsBaseline"],
            "sur du bruit sans tendance, aucune méthode ne doit être déclarée meilleure",
        )

    def test_serie_bruitee_avec_tendance_est_battue(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": noisy_series(60, lambda i: 40 - 0.3 * i)}
        )
        evaluation = result["evaluation"]
        self.assertTrue(evaluation["beatsBaseline"])
        self.assertLess(evaluation["model"]["mae"], evaluation["baseline"]["mae"])


class ProjectionTests(unittest.TestCase):
    def test_la_projection_demarre_apres_la_derniere_observation(self):
        series = make_series(40, lambda i: 40 - 0.3 * i)
        result = forecast.forecast_soil({"parameter": "moisture", "series": series, "horizonDays": 5})
        last = datetime.fromisoformat(series[-1]["at"])
        first = datetime.fromisoformat(result["values"][0]["at"].replace("Z", "+00:00"))
        self.assertEqual(first, last + timedelta(days=1), "aucun point ne doit retomber dans l'historique")

    def test_la_projection_prolonge_la_tendance_reelle(self):
        series = make_series(40, lambda i: 40 - 0.3 * i)
        result = forecast.forecast_soil({"parameter": "moisture", "series": series, "horizonDays": 3})
        # Dernière observation 28,3 ; la droite perd 0,3 par jour.
        self.assertAlmostEqual(result["values"][0]["value"], 28.0, places=3)
        self.assertAlmostEqual(result["values"][2]["value"], 27.4, places=3)

    def test_le_pas_est_respecte(self):
        series = make_series(60, lambda i: 40 - 0.2 * i)
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": series, "horizonDays": 21, "stepDays": 7}
        )
        self.assertEqual(len(result["values"]), 3)
        dates = [datetime.fromisoformat(v["at"].replace("Z", "+00:00")) for v in result["values"]]
        self.assertEqual((dates[1] - dates[0]).days, 7)

    def test_la_tendance_est_amortie_au_dela_de_l_horizon_d_ajustement(self):
        series = make_series(60, lambda i: 40 - 1.0 * i)
        result = forecast.forecast_soil({"parameter": "moisture", "series": series, "horizonDays": 200})
        values = [v["value"] for v in result["values"]]
        deltas = [values[i] - values[i - 1] for i in range(1, len(values))]
        # Une droite non amortie garderait un pas constant de -1.
        self.assertLess(abs(deltas[-1]), abs(deltas[0]), "la pente doit s'amortir")
        self.assertGreater(abs(deltas[-1]), 0.0, "mais pas s'annuler brutalement")

    def test_intervalle_croissant_sur_serie_bruitee(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": noisy_series(60, lambda i: 40 - 0.3 * i), "horizonDays": 21, "stepDays": 7}
        )
        widths = [v["high"] - v["low"] for v in result["values"]]
        self.assertTrue(all(w > 0 for w in widths))
        self.assertLess(widths[0], widths[-1], "l'incertitude croît avec l'horizon")
        for value in result["values"]:
            self.assertLessEqual(value["low"], value["value"])
            self.assertGreaterEqual(value["high"], value["value"])

    def test_serie_sans_bruit_ne_pretend_pas_une_certitude(self):
        result = forecast.forecast_soil(
            {"parameter": "moisture", "series": make_series(40, lambda i: 40 - 0.3 * i), "horizonDays": 3}
        )
        for value in result["values"]:
            self.assertIsNone(value["low"])
            self.assertIsNone(value["high"])
        self.assertEqual(result["evaluation"]["residualStdTest"], 0.0)

    def test_points_corrompus_ecartes_mais_comptes(self):
        series = make_series(40, lambda i: 30 + 0.1 * i)
        for i in range(0, 40, 7):
            series[i]["value"] = None
        result = forecast.forecast_soil({"parameter": "ph", "series": series, "horizonDays": 2})
        self.assertTrue(result["sufficient"])
        self.assertEqual(result["rejectedPoints"], 6)
        self.assertEqual(result["observationCount"], 34)

    def test_dates_en_millisecondes_acceptees(self):
        """Le backend Node envoie des horodatages ; les deux conventions passent."""
        series = [
            {"at": int((BASE + timedelta(days=i)).timestamp() * 1000), "value": 40 - 0.3 * i}
            for i in range(40)
        ]
        result = forecast.forecast_soil({"parameter": "moisture", "series": series, "horizonDays": 2})
        self.assertTrue(result["sufficient"])
        self.assertTrue(result["values"][0]["at"].endswith("Z"))


class BacktestTests(unittest.TestCase):
    def test_le_backtest_ne_produit_pas_de_prevision(self):
        result = forecast.backtest(
            {"parameter": "moisture", "series": make_series(40, lambda i: 40 - 0.3 * i)}
        )
        self.assertNotIn("values", result)
        self.assertIsNotNone(result["evaluation"])

    def test_promotable_seulement_si_la_reference_est_battue(self):
        good = forecast.backtest(
            {"parameter": "moisture", "series": make_series(40, lambda i: 40 - 0.3 * i)}
        )
        self.assertTrue(good["promotable"])

        constant = forecast.backtest({"parameter": "ph", "series": make_series(40, lambda i: 6.5)})
        self.assertFalse(constant["promotable"])

        short = forecast.backtest({"parameter": "ph", "series": make_series(4, lambda i: 6.5)})
        self.assertFalse(short["promotable"])
        self.assertFalse(short["sufficient"])

    def test_le_backtest_refuse_les_memes_entrees_que_la_prevision(self):
        with self.assertRaises(ValueError):
            forecast.backtest({"series": make_series(20, lambda i: 30.0)})


if __name__ == "__main__":
    unittest.main()
