import { env } from '../config/env.js';

/**
 * Utilitaires géospatiaux.
 * MongoDB utilisait des index 2dsphere ; en Postgres on stocke le GeoJSON
 * en jsonb et on indexe lat/lng (voir schema.prisma) pour les requêtes bbox.
 */

/** GeoJSON Point { type: 'Point', coordinates: [lng, lat] } */
export const pointGeoJson = (lat, lng) => ({
  type: 'Point',
  coordinates: [Number(lng), Number(lat)],
});

/** Centroïde approximatif d'un polygone ou d'un point (suffisant pour bbox). */
export const centroidOf = (geometry) => {
  if (!geometry) return { lat: null, lng: null };

  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return { lat: Number(lat), lng: Number(lng) };
  }

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) {
    const ring = geometry.coordinates[0];
    const { lat, lng } = ring.reduce(
      (acc, [x, y]) => ({ lat: acc.lat + Number(y), lng: acc.lng + Number(x) }),
      { lat: 0, lng: 0 },
    );
    return { lat: lat / ring.length, lng: lng / ring.length };
  }

  return { lat: null, lng: null };
};

/**
 * Arrondi utilisé pour la position publique (MAP-04, SEC-12).
 * Arrondir à 2 décimales ≈ 1,1 km de précision : jamais la parcelle exacte.
 */
export const approximate = (value, decimals = env.PUBLIC_COORD_DECIMALS) => {
  if (value === null || value === undefined) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
};

/**
 * Superficie approximative d'un polygone GeoJSON, en hectares.
 * Formule de Shoelace sur une projection équirectangulaire locale :
 * suffisant pour une parcelle agricole, et documenté comme estimé.
 */
export const polygonAreaHa = (geometry) => {
  if (geometry?.type !== 'Polygon' || !geometry.coordinates?.[0]) return null;

  const ring = geometry.coordinates[0];
  if (ring.length < 4) return null;

  const R = 6378137; // rayon terrestre (m)
  const lat0 = ring.reduce((s, c) => s + Number(c[1]), 0) / ring.length;
  const mPerDegLat = (Math.PI * R) / 180;
  const mPerDegLng = mPerDegLat * Math.cos((lat0 * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * mPerDegLng * (y2 * mPerDegLat) - x2 * mPerDegLng * (y1 * mPerDegLat);
  }

  const areaM2 = Math.abs(area) / 2;
  return Math.round((areaM2 / 10_000) * 100) / 100; // hectares, 2 décimales
};

/** Valide une bbox "minLng,minLat,maxLng,maxLat" et renvoie les bornes numériques. */
export const parseBbox = (bbox) => {
  if (!bbox) return null;
  const parts = String(bbox).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
};

/** Bornes administratives minimales acceptées pour une position. */
export const isValidCoordinate = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180;

/**
 * Distance approximative en km entre deux coordonnées (formule de Haversine).
 * Utilisée pour les recherches par rayon et le transport : jamais pour un
 * calcul de surface ou une facturation.
 */
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some((v) => v === null || v === undefined || Number.isNaN(Number(v)))) {
    return null;
  }
  const R = 6371;
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
