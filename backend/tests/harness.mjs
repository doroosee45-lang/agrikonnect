import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { startFakeGoTrue } from './fake-gotrue.mjs';

/**
 * Banc de recette **réel** : PostgreSQL, API HTTP, webhooks sortants.
 *
 * Ce harnais démarre, dans l'ordre :
 *   1. un PostgreSQL véritable (binaires embarqués, aucun privilège root requis) ;
 *   2. le schéma via `prisma migrate deploy` (la migration versionnée du dépôt) ;
 *   3. les référentiels via `prisma/seed.js` (pays, cultures, unités, produits) ;
 *   4. un stub GoTrue (contrat Supabase Auth) — seul service hébergé indisponible ici ;
 *   5. un récepteur HTTP qui capture les SMS et emails réellement envoyés ;
 *   6. l'API Express complète, sur un port éphémère.
 *
 * Rien n'est moqué côté applicatif : le code testé est celui qui part en production.
 */

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../../..');

const PG_PORT = Number(process.env.E2E_PG_PORT ?? 55433);
const DATA_DIR = process.env.E2E_PG_DATA ?? '/tmp/agrikon-e2e-pg';

const waitForPort = async (port, timeoutMs = 30_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const reachable = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
    if (reachable) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`PostgreSQL n'écoute pas sur le port ${PG_PORT}`);
};

/** Récepteur des envois sortants (SMS / email) — preuve de remise. */
const startSink = async () => {
  const messages = { sms: [], email: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const isSms = req.url.startsWith('/sms');
      let payload = {};
      try {
        payload = JSON.parse(raw || '{}');
      } catch {
        payload = { __raw: raw };
      }
      if (isSms) messages.sms.push(payload);
      else messages.email.push(payload);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: `msg_${Date.now()}`, accepted: true }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  return {
    smsUrl: `http://127.0.0.1:${port}/sms`,
    emailUrl: `http://127.0.0.1:${port}/email`,
    messages,
    /** Dernier code à 6 chiffres reçu par SMS (OTP). */
    lastOtpFor: (phone) => {
      const message = [...messages.sms].reverse().find((m) => m.to === phone);
      const code = message?.message?.match(/\b(\d{6})\b/)?.[1] ?? null;
      return code;
    },
    lastEmailFor: (to) => [...messages.email].reverse().find((m) => m.to === to) ?? null,
    reset: () => {
      messages.sms.length = 0;
      messages.email.length = 0;
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
};

/**
 * @param {{ fresh?: boolean }} [options]
 * @returns {Promise<{ request: Function, prisma: any, gotrue: any, sink: any, stop: Function, urls: any }>}
 */
export const startHarness = async ({ fresh = true } = {}) => {
  fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'agrikon',
    password: 'agrikon',
    port: PG_PORT,
    persistent: false,
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await waitForPort(PG_PORT);
  await pg.createDatabase('agrikon');

  const databaseUrl = `postgresql://agrikon:agrikon@127.0.0.1:${PG_PORT}/agrikon?schema=public`;

  const prismaEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };

  // 1. Schéma réel via la migration versionnée
  await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], { cwd: backendRoot, env: prismaEnv });

  // 2. Référentiels
  if (fresh) {
    await execFileAsync('node', ['prisma/seed.js'], { cwd: backendRoot, env: prismaEnv });
  }

  // 3. Stub GoTrue + récepteur de messages
  const gotrue = await startFakeGoTrue();
  const sink = await startSink();

  // 4. Variables d'environnement de l'application (validées par config/env.js)
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    SUPABASE_URL: gotrue.url,
    SUPABASE_ANON_KEY: 'anon-key-e2e',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-e2e',
    SUPABASE_BUCKET_MEDIA: 'media',
    SUPABASE_BUCKET_PRIVATE: 'private-documents',
    CORS_ORIGIN: 'http://localhost:5173',
    PUBLIC_WEB_URL: 'http://localhost:5173',
    REALTIME_ENABLED: 'false',
    JOBS_ENABLED: 'false',
    /**
     * `webhook` par défaut : la majorité des suites n'a pas besoin d'un
     * fournisseur réel. Une suite qui teste un fournisseur précis
     * (`smsTwilio.e2e.test.mjs`) pose `E2E_SMS_PROVIDER` avant d'appeler
     * `startHarness()` — après, `env` est figé.
     */
    SMS_PROVIDER: process.env.E2E_SMS_PROVIDER ?? 'webhook',
    SMS_WEBHOOK_URL: sink.smsUrl,

    /*
     * Fenêtre de silence désactivée **par défaut dans les recettes**.
     *
     * Ce n'est pas un contournement de la protection : c'est la suppression
     * d'une dépendance à l'heure du mur. La fenêtre réelle est 21 h – 6 h à
     * Kinshasa ; sans ce réglage, les suites d'alertes passeraient le jour et
     * échoueraient la nuit, sans qu'aucun code n'ait changé. Une recette ne
     * doit pas changer de résultat selon l'heure à laquelle on la lance.
     *
     * La fenêtre elle-même est couverte ailleurs, et elle y est réellement
     * allumée : `tests/quietHours.test.mjs` (logique, 9 cas) et
     * `tests/e2e/alertEscalation.e2e.test.mjs` (de bout en bout, garde-fou
     * posé explicitement via `process.env` avant l'appel).
     */
    SMS_QUIET_HOURS_ENABLED: 'false',
    EMAIL_PROVIDER: 'webhook',
    EMAIL_WEBHOOK_URL: sink.emailUrl,
    LOG_LEVEL: 'error',
    AGGREGATE_MIN_GROUP_SIZE: '10',
    // V4 NFR-01 — chiffrement des secrets TOTP (clé de test dédiée).
    MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    // V3 USSD-01 / WA-01 — canaux : jeton de vérification et secret de signature.
    WHATSAPP_VERIFY_TOKEN: 'e2e-verify-token',
    WHATSAPP_APP_SECRET: 'e2e-app-secret',
  });

  const { createApp } = await import('../../../src/app.js');
  const { prisma } = await import('../../../src/config/prisma.js');

  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  /** Client HTTP minimal, avec jeton optionnel. */
  /**
   * @param {object} [options.form] Corps `application/x-www-form-urlencoded`.
   *   Indispensable pour les webhooks de fournisseur : Twilio envoie ses accusés
   *   de remise en formulaire, et la signature porte sur ces paramètres. Les
   *   tester en JSON ne prouverait rien sur le chemin réellement utilisé.
   */
  const request = async (
    method,
    route,
    { body, token, headers = {}, raw = false, form = false, rawBody = false } = {},
  ) => {
    const hasBody = body !== undefined && body !== null;
    /**
     * `rawBody: true` envoie la chaîne **telle quelle**. Indispensable pour les
     * webhooks JSON signés par `bodySHA256` : re-sérialiser changerait les
     * octets, donc le hachage, et la validation échouerait pour une raison qui
     * n'a rien à voir avec le code testé.
     */
    const encoded = hasBody
      ? rawBody
        /*
         * Un `Buffer` est transmis **tel quel**. `String(buffer)` le décoderait
         * en UTF-8, et tout octet ≥ 0x80 d'un fichier binaire serait remplacé —
         * le téléversement multipart arriverait corrompu sans qu'aucune erreur
         * ne le signale.
         */
        ? (Buffer.isBuffer(body) ? body : String(body))
        : form
          ? new URLSearchParams(
              Object.entries(body).map(([key, value]) => [key, String(value)]),
            ).toString()
          : JSON.stringify(body)
      : undefined;
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(hasBody ? { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: encoded,
    });

    if (raw) return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { __raw: text };
    }
    return { status: response.status, body: payload };
  };

  return {
    request,
    prisma,
    gotrue,
    stubRecoveryToken: (email) => Promise.resolve(gotrue.lastRecoveryTokenFor(email)),
    /** Jeton de vérification d'adresse que l'e-mail contiendrait (AUTH-03). */
    stubEmailToken: (email) => Promise.resolve(gotrue.lastEmailTokenFor(email)),
    /** URL que l'API a demandée à GoTrue pour le lien de vérification. */
    stubEmailRedirectTo: () => gotrue.lastEmailRedirectTo(),
    sink,
    urls: { baseUrl, databaseUrl, gotrue: gotrue.url },
    stop: async () => {
      await new Promise((resolve) => server.close(resolve));
      await sink.close();
      await gotrue.close();
      await prisma.$disconnect().catch(() => {});
      await pg.stop().catch(() => {});
    },
  };
};
