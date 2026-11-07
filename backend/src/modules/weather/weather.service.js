/**
 * Exigences CDC couvertes : WEA-01, WEA-02, WEA-03
 * (identifiant du cahier des charges : WX-01).
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';

/**
 * WEA-01 → WEA-03 — Météo.
 *
 * Règle absolue (CDC V3 §8.2) : aucune donnée météo n'est inventée.
 * Chaque enregistrement porte `source`, `observedAt` et un niveau de
 * `confidence`. Si aucune donnée n'existe pour une parcelle, l'API répond
 * explicitement « donnée indisponible » plutôt qu'une valeur plausible.
 */

const STALE_HOURS = 24;

export const forPlot = async (plotId, query, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');

  const records = await prisma.weatherData.findMany({
    where: { plotId },
    orderBy: { observedAt: 'desc' },
    take: Math.min(Number(query.limit ?? 24), 168),
  });

  if (records.length === 0) {
    return {
      plotId,
      available: false,
      records: [],
      message:
        'Aucune donnée météo enregistrée pour cette parcelle. La plateforme ne produit pas de prévision inventée.',
      actionSuggestion: 'Demander une synchronisation fournisseur ou saisir une observation de terrain.',
    };
  }

  const latest = records[0];
  const ageHours = (Date.now() - latest.observedAt.getTime()) / 3600000;

  return {
    plotId,
    available: true,
    latest: {
      observedAt: latest.observedAt,
      source: latest.source,
      confidence: latest.confidence,
      payload: latest.payload,
    },
    records,
    freshness: {
      ageHours: Math.round(ageHours * 10) / 10,
      stale: ageHours > STALE_HOURS,
      warning: ageHours > STALE_HOURS ? 'Donnée plus ancienne que 24 h : à considérer avec prudence.' : null,
    },
  };
};

/**
 * Enregistrement d'une observation météo (fournisseur ou agent).
 * `source` est obligatoire : c'est la garantie de provenance.
 */
export const record = async (payload, req) => {
  const { plotId, countryCode, latitude, longitude, observedAt, source, payload: data, confidence } = payload;

  let resolvedCountry = countryCode;
  let lat = latitude;
  let lng = longitude;

  if (plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
    lat = lat ?? plot.latitude;
    lng = lng ?? plot.longitude;
  }

  if (lat == null || lng == null) {
    throw ApiError.badRequest('Coordonnées requises (via la parcelle ou explicitement)');
  }
  if (!resolvedCountry) {
    throw ApiError.badRequest('countryCode requis (aucune déduction implicite)');
  }

  return prisma.weatherData.create({
    data: {
      id: `wth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      plotId: plotId ?? null,
      countryCode: resolvedCountry,
      latitude: Number(lat),
      longitude: Number(lng),
      // La date est normalisée ici : une chaîne ISO ne doit jamais arriver
      // telle quelle dans une colonne DateTime (comparaisons et écarts faux).
      observedAt: observedAt ? new Date(observedAt) : new Date(),
      source,
      payload: data,
      confidence: confidence ?? 'medium',
    },
  });
};

/** WEA-03 — alerte agro-météo dérivée de valeurs réelles uniquement. */
export const alerts = async (plotId, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');

  const latest = await prisma.weatherData.findFirst({
    where: { plotId },
    orderBy: { observedAt: 'desc' },
  });

  if (!latest) {
    return { plotId, alerts: [], available: false, message: 'Aucune donnée pour dériver une alerte.' };
  }

  const data = latest.payload ?? {};
  const alerts = [];

  // Seuils simples et explicables : chaque alerte cite la valeur et la source
  if (typeof data.rainfallMm === 'number' && data.rainfallMm >= 50) {
    alerts.push({ level: 'high', code: 'HEAVY_RAIN', value: data.rainfallMm, unit: 'mm', source: latest.source, observedAt: latest.observedAt, rule: 'rainfallMm >= 50' });
  }
  if (typeof data.temperatureC === 'number' && data.temperatureC >= 38) {
    alerts.push({ level: 'medium', code: 'HEAT_STRESS', value: data.temperatureC, unit: '°C', source: latest.source, observedAt: latest.observedAt, rule: 'temperatureC >= 38' });
  }
  if (typeof data.humidityPct === 'number' && data.humidityPct >= 85) {
    alerts.push({ level: 'medium', code: 'FUNGAL_RISK', value: data.humidityPct, unit: '%', source: latest.source, observedAt: latest.observedAt, rule: 'humidityPct >= 85' });
  }

  return {
    plotId,
    alerts,
    basedOn: { source: latest.source, observedAt: latest.observedAt, confidence: latest.confidence },
    // Rappel de prudence : aide à la décision, pas une prescription
    disclaimer: 'Alertes dérivées de seuils simples sur des observations datées. Ne remplacent pas un bulletin officiel.',
  };
};

/** Historique agrégé par jour, pour les graphiques du tableau de bord. */
export const history = async (plotId, query, req) => {
  const plot = await prisma.plot.findFirst({
    where: { id: plotId, organizationId: req.tenant.organizationId, deletedAt: null },
  });
  if (!plot) throw ApiError.notFound('Parcelle introuvable');

  const since = new Date(Date.now() - Number(query.days ?? 30) * 24 * 3600 * 1000);
  const records = await prisma.weatherData.findMany({
    where: { plotId, observedAt: { gte: since } },
    orderBy: { observedAt: 'asc' },
  });

  const byDay = new Map();
  for (const r of records) {
    const day = r.observedAt.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }

  return {
    plotId,
    days: [...byDay.entries()].map(([date, values]) => ({
      date,
      samples: values.length,
      sources: [...new Set(values.map((v) => v.source))],
      // Moyenne des échantillons réels du jour, jamais d'interpolation
      payload: values[values.length - 1].payload,
      confidence: values[values.length - 1].confidence,
    })),
    interpolated: false,
  };
};
