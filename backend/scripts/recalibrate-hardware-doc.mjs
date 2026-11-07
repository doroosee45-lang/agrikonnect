#!/usr/bin/env node
/**
 * Recale les numéros de ligne cités dans docs/GEOSPATIAL_BACKEND_CONFIGURATION.md
 * après modification de src/config/hardware.js.
 *
 * Méthode : alignement exact des deux versions du fichier, pas recherche du
 * symbole le plus proche. Les symboles comme `slug`, `model` ou `value`
 * apparaissent des dizaines de fois ; « l'occurrence la plus proche » en recalerait
 * plusieurs sur la même ligne, ce qui est silencieux et faux.
 *
 * L'alignement est fait par plus longue sous-séquence commune entre l'ancienne
 * version du fichier (reconstruite en retirant les blocs ajoutés) et la
 * nouvelle. Chaque ancienne ligne se voit ainsi attribuer sa nouvelle position.
 *
 * Usage : node scripts/recalibrate-hardware-doc.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC = path.join(root, 'docs', 'GEOSPATIAL_BACKEND_CONFIGURATION.md');
const CODE = path.join(root, 'src', 'config', 'hardware.js');

/**
 * Blocs ajoutés par l'étape « acquisition satellite programmée », dans l'ordre.
 * Les retirer redonne exactement le fichier d'origine.
 */
const ADDED_BLOCKS = [
  // Champs du schéma zod.
  `
    /**
     * Fournisseurs d'acquisition disponibles, et les variables qui les pilotent.
     *
     * Le fournisseur actif et les secrets sont des choix de déploiement : ce
     * fichier ne fait que **nommer** les variables d'environnement, exactement
     * comme pour le SMS. C'est ce partage qui permet de passer du simulé au réel
     * sans réécrire le backend.
     */
    providers: z.array(z.string().min(1)).min(1),
    providerEnvVar: z.string().min(1),
    apiUrlEnvVar: z.string().min(1),
    apiKeyEnvVar: z.string().min(1),
    enabledEnvVar: z.string().min(1),
    refreshIntervalEnvVar: z.string().min(1),
    /** Fenêtre de recherche d'une scène, en jours. */
    sceneLookbackDays: sourcedNumber('jours'),
    requestTimeout: sourcedNumber('ms'),
    /** Nombre de tentatives par acquisition. */
    maxAttempts: z.number().int().min(1).max(10),
    retryDelay: sourcedNumber('ms'),
`,
  // Contrainte de cohérence ajoutée à la chaîne de .refine().
  `
    .refine((satellite) => satellite.providers.some((provider) => provider !== 'simulated'), {
      message:
        'Aucun fournisseur réel déclaré : le mode simulé est réservé aux tests et '
        + 'ne peut pas être la seule façon d’acquérir une scène.',
      path: ['providers'],
    }),
`,
  // Bloc de données de la section satellite.
  `
    /**
     * Acquisition programmée.
     *
     * Le **fournisseur actif** et les **secrets** sont des choix de déploiement :
     * ils vivent dans l'environnement, et ce fichier ne fait que nommer les
     * variables. C'est le même partage que pour le SMS, et c'est ce qui permet de
     * passer d'un fournisseur simulé à un fournisseur réel **sans réécrire le
     * backend** : seul \`SATELLITE_PROVIDER\` change.
     */
    providers: ['sentinelhub', 'earthengine', 'webhook', 'simulated'],
    providerEnvVar: 'SATELLITE_PROVIDER',
    apiUrlEnvVar: 'SATELLITE_API_URL',
    apiKeyEnvVar: 'SATELLITE_API_KEY',
    enabledEnvVar: 'SATELLITE_ACQUISITION_ENABLED',
    /**
     * Cadence de **sondage** du fournisseur, distincte de la période de revisite
     * du satellite. On peut interroger l'API tous les jours alors qu'un nouveau
     * produit Sentinel-1 n'apparaît que tous les 6 à 12 jours : le sondage
     * quotidien ne produit alors aucune scène nouvelle, et c'est normal.
     *
     * La valeur reste dans l'environnement : elle dépend du quota retenu.
     */
    refreshIntervalEnvVar: 'SATELLITE_REFRESH_HOURS',
    /** Fenêtre de recherche d'une scène, en jours. */
    sceneLookbackDays: {
      value: 12,
      unit: 'jours',
      source:
        'Calé sur la période de revisite de Sentinel-1 (6 à 12 jours selon la '
        + 'latitude et le nombre de satellites). Une fenêtre plus courte laisserait '
        + 'passer des scènes ; plus longue, elle mélangerait des états du sol trop '
        + 'éloignés dans le temps.',
    },
    /**
     * Délai maximal d'un appel fournisseur, en millisecondes.
     *
     * \`null\` tant que la passerelle n'est pas retenue : on ne fixe pas un délai
     * inventé, et le mode matériel \`REAL\` refuse de démarrer sans cette valeur.
     */
    requestTimeout: {
      value: null,
      unit: 'ms',
      source: \`\${TO_CONFIRM} — dépend du fournisseur retenu (Sentinel Hub, Earth Engine).\`,
    },
    /** Nombre de tentatives par acquisition, avant de renoncer et de tracer l'échec. */
    maxAttempts: 2,
    retryDelay: {
      value: null,
      unit: 'ms',
      source: \`\${TO_CONFIRM} — à caler sur les limites de débit du fournisseur retenu.\`,
    },
`,
];

const current = fs.readFileSync(CODE, 'utf8');
let original = current;
for (const block of ADDED_BLOCKS) {
  if (!original.includes(block)) {
    process.stderr.write(`Bloc introuvable dans ${path.relative(root, CODE)} — recalage abandonné.\n`);
    process.exit(2);
  }
  original = original.replace(block, '\n');
}

const oldLines = original.split('\n');
const newLines = current.split('\n');
process.stdout.write(`fichier : ${oldLines.length} -> ${newLines.length} lignes\n`);

/**
 * Carte ancienne ligne -> nouvelle ligne, par appariement séquentiel.
 *
 * Les lignes ajoutées sont connues et localisées ; tout le reste conserve son
 * ordre relatif. Un simple parcours séquentiel suffit donc, sans algorithme de diff.
 */
const oldToNew = new Map();
let oldIndex = 0;
let newIndex = 0;
const addedLineNumbers = new Set();
for (const block of ADDED_BLOCKS) {
  const at = current.indexOf(block);
  const before = current.slice(0, at).split('\n').length;
  for (let k = 0; k < block.split('\n').length - 1; k += 1) addedLineNumbers.add(before + k);
}

for (let i = 1; i <= newLines.length; i += 1) {
  if (addedLineNumbers.has(i)) continue;
  oldIndex += 1;
  oldToNew.set(oldIndex, i);
}

// Contrôle : l'appariement doit reproduire le même texte.
let mismatch = 0;
for (const [oldLine, newLine] of oldToNew) {
  if (oldLines[oldLine - 1] !== newLines[newLine - 1]) mismatch += 1;
}
process.stdout.write(`appariement : ${oldToNew.size} lignes, ${mismatch} discordance(s)\n`);
if (mismatch > 0) {
  process.stderr.write('Appariement incohérent — recalage abandonné.\n');
  process.exit(2);
}

const docLines = fs.readFileSync(DOC, 'utf8').split('\n');
const rows = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const changes = [];
let lineCol = null;

const remap = (cited) => oldToNew.get(cited) ?? null;

for (let i = 0; i < docLines.length; i += 1) {
  const line = docLines[i];

  if (line.startsWith('|')) {
    if (lineCol === null) {
      if (line.includes('Ligne')) {
        const cells = rows(line);
        lineCol = cells.includes('Ligne') ? cells.indexOf('Ligne') : null;
      }
    } else if (!/^\s*[\s|:-]+$/.test(line)) {
      const cells = rows(line);
      const raw = cells[lineCol];
      if (raw && /^\d{2,4}$/.test(raw)) {
        const cited = Number(raw);
        const target = remap(cited);
        if (target !== null && target !== cited) {
          const updated = line.replace(new RegExp(`(\\|\\s*)${raw}(\\s*\\|)`), `$1${target}$2`);
          if (updated !== line) {
            docLines[i] = updated;
            changes.push({ docLine: i + 1, from: cited, to: target, code: newLines[target - 1].trim() });
          }
        }
      }
    }
  } else {
    lineCol = null;
    let updated = line;
    for (const m of line.matchAll(/\bligne (\d{2,4})\b/g)) {
      const cited = Number(m[1]);
      const target = remap(cited);
      if (target !== null && target !== cited) {
        updated = updated.replace(new RegExp(`\\bligne ${cited}\\b`), `ligne ${target}`);
        changes.push({ docLine: i + 1, from: cited, to: target, code: newLines[target - 1].trim() });
      }
    }
    docLines[i] = updated;
  }
}

if (process.argv.includes('--write')) fs.writeFileSync(DOC, docLines.join('\n'));

process.stdout.write(`${changes.length} recalage(s)${process.argv.includes('--write') ? ' écrit(s)' : ' (aperçu)'}\n`);
for (const c of changes) {
  process.stdout.write(`  doc:${c.docLine}  ${c.from} -> ${c.to}   |  ${c.code}\n`);
}
