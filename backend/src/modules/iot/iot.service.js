/**
 * Exigences CDC couvertes : IOT-01, IOT-02, IOT-03, IOT-04.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { sha256 } from '../../shared/crypto.js';
import { assertOwnership } from '../../middleware/tenant.js';
import { audit } from '../../shared/audit.js';
import { hardware } from '../../config/hardware.js';
import { notifyMany } from '../../shared/events.js';
import { env } from '../../config/env.js';
import { assertDataModeAllowed, dataModeLabel } from '../../shared/dataMode.js';

/**
 * IOT-01 → IOT-04 — Capteurs.
 *
 * Sécurité : la clé d'appareil n'est JAMAIS stockée en clair. Elle est générée
 * une seule fois, renvoyée une seule fois, puis conservée sous forme de hash.
 * Elle peut être révoquée ou tournée à tout moment.
 */

const generateKey = () => `iot_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export const register = async (payload, req) => {
  const organizationId = req.tenant.organizationId;

  if (payload.plotId) {
    const plot = await prisma.plot.findFirst({
      where: { id: payload.plotId, organizationId, deletedAt: null },
    });
    if (!plot) throw ApiError.notFound('Parcelle introuvable');
  }

  const rawKey = generateKey();

  const device = await prisma.iotDevice.create({
    data: {
      id: resolveId(payload.id),
      organizationId,
      plotId: payload.plotId ?? null,
      label: payload.label,
      serialNumber: payload.serialNumber ?? null,
      keyHash: sha256(rawKey),
      status: 'ACTIVE',
      thresholds: payload.thresholds ?? undefined,
    },
  });

  await audit({ actorId: req.user.id, action: 'iot.device.register', resource: 'iot_devices', resourceId: device.id, req, newValue: { label: device.label, plotId: device.plotId } });

  return {
    device: { ...device, keyHash: undefined },
    // Seule occasion où la clé est visible : elle n'est pas récupérable ensuite
    deviceKey: rawKey,
    warning: 'Clé affichée une seule fois. Elle est stockée hachée et ne peut plus être relue.',
  };
};

export const list = async (req) => {
  const devices = await prisma.iotDevice.findMany({
    where: { organizationId: req.tenant.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { readings: { orderBy: { at: 'desc' }, take: 1 } },
  });

  const now = Date.now();
  return {
    items: devices.map((d) => ({
      id: d.id,
      label: d.label,
      plotId: d.plotId,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      /**
       * Un appareil muet au-delà du seuil de silence est signalé, jamais
       * considéré comme actif. Le seuil vient du fichier de configuration
       * matériel — le même que celui du job `iot.markSilent` : une règle,
       * une source.
       */
      silent:
        !d.lastSeenAt
        || now - d.lastSeenAt.getTime() > hardware.maintenance.silentSensorThreshold.value * 3600 * 1000,
      lastReading: d.readings[0] ?? null,
      keyRotatedAt: d.keyRotatedAt,
    })),
  };
};

export const rotateKey = async (deviceId, req) => {
  const device = assertOwnership(
    await prisma.iotDevice.findUnique({ where: { id: deviceId } }),
    req.tenant.organizationId,
    'Appareil',
  );

  const rawKey = generateKey();
  await prisma.iotDevice.update({
    where: { id: deviceId },
    data: { keyHash: sha256(rawKey), keyRotatedAt: new Date(), status: 'ACTIVE' },
  });

  await audit({ actorId: req.user.id, action: 'iot.device.rotate', resource: 'iot_devices', resourceId: deviceId, req, oldValue: { status: device.status } });
  return { deviceId, deviceKey: rawKey, warning: 'Ancienne clé invalidée immédiatement.' };
};

export const revoke = async (deviceId, { reason }, req) => {
  assertOwnership(
    await prisma.iotDevice.findUnique({ where: { id: deviceId } }),
    req.tenant.organizationId,
    'Appareil',
  );

  const updated = await prisma.iotDevice.update({
    where: { id: deviceId },
    data: { status: 'REVOKED' },
  });

  await audit({ actorId: req.user.id, action: 'iot.device.revoke', resource: 'iot_devices', resourceId: deviceId, req, newValue: { reason } });
  return updated;
};

/** IOT-02 — ingestion des mesures (authentifiée par la clé d'appareil). */
export const ingest = async ({ deviceKey, readings }, req) => {
  const keyHash = sha256(deviceKey);
  const device = await prisma.iotDevice.findFirst({ where: { keyHash } });

  if (!device) throw ApiError.unauthorized('Clé d\'appareil invalide');
  if (device.status !== 'ACTIVE') throw ApiError.forbidden(`Appareil ${device.status}`);

  /**
   * Marquage de l'origine — résolu **avant** la transaction : un lot contenant
   * une valeur simulée refusée ne doit rien écrire du tout, pas même ses
   * mesures réelles. Le refus est total ou nul.
   */
  const modes = readings.map((r) =>
    assertDataModeAllowed(r.mode, { isProd: env.isProd, simulationAllowed: env.simulationAllowed }),
  );
  const hasSimulated = modes.some((mode) => mode !== 'REAL');

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    readings.forEach((r, index) => {
      rows.push(
        tx.sensorReading.create({
          data: {
            id: resolveId(),
            deviceId: device.id,
            metric: r.metric,
            value: r.value,
            unit: r.unit ?? null,
            quality: r.quality ?? 'raw',
            at: r.at ?? new Date(),
            depthCm: r.depthCm ?? null,
            position: r.position ?? undefined,
            confidence: r.confidence ?? null,
            source: r.source ?? null,
            mode: modes[index],
            organizationId: device.organizationId,
            plotId: device.plotId,
          },
        }),
      );
    });
    return Promise.all(rows).then(async (saved) => {
      await tx.iotDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return saved;
    });
  });

  const breaches = await evaluateThresholds(device, created);

  return {
    accepted: created.length,
    deviceId: device.id,
    thresholdsBreached: breaches,
    // Les seuils déclenchent une alerte, jamais une action automatique
    automaticAction: 'none',
    /**
     * Origine des valeurs écrites. Un lot peut mélanger mesures réelles et
     * valeurs simulées ; l'étiquette est renvoyée pour que l'écran affiche
     * l'avertissement plutôt que de laisser croire à une mesure.
     */
    dataMode: hasSimulated ? 'SIMULATED' : 'REAL',
    ...(hasSimulated ? { dataModeNotice: dataModeLabel('SIMULATED') } : {}),
  };
};

/** IOT-03 — évaluation des seuils déclarés sur l'appareil. */
const evaluateThresholds = async (device, readings) => {
  const thresholds = device.thresholds ?? {};
  const breaches = [];

  for (const reading of readings) {
    const rule = thresholds[reading.metric];
    if (!rule) continue;

    const value = Number(reading.value);
    const below = rule.min != null && value < Number(rule.min);
    const above = rule.max != null && value > Number(rule.max);
    if (!below && !above) continue;

    breaches.push({
      metric: reading.metric,
      value,
      unit: reading.unit,
      rule: { min: rule.min ?? null, max: rule.max ?? null },
      direction: below ? 'below_min' : 'above_max',
      at: reading.at,
    });
  }

  if (breaches.length > 0) {
    const members = await prisma.membership.findMany({
      where: { organizationId: device.organizationId, status: 'ACTIVE' },
      select: { userId: true },
    });
    await notifyMany(members.map((m) => m.userId), {
      type: 'iot.threshold',
      title: `Seuil dépassé — ${device.label}`,
      body: breaches.map((b) => `${b.metric}: ${b.value}${b.unit ?? ''} (${b.direction})`).join(', '),
      payload: { deviceId: device.id, breaches },
      dedupeKey: `iot:${device.id}:${breaches.map((b) => b.metric).join('-')}:${new Date().toISOString().slice(0, 13)}`,
    });
  }

  return breaches;
};

export const readings = async (deviceId, query, req) => {
  const device = assertOwnership(
    await prisma.iotDevice.findUnique({ where: { id: deviceId } }),
    req.tenant.organizationId,
    'Appareil',
  );

  const since = new Date(Date.now() - Number(query.hours ?? 24) * 3600 * 1000);
  const rows = await prisma.sensorReading.findMany({
    where: { deviceId, at: { gte: since }, ...(query.metric ? { metric: query.metric } : {}) },
    orderBy: { at: 'asc' },
    take: Math.min(Number(query.limit ?? 500), 2000),
  });

  return {
    device: { id: device.id, label: device.label, plotId: device.plotId, thresholds: device.thresholds },
    readings: rows,
    window: { since, hours: Number(query.hours ?? 24) },
    // Aucune interpolation : trous de mesure signalés explicitement
    gaps: detectGaps(rows),
  };
};

const detectGaps = (rows, maxGapMs = 30 * 60 * 1000) => {
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const delta = rows[i].at.getTime() - rows[i - 1].at.getTime();
    if (delta > maxGapMs) {
      gaps.push({ from: rows[i - 1].at, to: rows[i].at, minutes: Math.round(delta / 60000) });
    }
  }
  return gaps;
};
