#!/usr/bin/env node
/**
 * Contrôle de conformité au cahier des charges.
 *
 * `docs/CDC-INVENTAIRE.md` est la transcription de tous les identifiants du
 * cahier des charges (général + V1…V5 + Annexe A). Ce script vérifie que
 * **chacun** d'eux est couvert quelque part dans le dépôt :
 *
 *   - exigence fonctionnelle  → catalogue `scripts/check-requirements.mjs`
 *     (qui exige lui-même un fichier d'implémentation et une preuve de test) ;
 *   - exigence non fonctionnelle (`V#:NFR-##`) → une ligne de `docs/NFR.md`
 *     avec la cible du CDC, la réponse du backend et sa preuve ;
 *   - sous-cas local           → table des alias du catalogue.
 *
 * Un identifiant du CDC sans couverture fait échouer le contrôle.
 *
 * Usage : node scripts/check-cdc.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

const ID_ROW = /^\|\s*`?([A-Z0-9]+:[A-Z0-9-]+|SEC-[0-9]+|[A-Z]{2,5}-[0-9]+)`?\s*\|/gm;

/** 1. Inventaire du cahier des charges. */
const inventory = read('docs/CDC-INVENTAIRE.md');
const cdcIds = [...new Set([...inventory.matchAll(ID_ROW)].map((m) => m[1]))].sort();

/** 2. Catalogue et alias. */
const catalogueSource = read('scripts/check-requirements.mjs');
const catalogueIds = new Set(
  [...catalogueSource.matchAll(/\{\s*id:\s*'([A-Z0-9-]+)'/g)].map((m) => m[1])
);
const aliasIds = new Set(
  [...catalogueSource.matchAll(/^\s*\['([A-Z0-9-]+)',\s*'([A-Z0-9-]+)'/gm)].map((m) => m[1])
);

/** 3. Matrice des exigences non fonctionnelles. */
let nfrIds = new Set();
try {
  const nfrSource = read('docs/NFR.md');
  nfrIds = new Set(
    [...nfrSource.matchAll(/\|\s*`?(V[1-5]:NFR-[0-9]+)`?\s*\|/g)].map((m) => m[1])
  );
} catch {
  /* docs/NFR.md absent : aucune NFR couverte */
}

const uncovered = cdcIds.filter((id) => {
  if (id.includes(':NFR-')) return !nfrIds.has(id);
  return !catalogueIds.has(id) && !aliasIds.has(id);
});

const extras = [...catalogueIds]
  .filter((id) => !cdcIds.includes(id) && !/^(V[1-5]:)/.test(id))
  .sort();

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        cdc: cdcIds.length,
        catalogue: catalogueIds.size,
        alias: aliasIds.size,
        nfr: nfrIds.size,
        nonCouvertes: uncovered,
        complementaires: extras,
      },
      null,
      2
    )
  );
} else {
  const functional = cdcIds.filter((id) => !id.includes(':NFR-')).length;
  const nfr = cdcIds.length - functional;
  console.log(`Identifiants du cahier des charges : ${cdcIds.length} (${functional} fonctionnelles, ${nfr} non fonctionnelles)`);
  console.log(`Catalogue d'exigences              : ${catalogueIds.size} (+ ${aliasIds.size} alias)`);
  console.log(`Exigences non fonctionnelles (NFR) : ${nfrIds.size} documentées`);
  if (uncovered.length) {
    console.log(`\n❌ ${uncovered.length} identifiant(s) du CDC sans couverture :`);
    for (const id of uncovered) console.log(`   ${id}`);
  }
  if (extras.length) {
    console.log(`\nIdentifiants complémentaires ajoutés par l'équipe (hors CDC, ${extras.length}) :`);
    console.log(`   ${extras.join(', ')}`);
  }
  console.log(
    uncovered.length === 0
      ? `\nConformité : chaque identifiant du cahier des charges est couvert.`
      : `\n${uncovered.length} écart(s) de conformité au cahier des charges.`
  );
}

process.exit(uncovered.length === 0 ? 0 : 1);
