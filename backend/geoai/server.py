"""Service HTTP du moteur géospatial (bibliothèque standard uniquement).

Lancement :
    python3 geoai/server.py --port 8100

Le backend Node appelle ce service en interne (réseau privé). Si `GEOAI_TOKEN`
est défini, chaque requête doit porter l'en-tête `X-GeoAI-Token`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

if __package__ in (None, ""):  # exécution directe : `python3 geoai/server.py`
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from geoai import (  # noqa: E402
    __version__,
    config,
    forecast,
    fusion,
    imagery,
    interpolation,
    sensors,
    soil,
    spectral,
    subsurface,
)
from geoai.engine import analyze_plot  # noqa: E402

MAX_BODY_BYTES = 12 * 1024 * 1024  # 12 Mo : scènes satellite multi-bandes incluses
TOKEN = os.environ.get("GEOAI_TOKEN")


def _texture(payload: dict[str, Any]) -> dict[str, Any]:
    return soil.classify_texture(payload["sand"], payload.get("silt", 0.0), payload["clay"])


def _quality(payload: dict[str, Any]) -> dict[str, Any]:
    """Qualité d'une série de mesures.

    Les seuils viennent du payload quand ils sont fournis : leur source de
    vérité déclarée est le fichier de configuration matériel du backend, pas
    `config.py`. Un seuil absent retombe sur la valeur par défaut du moteur.
    """
    thresholds = payload.get("thresholds") or {}
    return sensors.quality(
        payload.get("readings") or [],
        unit=payload.get("unit", "vol %"),
        depth_cm=float(payload.get("depthCm", 30)),
        mad_z_limit=thresholds.get("madZLimit"),
        stuck_min_points=thresholds.get("stuckMinPoints"),
        stuck_epsilon=thresholds.get("stuckEpsilon"),
        gap_factor=thresholds.get("gapFactor"),
    )


def _insufficient_to_response(func: Callable[[dict[str, Any]], dict[str, Any]]):
    """
    Traduit un refus pour données insuffisantes en réponse normale.

    « Trois sondes au minimum » n'est pas une entrée invalide : c'est une
    réponse légitime et informative. Le module lève pour rester testable en
    isolation ; ici le refus devient un 200 portant `sufficient: false` et son
    motif, exactement comme le fait le module de prévision. Aucune valeur
    n'est substituée.
    """

    def wrapper(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return func(payload)
        except interpolation.InsufficientData as exc:
            return {
                "parameter": (payload or {}).get("parameter"),
                "sufficient": False,
                "reason": str(exc),
                "grid": None,
                "crossValidation": None,
                "outliers": [],
            }

    return wrapper


ROUTES: dict[str, tuple[str, Callable[[dict[str, Any]], dict[str, Any]]]] = {
    "/v1/soil/analyze": ("POST", analyze_plot),
    "/v1/soil/texture": ("POST", _texture),
    "/v1/subsurface/profile": ("POST", lambda payload: subsurface.profile(payload.get("samples") or [])),
    "/v1/spectral/indices": ("POST", spectral.analyze_scene),
    "/v1/spectral/phenology": ("POST", lambda payload: spectral.phenology(payload.get("series") or [])),
    "/v1/sensors/quality": ("POST", _quality),
    "/v1/imagery/analyze": ("POST", imagery.analyze),
    "/v1/fusion": ("POST", lambda payload: fusion.fuse(payload.get("observations") or [])),
    "/v1/forecast/soil": ("POST", forecast.forecast_soil),
    "/v1/forecast/backtest": ("POST", forecast.backtest),
    "/v1/interpolation/grid": ("POST", _insufficient_to_response(interpolation.interpolate_grid)),
    "/v1/interpolation/loo": ("POST", _insufficient_to_response(interpolation.leave_one_out)),
}

META = {
    "name": "agrikonnect-geoai",
    "version": __version__,
    "sourcePriority": config.SOURCE_PRIORITY,
    "sourceReliability": config.SOURCE_RELIABILITY,
    "thresholds": {
        "ndviSoilCeiling": config.NDVI_SOIL_CEILING,
        "ndviVegetationFloor": config.NDVI_VEGETATION_FLOOR,
        "madZLimit": config.MAD_Z_LIMIT,
        "rootZoneCm": config.ROOT_ZONE_CM,
        "subSoilBottomCm": config.SUB_SOIL_BOTTOM_CM,
        "interpolation": {
            "minPoints": interpolation.MIN_POINTS,
            "minDistinctLocations": interpolation.MIN_DISTINCT_LOCATIONS,
            "minSpreadM": interpolation.MIN_SPREAD_M,
            "minSeparationM": interpolation.MIN_SEPARATION_M,
            "minVariogramPairs": interpolation.MIN_VARIOGRAM_PAIRS,
            "outlierZ": interpolation.OUTLIER_Z,
            "maxCells": interpolation.MAX_CELLS,
        },
        "forecast": {
            "minPoints": forecast.MIN_POINTS,
            "minSpanDays": forecast.MIN_SPAN_DAYS,
            "testFraction": forecast.TEST_FRACTION,
            "minTestPoints": forecast.MIN_TEST_POINTS,
            "intervalZ": forecast.INTERVAL_Z,
            "dampingHorizonDays": forecast.DAMPING_HORIZON_DAYS,
        },
    },
    "endpoints": {path: method for path, (method, _) in ROUTES.items()},
    "disclaimer": "Moteur de diagnostic : il décrit et explique, il ne certifie pas et ne prescrit pas.",
}


class GeoHandler(BaseHTTPRequestHandler):
    server_version = f"GeoAI/{__version__}"
    protocol_version = "HTTP/1.1"

    # ── utilitaires ────────────────────────────────────────────────────────
    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str, details: Any = None) -> None:
        self._send(status, {"error": {"code": code, "message": message, "details": details}})

    def _authorised(self) -> bool:
        if not TOKEN:
            return True
        return self.headers.get("X-GeoAI-Token") == TOKEN

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            raise ValueError("Corps JSON requis")
        if length > MAX_BODY_BYTES:
            raise ValueError(f"Corps trop volumineux ({length} octets, maximum {MAX_BODY_BYTES})")
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ValueError(f"JSON invalide : {error}") from error
        if not isinstance(payload, dict):
            raise ValueError("Le corps doit être un objet JSON")
        return payload

    # ── routes ─────────────────────────────────────────────────────────────
    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path == "/health":
            self._send(200, {"status": "ok", "service": "agrikonnect-geoai", "version": __version__})
            return
        if path in ("/v1/meta", "/meta"):
            self._send(200, META)
            return
        if path in ROUTES and ROUTES[path][0] == "GET":
            if not self._authorised():
                self._error(401, "unauthorized", "Jeton interne invalide")
                return
            self._send(200, ROUTES[path][1]({}))
            return
        self._error(404, "not_found", f"Route inconnue : {path}")

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?")[0].rstrip("/") or "/"
        if not self._authorised():
            self._error(401, "unauthorized", "Jeton interne invalide")
            return
        route = ROUTES.get(path)
        if not route:
            self._error(404, "not_found", f"Route inconnue : {path}")
            return
        try:
            payload = self._read_json()
            result = route[1](payload)
            self._send(200, result)
        except ValueError as error:
            self._error(422, "invalid_payload", str(error))
        except KeyError as error:
            self._error(422, "missing_field", f"Champ requis manquant : {error}")
        except Exception as error:  # pragma: no cover - filet de sécurité
            traceback.print_exc()
            self._error(500, "internal_error", f"Erreur interne du moteur : {error}")

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        if os.environ.get("GEOAI_QUIET") == "1":
            return
        sys.stderr.write(f"[geoai] {self.address_string()} {format % args}\n")


def create_server(host: str = "0.0.0.0", port: int = 8100) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), GeoHandler)
    server.daemon_threads = True
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="AGRIKONNECT — moteur géospatial et pédologique")
    parser.add_argument("--host", default=os.environ.get("GEOAI_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("GEOAI_PORT", "8100")))
    args = parser.parse_args()

    server = create_server(args.host, args.port)
    print(f"[geoai] moteur v{__version__} à l'écoute sur http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[geoai] arrêt demandé", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
