#!/usr/bin/env node
/*
 * ═════════════════════════════════════════════════════════════════════════
 *  fix-m3-close.mjs — I4/M3 CLÔTURE : passe le doc technique en
 *  « validé sur machine » (§9.1, §10.1, §10.2, §12.1).
 *
 *  5 coutures exactes dans docs/DOC-TECH-3.md. Rien d'autre n'est touché.
 *  Idempotent (rejouable) : déjà appliqué = lignes 🆗, fichier inchangé.
 *
 *  UTILISATION (Git Bash, à la racine du projet) :
 *    node fix-m3-close.mjs
 * ═════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const md5 = (t) => createHash('md5').update(t).digest('hex');
const ok = (m) => console.log(`✅ ${m}`);
const deja = (m) => console.log(`🆗 ${m}`);
const ko = (m) => console.log(`❌ ${m}`);

const chemin = 'docs/DOC-TECH-3.md';
let src = readFileSync(chemin, 'utf8');
const avant = src;
let echecs = 0;

const coutures = [
  [
    "2026-11-02 atelier (1283 M1-M3 antérieurs + 23 M3) · exécution machine : `fix-m3.mjs` livré",
    "2026-11-02 atelier (1283 M1-M3 antérieurs + 23 M3) + machine user (validé le 2026-11-02)",
    "§9.1 npm test — validation machine",
  ],
  [
    "2026-11-02 (post-M3, générateur OpenAPI étendu aux sous-routeurs)",
    "2026-11-02 atelier + machine user (post-M3, générateur OpenAPI étendu aux sous-routeurs)",
    "§9.1 check:mounts — validation machine",
  ],
  [
    "— livré via `fix-m3.mjs` (validation machine attendue)",
    "— livré via `fix-m3.mjs`, validé sur machine le 2026-11-02 (1306/1306, check:mounts 400/396/0/0/0)",
    "§10.1 I4/M3 — validé sur machine",
  ],
  [
    "| *Rien d'autre en cours* | I4/M3 livré le 2026-11-02 (code + tests + contrat) — en attente d'exécution machine (`node fix-m3.mjs` puis `npm test`) ; l'UI Settings web/mobile reste du ressort de M4 |",
    "| **I5 — M5 Supervision + M6 Audit/Sécurité** | Démarré le 2026-11-02 après clôture de I4/M3 (validé sur machine) ; l'UI Settings web/mobile reste du ressort de M4 |",
    "§10.2 — I5 en cours",
  ],
  [
    "(total **1306/1306**) — livré le 2026-11-02 |",
    "(total **1306/1306**) — livré et validé sur machine le 2026-11-02 |",
    "§12.1 I4/M3 — validé sur machine",
  ],
];

for (const [ancien, nouveau, libelle] of coutures) {
  if (src.includes(nouveau)) {
    deja(`${libelle} — déjà appliqué`);
  } else if (src.includes(ancien)) {
    src = src.split(ancien).join(nouveau);
    ok(libelle);
  } else {
    ko(`${libelle} — texte d'ancrage introuvable`);
    echecs += 1;
  }
}

if (echecs) {
  console.log(`❌ ${echecs} couture(s) en échec — fichier NON écrit.`);
  process.exit(1);
}
if (src !== avant) {
  writeFileSync(chemin, src);
  ok('docs/DOC-TECH-3.md écrit');
} else {
  deja('docs/DOC-TECH-3.md inchangé (déjà à jour)');
}
console.log(`   md5 ${md5(readFileSync(chemin, 'utf8'))}  ${chemin}`);
console.log('SUITE : le bloc suivant régénère DOC-TECH-2 et reconstitue DOCUMENTATION_TECHNIQUE.md');
