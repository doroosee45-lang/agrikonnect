/**
 * Exigences CDC couvertes : API-01, API-02, API-03, DATA-10.
 *
 * API publique de données, authentifiée par clé (`X-API-Key`) : ni JWT, ni
 * cookie, uniquement un client approuvé et tracé (quota, journal d'accès).
 *
 * Deux montages, un seul code :
 *  - `/public-api/v1` : surface historique, complète ;
 *  - `/api/v1`        : alias des chemins normalisés exigés par le CDC V5
 *                       (`/agriculture`, `/regions`, `/crops`, `/market-prices`,
 *                       `/farmers`), monté en dernier pour ne pas masquer les
 *                       routes authentifiées existantes.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { success } from '../../shared/http/response.js';
import { apiKeyAuth } from '../../middleware/apiKey.js';
import * as service from './publicapi.service.js';

const router = Router();

router.get('/products', apiKeyAuth('data:read'), asyncHandler(async (req, res) =>
  success(res, await service.listProducts(req))));

router.get('/products/:id/aggregates', apiKeyAuth('aggregates:read'), asyncHandler(async (req, res) =>
  success(res, await service.getAggregates(req.params.id, req.query, req))));

router.get('/prices', apiKeyAuth('prices:read'), asyncHandler(async (req, res) =>
  success(res, await service.getPrices(req.query))));

/* ─── V5 §6 — jeux de données normalisés exigés par le CDC ─── */

router.get('/agriculture', apiKeyAuth('aggregates:read'), asyncHandler(async (req, res) =>
  success(res, await service.getAgricultureOverview(req.query))));

router.get('/regions', apiKeyAuth('aggregates:read'), asyncHandler(async (req, res) =>
  success(res, await service.getRegions(req.query))));

router.get('/crops', apiKeyAuth('data:read'), asyncHandler(async (req, res) =>
  success(res, await service.getCrops(req.query))));

router.get('/market-prices', apiKeyAuth('prices:read'), asyncHandler(async (req, res) =>
  success(res, await service.getMarketPrices(req.query))));

router.get('/projects', apiKeyAuth('data:read'), asyncHandler(async (req, res) =>
  success(res, await service.getProjects(req.query))));

router.get('/farmers', apiKeyAuth('data:read'), asyncHandler(async (req, res) =>
  success(res, await service.getFarmers(req.query))));

/**
 * Alias `/api/v1/...` — mêmes garde-fous, mêmes handlers. Seuls les chemins
 * absents de la surface authentifiée sont exposés ici.
 */
export const dataAliasRouter = Router();

dataAliasRouter.get('/agriculture', apiKeyAuth('aggregates:read'), asyncHandler(async (req, res) =>
  success(res, await service.getAgricultureOverview(req.query))));

dataAliasRouter.get('/regions', apiKeyAuth('aggregates:read'), asyncHandler(async (req, res) =>
  success(res, await service.getRegions(req.query))));

dataAliasRouter.get('/market-prices', apiKeyAuth('prices:read'), asyncHandler(async (req, res) =>
  success(res, await service.getMarketPrices(req.query))));

dataAliasRouter.get('/farmers', apiKeyAuth('data:read'), asyncHandler(async (req, res) =>
  success(res, await service.getFarmers(req.query))));

export default router;
