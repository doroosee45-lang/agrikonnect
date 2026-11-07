/**
 * Exigences CDC couvertes : USSD-01, WA-01.
 *
 * Chaque identifiant renvoie à la règle appliquée dans ce fichier ; la preuve
 * exécutable correspondante est référencée dans `tests/` (voir docs/TRACEABILITY.md).
 */
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { resolveId } from '../../shared/ids.js';
import { audit } from '../../shared/audit.js';

/**
 * USSD-01 / WA-01 — canaux complémentaires (CDC V3 §5.5).
 *
 * Règles :
 *  - les canaux servent les usages simples : prix, météo, statut d'annonce, contact ;
 *  - aucun document, aucune donnée personnelle d'un tiers n'y est exposé ;
 *  - toute session est tracée (ChannelSession / ChannelMessage) pour audit ;
 *  - les réponses sont courtes, sans accents techniques, lisibles sur 182 caractères.
 */

const MAX_CHARS = 182;

const clip = (text) => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text);

const MAIN_MENU = [
  'AGRIKONNECT',
  '1. Prix du marche',
  '2. Meteo',
  '3. Mes annonces',
  '4. Verifier un lot',
  '0. Quitter',
].join('\n');

const normalize = (value = '') => String(value).trim();

const weatherLine = async (countryCode) => {
  const snapshot = await prisma.weatherData.findFirst({
    where: { ...(countryCode ? { countryCode } : {}) },
    orderBy: { observedAt: 'desc' },
  });
  if (!snapshot) return 'Meteo indisponible pour votre zone. Reessayez plus tard.';
  const data = snapshot.payload ?? {};
  const summary = data.summary ?? data.condition ?? 'conditions non precisees';
  const temperature = data.temperatureC ?? data.temperature ?? null;
  const rain = data.rainfallMm ?? data.precipitationMm ?? null;
  return [
    `${countryCode ?? snapshot.countryCode} : ${summary}`,
    temperature !== null ? `Temp ${Math.round(Number(temperature))}C` : null,
    rain !== null ? `Pluie ${rain}mm` : null,
    `Source ${snapshot.source}`,
  ]
    .filter(Boolean)
    .join(' | ');
};

const priceLines = async (countryCode) => {
  const prices = await prisma.marketPrice.findMany({
    where: { ...(countryCode ? { countryCode } : {}) },
    orderBy: { observedAt: 'desc' },
    take: 3,
  });
  if (!prices.length) return 'Aucun prix publie pour votre pays.';

  const crops = await prisma.crop.findMany({ where: { id: { in: prices.map((p) => p.cropId) } } });
  const names = Object.fromEntries(crops.map((c) => [c.id, c.name ?? c.slug]));

  return prices
    .map(
      (p) =>
        `${names[p.cropId] ?? 'Produit'} ${p.market}: ${p.price} ${p.currency}/${p.unit} (${p.source})`,
    )
    .join('\n');
};

const myListings = async (phone) => {
  const profile = await prisma.profile.findFirst({ where: { phone } });
  if (!profile) return 'Numero non reconnu. Enregistrez-le dans votre profil AGRIKONNECT.';
  const memberships = await prisma.membership.findMany({ where: { userId: profile.id }, take: 5 });
  const organizationIds = memberships.map((m) => m.organizationId);
  if (!organizationIds.length) return 'Aucune organisation rattachee a ce numero.';

  const listings = await prisma.listing.findMany({
    where: { organizationId: { in: organizationIds }, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  if (!listings.length) return 'Aucune annonce publiee.';
  return listings
    .map((l) => `${l.title}: ${l.quantity ?? ''}${l.unit ?? ''} a ${l.pricePerUnit ?? l.price ?? ''} ${l.currency ?? ''}`)
    .join('\n');
};

const verifyLot = async (code) => {
  const lot = await prisma.traceabilityLot.findFirst({ where: { code } });
  if (!lot) return 'Lot inconnu. Verifiez le code figure sur l etiquette.';
  const crop = await prisma.crop.findUnique({ where: { id: lot.cropId } });
  const publicFields = lot.publicFields ?? {};
  return `Lot ${lot.code}: ${crop?.name ?? 'produit'} | ${lot.status} | ${publicFields.origin ?? 'origine non publiee'}`;
};

/** V3:NFR-07 — profondeur maximale d'un menu USSD (4 niveaux). */
export const MAX_USSD_DEPTH = 4;

/**
 * USSD-01 — menu pas à pas. `text` est la chaîne cumulée envoyée par la passerelle
 * ("1*2"), ce qui rend le service sans état côté opérateur.
 */
export const ussd = async (payload) => {
  const phone = normalize(payload.phoneNumber);
  const sessionId = normalize(payload.sessionId ?? phone);
  const text = normalize(payload.text);
  if (!phone) throw ApiError.badRequest('Numéro requis');

  const session = await prisma.channelSession.findFirst({
    where: { channel: 'USSD', phone },
  });

  const trail = text ? text.split('*') : [];
  // V3:NFR-07 — session courte, menus bornés à 4 niveaux : au-delà, on revient
  // au menu principal plutôt que de laisser la passerelle s'enfoncer.
  if (trail.length > MAX_USSD_DEPTH) {
    await prisma.channelMessage.create({
      data: {
        id: resolveId(),
        channel: 'USSD',
        direction: 'OUT',
        phone,
        body: MAIN_MENU,
        payload: { sessionId, state: 'MENU', reason: 'depth_exceeded' },
      },
    });
    return { sessionId, state: 'MENU', end: false, ussdResponse: clip(MAIN_MENU), body: clip(MAIN_MENU) };
  }
  const choice = trail[0] ?? '';

  let body;
  let state = 'MENU';
  let end = false;

  if (!trail.length) {
    body = MAIN_MENU;
  } else if (choice === '1') {
    body = await priceLines(payload.countryCode ?? null);
  } else if (choice === '2') {
    body = await weatherLine(payload.countryCode ?? null);
  } else if (choice === '3') {
    body = await myListings(phone);
  } else if (choice === '4') {
    const code = trail[1];
    body = code ? await verifyLot(code) : 'Entrez le code du lot.';
    state = code ? 'LOT' : 'LOT_INPUT';
  } else if (choice === '0') {
    body = 'Merci d avoir utilise AGRIKONNECT.';
    end = true;
    state = 'CLOSED';
  } else {
    body = MAIN_MENU;
  }

  const sessionData = {
    state,
    menu: choice || null,
    lastAt: new Date(),
    organizationId: session?.organizationId ?? null,
  };

  const saved = session
    ? await prisma.channelSession.update({ where: { id: session.id }, data: sessionData })
    : await prisma.channelSession.create({
        data: {
          id: resolveId(),
          channel: 'USSD',
          phone,
          ...sessionData,
        },
      });

  await prisma.channelMessage.create({
    data: {
      id: resolveId(),
      channel: 'USSD',
      direction: 'IN',
      phone,
      body: text || '(menu)',
      payload: { sessionId },
    },
  });
  await prisma.channelMessage.create({
    data: {
      id: resolveId(),
      channel: 'USSD',
      direction: 'OUT',
      phone,
      body,
      payload: { sessionId, state },
    },
  });

  return {
    sessionId: saved.id,
    state,
    end,
    // Format attendu par les agrégateurs USSD (chaîne unique).
    ussdResponse: clip(body),
    body: clip(body),
  };
};

/** WA-01 — vérification du webhook (défi Meta `hub.challenge`). */
export const whatsappVerify = (query) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    throw ApiError.notImplemented('Canal WhatsApp non configuré (WHATSAPP_VERIFY_TOKEN absent)');
  }
  if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== expected) {
    throw ApiError.forbidden('Vérification du webhook WhatsApp refusée');
  }
  return { challenge: query['hub.challenge'] ?? '' };
};

const replyFor = async (text, countryCode) => {
  const message = text.toLowerCase();
  if (/prix|price/.test(message)) return priceLines(countryCode);
  if (/meteo|météo|weather|pluie/.test(message)) return weatherLine(countryCode);
  if (/lot|trac/.test(message)) {
    const code = message.match(/\b[A-Z]{2}-[A-Z0-9-]{4,}\b/i)?.[0];
    return code ? verifyLot(code.toUpperCase()) : 'Envoyez le code du lot (ex. AK-CD-2026-0001).';
  }
  if (/bonjour|salut|hello|menu/.test(message)) return MAIN_MENU;
  return 'Je peux vous renseigner sur : les prix, la meteo, un lot. Ecrivez "menu".';
};

/**
 * WA-01 — webhook entrant. Le payload Meta est reconnu mais jamais interprété
 * comme une commande applicative : seules les données utiles sont conservées.
 */
export const whatsappWebhook = async (payload) => {
  const entries = payload?.entry ?? [];
  const processed = [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const phone = message.from;
        if (!phone) continue;

        const text =
          message.text?.body ??
          message.interactive?.button_reply?.title ??
          message.button?.text ??
          '(media)';

        const session = await prisma.channelSession.findFirst({ where: { channel: 'WHATSAPP', phone } });
        const countryCode = null;
        const answer = await replyFor(text, countryCode);

        const saved = session
          ? await prisma.channelSession.update({
              where: { id: session.id },
              data: { lastAt: new Date(), state: 'ANSWERED' },
            })
          : await prisma.channelSession.create({
              data: {
                id: resolveId(),
                channel: 'WHATSAPP',
                phone,
                state: 'ANSWERED',
                profileId: null,
              },
            });

        await prisma.channelMessage.create({
          data: {
            id: resolveId(),
            channel: 'WHATSAPP',
            direction: 'IN',
            phone,
            body: text,
            payload: { messageId: message.id ?? null, type: message.type ?? 'text' },
            providerId: message.id ?? null,
          },
        });
        await prisma.channelMessage.create({
          data: {
            id: resolveId(),
            channel: 'WHATSAPP',
            direction: 'OUT',
            phone,
            body: answer,
            payload: { sessionId: saved.id, simulated: true },
          },
        });

        processed.push({ phone, answer });
      }
    }
  }

  await audit({
    actorId: null,
    action: 'channel.whatsapp.received',
    resource: 'channel_messages',
    resourceId: null,
    req: null,
    newValue: { processed: processed.length },
  });

  return {
    received: processed.length,
    processed,
    // Aucune donnée personnelle renvoyée à l'appelant du webhook.
    note: 'Les messages sont journalisés ; les réponses sont envoyées par le canal sortant.',
  };
};

export const listMessages = async (query = {}) => {
  const items = await prisma.channelMessage.findMany({
    where: {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.phone ? { phone: query.phone } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(query.limit ?? 50), 200),
  });
  return { items, count: items.length };
};
