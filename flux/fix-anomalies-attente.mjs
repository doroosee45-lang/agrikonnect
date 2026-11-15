#!/usr/bin/env node
/**
 * fix-anomalies-attente — couture : anomalies.e2e attend le moteur Python
 *
 * tests/e2e/anomalies.e2e.test.mjs est le SEUL des sept fichiers qui spawnent
 * geoai/server.py sans boucle d'attente de préparation (les six autres
 * sondent engineHealth()). En suite complète sur machine chargée, le moteur
 * n'est pas joignable quand la détection l'appelle : 500 INTERNAL_ERROR.
 * Le script copie le patron de forecastPipeline.e2e.test.mjs.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const chemin = 'tests/e2e/anomalies.e2e.test.mjs';
const attendu = 'cca9c59f704f247aa8c3ca832cdf2c2d';

const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');
const fichier = fs.readFileSync(chemin, 'utf8');
if (sha(fichier) !== attendu) {
  console.log('ARRET_MD5_FICHIER : tests/e2e/anomalies.e2e.test.mjs inattendu — STOP, colle la sortie');
  process.exit(1);
}

// ── couture 1 : le journal de sortie du moteur, à côté des autres déclarations
const ancre1 = 'let previousGeoaiUrl;';
const ajout1 = 'const engineLog = [];';
if (fichier.split(ancre1).length !== 2) {
  console.log('ARRET_ANCRE_1 : declaration introuvable ou double — STOP, aucune ecriture');
  process.exit(1);
}

// ── couture 2 : l'attente de préparation, copiée de forecastPipeline.e2e.test.mjs
const ancre2 = 'process.env.GEOAI_URL = `http://127.0.0.1:${port}`;';
const ajout2 = [
  '',
  "  engine.stderr.on('data', (chunk) => engineLog.push(String(chunk)));",
  '',
  "  const { engineHealth } = await import('../../src/integrations/geospatial.js');",
  '  let ready = false;',
  '  for (let attempt = 0; attempt < 80 && !ready; attempt += 1) {',
  '    // eslint-disable-next-line no-await-in-loop',
  '    await new Promise((resolve) => setTimeout(resolve, 100));',
  '    // eslint-disable-next-line no-await-in-loop',
  '    ready = (await engineHealth()).available === true;',
  '  }',
  '  assert.equal(',
  '    ready,',
  '    true,',
  '    `le moteur Python doit etre joignable pour cette recette. cwd=${ROOT}, port=${port}, `',
  '    + `sortie du moteur : ${engineLog.join("") || "(vide)"}`,',
  '  );',
].join(NL);
if (fichier.split(ancre2).length !== 2) {
  console.log('ARRET_ANCRE_2 : assignation GEOAI_URL introuvable ou double — STOP, aucune ecriture');
  process.exit(1);
}

const p1 = fichier.split(ancre1);
const avecModule = p1[0] + ancre1 + NL + ajout1 + p1[1];
const p2 = avecModule.split(ancre2);
const final = p2[0] + ancre2 + NL + ajout2 + p2[1];
fs.writeFileSync(chemin, final);
console.log('fix-anomalies-attente : applique');
