#!/usr/bin/env node
/**
 * fix-trancheC1V2 - Tranche C : completude PAR ROLE (PROF-03).
 * Le trio exploitation/parcelle/production n est demande qu aux roles de
 * production ; les autres roles ne voient que les criteres universels.
 * La completude ne bloque jamais l acces a un espace (affichage seul).
 * + enregistrement du test e2e completudeByRole dans les scripts npm.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');

const remplacer = (texte, ancre, remplacement, chemin) => {
  if (texte.split(ancre).length !== 2) {
    console.log('ARRET_ANCRE : ' + chemin + ' - motif introuvable ou double - STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(ancre).join(remplacement);
};

const remplacerTout = (texte, motif, remplacement, foisAttendues, chemin) => {
  const fois = texte.split(motif).length - 1;
  if (fois !== foisAttendues) {
    console.log('ARRET_ANCRE : ' + chemin + ' - motif present x' + fois + ' (attendu x' + foisAttendues + ') - STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(motif).join(remplacement);
};

const corriger = (chemin, attendu, operations, options = {}) => {
  let texte = fs.readFileSync(chemin, 'utf8');
  if (sha(texte) !== attendu) {
    console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, aucune ecriture');
    process.exit(1);
  }
  for (const op of operations) {
    texte = op.length === 3
      ? remplacerTout(texte, op[0], op[1], op[2], chemin)
      : remplacer(texte, op[0], op[1], chemin);
  }
  for (const [motif, foisAttendues] of options.verifications ?? []) {
    const fois = texte.split(motif).length - 1;
    if (fois !== foisAttendues) {
      console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + fois + ' (attendu x' + foisAttendues + ') - STOP');
      process.exit(1);
    }
  }
  fs.writeFileSync(chemin, texte);
  console.log('fix-trancheC1V2 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
};

corriger('src/modules/users/users.service.js', 'd600291b7dfdc8c676dc497c6cb6cd6c', [
  [
    "const completenessCriteria = ({ profile, farms, plots, productions }) => [",
    [
      "const ROLES_PRODUCTION = ['FARMER', 'COOPERATIVE_ADMIN', 'COOPERATIVE_MEMBER', 'AGRICULTURAL_COMPANY'];",
      "",
      "const completenessCriteria = ({ profile, farms, plots, productions, roles = [] }) => {",
      "  const criteres = [",
    ].join(NL),
  ],
  [
    [
      "  { key: 'production', label: 'Au moins une production déclarée', done: productions > 0 },",
      "];",
    ].join(NL),
    [
      "  { key: 'production', label: 'Au moins une production déclarée', done: productions > 0 },",
      "  ];",
      "  const horsProduction = new Set(['farm', 'plot', 'production']);",
      "  return roles.some((r) => ROLES_PRODUCTION.includes(r))",
      "    ? criteres",
      "    : criteres.filter((c) => !horsProduction.has(c.key));",
      "};",
    ].join(NL),
  ],
  [
    "  const criteria = completenessCriteria({ profile, farms, plots, productions });",
    [
      "  const roles = profile.memberships.flatMap((m) => m.roles ?? []);",
      "  const criteria = completenessCriteria({ profile, farms, plots, productions, roles });",
    ].join(NL),
  ],
], {
  verifications: [["ROLES_PRODUCTION", 2], ["completenessCriteria({ profile, farms, plots, productions, roles })", 1]],
});

corriger('package.json', '916def14d45d19fc54d8d00f0284b7e4', [
  [
    "tests/e2e/channels.e2e.test.mjs tests/e2e/forecastPipeline.e2e.test.mjs",
    "tests/e2e/channels.e2e.test.mjs tests/e2e/completenessByRole.e2e.test.mjs tests/e2e/forecastPipeline.e2e.test.mjs",
    3,
  ],
  [
    "tests/e2e/journeys.e2e.test.mjs tests/e2e/intelligence.e2e.test.mjs",
    "tests/e2e/journeys.e2e.test.mjs tests/e2e/completenessByRole.e2e.test.mjs tests/e2e/intelligence.e2e.test.mjs",
  ],
], {
  verifications: [["completenessByRole.e2e.test.mjs", 4]],
});

console.log('fix-trancheC1V2 : termine');
