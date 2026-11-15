#!/usr/bin/env node
/**
 * fix-i7-doc — couture : rapport de conformité, §10, item 9 (fait BLOC 60)
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const chemin = 'RAPPORT-CONFORMITE-SUPER-ADMIN.md';
const attendu = '8f3635a781830eeb485c2f1bdad8d707';

const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');
const fichier = fs.readFileSync(chemin, 'utf8');
if (sha(fichier) !== attendu) {
  console.log('ARRET_MD5_FICHIER : RAPPORT-CONFORMITE-SUPER-ADMIN.md inattendu — STOP, colle la sortie');
  process.exit(1);
}

const ancre = '— règle projet).';
if (fichier.split(ancre).length !== 2) {
  console.log('ARRET_ANCRE : item 8 du rapport introuvable ou double — STOP, aucune ecriture');
  process.exit(1);
}

const ajout = [
  '9. **Robustesse des tests (corrigée, BLOC 60)** : `tests/e2e/anomalies.e2e.test.mjs`, seul des sept',
  'fichiers lançant le moteur Python `geoai/server.py` sans attendre sa préparation, a reçu la boucle',
  "d'attente `engineHealth()` (patron `forecastPipeline.e2e.test.mjs`). Sans elle, la suite complète",
  'pouvait tomber en machine sous charge (6 échecs en 500 sur détection/interpolation) ; la suite est',
  'revalidée **1353/1353, 0 échec** sur machine après correction.',
].join(NL);

const parties = fichier.split(ancre);
fs.writeFileSync(chemin, parties[0] + ancre + NL + ajout + parties[1]);
console.log('fix-i7-doc : applique');
