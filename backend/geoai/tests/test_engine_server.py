"""Tests de bout en bout du moteur (orchestrateur) et du service HTTP."""
import json
import threading
import unittest
import urllib.error
import urllib.request

import numpy as np

from geoai import server
from geoai.engine import analyze_plot

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[15.0, -4.0], [15.01, -4.0], [15.01, -3.99], [15.0, -3.99], [15.0, -4.0]]],
}


def bands(red=0.12, nir=0.48, size=8):
    return {
        "B2": np.full((size, size), 0.05).tolist(),
        "B3": np.full((size, size), 0.09).tolist(),
        "B4": np.full((size, size), red).tolist(),
        "B8": np.full((size, size), nir).tolist(),
        "B11": np.full((size, size), 0.22).tolist(),
        "SCL": np.full((size, size), 4.0).tolist(),
    }


def full_payload(**overrides):
    payload = {
        "plot": {
            "id": "plot_1",
            "geometry": SQUARE,
            "slopePct": 9.0,
            "rainfallMm": 1250,
            "sensorDepthCm": 30,
        },
        "samples": [
            {"depthCm": 0, "thicknessCm": 20, "sand": 48, "silt": 30, "clay": 22, "ph": 6.1, "organicMatter": 3.2, "ec": 0.12, "measuredAt": "2026-08-01T00:00:00Z", "source": "lab"},
            {"depthCm": 20, "thicknessCm": 30, "sand": 44, "silt": 28, "clay": 28, "ph": 6.4, "organicMatter": 2.1, "ec": 0.15, "measuredAt": "2026-08-01T00:00:00Z", "source": "lab"},
            {"depthCm": 50, "thicknessCm": 40, "sand": 30, "silt": 26, "clay": 44, "ph": 6.9, "organicMatter": 0.9, "ec": 0.2, "measuredAt": "2026-08-01T00:00:00Z", "source": "lab"},
            {"depthCm": 90, "thicknessCm": 30, "sand": 28, "silt": 24, "clay": 48, "ph": 7.1, "organicMatter": 0.5, "ec": 0.22, "measuredAt": "2026-08-01T00:00:00Z", "source": "lab"},
        ],
        "sensors": {
            "moisture": [
                {"at": f"2026-09-{day:02d}T06:00:00Z", "value": value}
                for day, value in zip(range(1, 9), [24.0, 24.4, 24.1, 24.6, 24.2, 24.9, 24.3, 24.5])
            ]
        },
        "scenes": [
            {"scene": {"id": "S2-1", "capturedAt": "2026-09-01T10:00:00Z", "resolutionM": 10}, "bands": bands()},
            {"scene": {"id": "S2-2", "capturedAt": "2026-09-11T10:00:00Z", "resolutionM": 10}, "bands": bands(red=0.10, nir=0.52)},
        ],
        "series": [
            {"date": f"2026-{month:02d}-15", "ndvi": value}
            for month, value in zip(range(4, 10), [0.28, 0.45, 0.63, 0.70, 0.52, 0.31])
        ],
        "imagery": {
            "camera": {"pixels": np.dstack([
                np.full((40, 40), 150.0),
                np.full((40, 40), 120.0),
                np.full((40, 40), 80.0),
            ]).tolist()}
        },
        "declared": {"clay": 20, "ph": 5.9},
    }
    payload.update(overrides)
    return payload


class EngineTests(unittest.TestCase):
    def test_diagnostic_complet(self):
        result = analyze_plot(full_payload())
        self.assertEqual(result["plotId"], "plot_1")
        self.assertGreater(result["areaHa"], 100)
        self.assertTrue(result["soil"]["available"])
        self.assertIn(result["soil"]["texture"]["class"], {"limon", "limon argileux", "limon sableux"})
        self.assertTrue(result["subsoil"]["available"])
        self.assertGreaterEqual(len(result["subsoil"]["horizons"]), 2)
        self.assertEqual(result["satellite"]["scenesAnalyzed"], 2)
        self.assertAlmostEqual(result["satellite"]["latest"]["indices"]["ndvi"]["mean"], 0.6774, places=3)
        self.assertTrue(result["satellite"]["phenology"]["available"])
        self.assertTrue(result["sensors"]["moisture"]["available"])
        self.assertIn("clay", result["fusion"]["parameters"])
        self.assertEqual(result["fusion"]["parameters"]["clay"]["source"], "lab")
        self.assertIn(result["confidence"]["level"], {"faible", "moyenne", "élevée"})
        self.assertEqual(result["recommendations"], [])
        self.assertIn("certification", result["disclaimer"])

    def test_prescriptions_desactivees_par_defaut(self):
        result = analyze_plot(full_payload())
        self.assertTrue(any("Recommandations désactivées" in caveat for caveat in result["caveats"]))

    def test_sans_prelevement_le_diagnostic_reste_honnete(self):
        result = analyze_plot(full_payload(samples=[], declared={}))
        self.assertFalse(result["soil"]["available"])
        self.assertIn("Aucun prélèvement", " ".join(result["caveats"]))
        self.assertLess(result["confidence"]["score"], 0.6)
        self.assertIn("sol", result["confidence"]["missing"])

    def test_scene_illisible_n_annule_pas_le_diagnostic(self):
        payload = full_payload()
        payload["scenes"] = [{"scene": {"id": "KO"}, "bands": {"B4": [[0.1]]}}]
        result = analyze_plot(payload)
        self.assertEqual(len(result["satellite"]["errors"]), 1)
        self.assertTrue(result["soil"]["available"])

    def test_capteur_bloque_signale(self):
        payload = full_payload()
        payload["sensors"]["moisture"] = [
            {"at": f"2026-09-{day:02d}T06:00:00Z", "value": 22.0} for day in range(1, 10)
        ]
        result = analyze_plot(payload)
        self.assertTrue(result["sensors"]["moisture"]["stuckSensor"])
        self.assertTrue(any("bloqué" in caveat for caveat in result["caveats"]))

    def test_conflit_declare_versus_laboratoire(self):
        payload = full_payload()
        payload["declared"] = {"clay": 8}  # très loin du laboratoire (≈ 31)
        result = analyze_plot(payload)
        self.assertTrue(result["fusion"]["conflicts"])
        self.assertEqual(result["fusion"]["conflicts"][0]["parameter"], "clay")

    def test_imagerie_invalide_capturee(self):
        payload = full_payload(imagery={"camera": {}})
        result = analyze_plot(payload)
        self.assertFalse(result["imagery"]["camera"]["available"])
        self.assertTrue(result["soil"]["available"])


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = server.create_server("127.0.0.1", 0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, payload=None, method="POST", headers=None):
        url = f"http://127.0.0.1:{self.port}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_health(self):
        status, body = self.request("/health", method="GET")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")

    def test_meta_expose_les_méthodes(self):
        status, body = self.request("/v1/meta", method="GET")
        self.assertEqual(status, 200)
        self.assertEqual(body["sourcePriority"][0], "lab")
        self.assertIn("/v1/soil/analyze", body["endpoints"])

    def test_texture(self):
        status, body = self.request("/v1/soil/texture", {"sand": 40, "silt": 40, "clay": 20})
        self.assertEqual(status, 200)
        self.assertEqual(body["class"], "limon")

    def test_analyse_complete(self):
        status, body = self.request("/v1/soil/analyze", full_payload())
        self.assertEqual(status, 200)
        self.assertTrue(body["soil"]["available"])

    def test_payload_invalide_422(self):
        status, body = self.request("/v1/soil/texture", {"sand": 0, "silt": 0, "clay": 0})
        self.assertEqual(status, 422)
        self.assertEqual(body["error"]["code"], "invalid_payload")

    def test_champ_manquant_422(self):
        status, body = self.request("/v1/soil/texture", {"sand": 40})
        self.assertEqual(status, 422)
        self.assertEqual(body["error"]["code"], "missing_field")

    def test_route_inconnue_404(self):
        status, body = self.request("/v1/unknown", {})
        self.assertEqual(status, 404)

    def test_json_invalide_422(self):
        url = f"http://127.0.0.1:{self.port}/v1/soil/texture"
        request = urllib.request.Request(url, data=b"{not json", method="POST", headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(request, timeout=5)
            self.fail("une requête invalide doit échouer")
        except urllib.error.HTTPError as error:
            self.assertEqual(error.code, 422)

    def test_jeton_interne(self):
        previous = server.TOKEN
        server.TOKEN = "secret-test"
        try:
            status, _ = self.request("/v1/soil/texture", {"sand": 40, "silt": 40, "clay": 20})
            self.assertEqual(status, 401)
            status, _ = self.request(
                "/v1/soil/texture",
                {"sand": 40, "silt": 40, "clay": 20},
                headers={"X-GeoAI-Token": "secret-test"},
            )
            self.assertEqual(status, 200)
        finally:
            server.TOKEN = previous


if __name__ == "__main__":
    unittest.main()
