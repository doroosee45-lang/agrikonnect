#!/usr/bin/env node
/**
 * Contre-épreuves automatiques — `npm run contre-epreuves`.
 *
 * ## Pourquoi ce script existe
 *
 * Un test de scan structurel qui **ne peut pas échouer** est indiscernable d'un
 * test cassé. Les garde-fous des écrans 2 et 3 interdisent des motifs précis
 * dans le source des clients ; si ces motifs sont mal écrits, les tests restent
 * verts pour toujours et ne protègent plus rien.
 *
 * Ce script rejoue donc, pour chaque garde-fou, la contre-épreuve faite à la
 * main : **réintroduire le défaut → vérifier que le test échoue et nomme le
 * bon motif → restaurer → vérifier l'identité du fichier**.
 *
 * ## Nettoyage garanti
 *
 * Le script modifie des fichiers du dépôt. Il ne doit jamais les laisser
 * modifiés. Cinq filets, indépendants :
 *
 * 1. le contenu d'origine est conservé **en mémoire** dès le départ ;
 * 2. il est aussi copié dans un **dossier de sauvegarde hors du dépôt**
 *    (`os.tmpdir()`), avec un manifeste — voir le filet 5 ;
 * 3. chaque contre-épreuve restaure dans un `finally` ;
 * 4. `SIGINT`, `SIGTERM`, `uncaughtException`, `unhandledRejection` et `exit`
 *    restaurent avant de sortir ;
 * 5. **auto-réparation au démarrage** : si le dossier de sauvegarde existe
 *    encore, c'est qu'un lancement précédent a été tué brutalement (`SIGKILL`,
 *    coupure de courant) — aucun gestionnaire ne survit à cela. Le script
 *    restaure alors les fichiers depuis la sauvegarde, le signale, puis
 *    continue.
 *
 * Un contrôle d'intégrité final **refait l'empreinte** de chaque fichier visé
 * et la compare à celle du départ : si quoi que ce soit diffère, le script sort
 * en erreur en le nommant.
 *
 * ### Deux pièges mesurés, pas supposés
 *
 * - **`spawnSync` avale `SIGINT`.** Vérifié : un signal envoyé pendant
 *   `spawnSync` n'exécute **jamais** le gestionnaire et le processus poursuit
 *   jusqu'au bout. Les tests sont donc lancés en **asynchrone** (`spawn` +
 *   `await`) : la boucle d'événements reste vivante et les signaux passent.
 * - **Aucun fichier n'est écrit dans le dépôt pour vérifier.** La comparaison
 *   `diff -q` se fait contre la copie de sauvegarde (hors dépôt) : même tué au
 *   mauvais moment, le script ne laisse pas de `.tmp` dans le dépôt.
 *
 * L'identité est vérifiée par **empreinte SHA-256** (octet à octet), avec un
 * `diff -q` en plus quand la commande existe. L'empreinte est le filet réel :
 * elle est portable, alors que `diff` manque sur un Windows sans Git Bash.
 *
 * ## Trois façons d'échouer, toutes voulues
 *
 * - l'**ancre** de la mutation est introuvable → le source a changé, la
 *   contre-épreuve ne prouve plus rien ;
 * - le test **passe** après la mutation → le garde-fou est mort ;
 * - le test échoue **sans nommer** le motif attendu → il échoue pour une autre
 *   raison, ce qui masquerait une vraie régression.
 */
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(ICI, '..');
const RACINE = path.resolve(BACKEND, '..');

/** Hors du dépôt : une sauvegarde dedans pourrait partir dans une livraison. */
const SAUVEGARDE = path.join(os.tmpdir(), 'agrikonnect-contre-epreuves');
const MANIFESTE = path.join(SAUVEGARDE, 'manifeste.json');

const sha256 = (contenu) => crypto.createHash('sha256').update(contenu).digest('hex');

/** Remplacement simple, qui refuse de passer inaperçu si l'ancre a disparu. */
const remplacer = (avant, apres) => (source) => {
  if (!source.includes(avant)) {
    throw new Error(`ancre introuvable : ${JSON.stringify(avant.slice(0, 70))}`);
  }
  return source.replace(avant, apres);
};

/* ═══════════════════════════ les contre-épreuves ═══════════════════════════ */

const CONTRE_EPREUVES = [
  {
    id: 'alertes/ternaire-source',
    titre: 'libellé de source recopié dans un ternaire (web)',
    fichier: 'apps/web/src/pages/farmer/Alerts.tsx',
    test: 'tests/alertLabels.test.mjs',
    muter: remplacer(
      '            {alert.sourceTypeLabel}',
      "            {alert.sourceType === 'SENSOR_SILENCE' ? 'Capteur silencieux' : alert.sourceTypeLabel}",
    ),
    attendus: ['ternaire source vers français'],
  },
  {
    id: 'alertes/code-brut-mobile',
    titre: 'code de gravité affiché tel quel (mobile)',
    fichier: 'apps/Mobile/src/app/farmer/alerts.tsx',
    test: 'tests/alertLabels.test.mjs',
    muter: remplacer('<Chip label={alert.severityLabel}', '<Chip label={alert.severity}'),
    attendus: ['affiche alert.severity brut', 'severityLabel'],
  },
  {
    id: 'alertes/filtre-severity',
    titre: 'filtre `severity` inopérant réintroduit dans alertApi (web)',
    fichier: 'apps/web/src/services/endpoints.ts',
    test: 'tests/alertLabels.test.mjs',
    muter: remplacer(
      '      sourceType?: AlertSourceType;',
      '      sourceType?: AlertSourceType;\n      severity?: AlertSeverity;',
    ),
    attendus: ['filtre severity inopérant'],
  },
  {
    id: 'alertes/meta-apres-id',
    titre: '/alerts/meta déclarée après /:id (avalée par le paramètre)',
    fichier: 'backend/src/modules/alerts/alerts.routes.js',
    test: 'tests/alertLabels.test.mjs',
    /*
     * Permutation des deux littéraux : l'ordre de déclaration s'inverse, ce qui
     * est exactement le défaut. Un simple remplacement produirait deux `'/:id'`
     * et ferait échouer le test pour la mauvaise raison (« route disparue »).
     */
    muter: (source) => {
      const META = "'/meta'";
      const ID = "'/:id'";
      const i = source.indexOf(META);
      const j = source.indexOf(ID);
      if (i === -1 || j === -1) throw new Error("ancre introuvable : '/meta' ou '/:id'");
      if (i > j) throw new Error("'/meta' est déjà déclarée après '/:id'");
      return (
        source.slice(0, i) +
        ID +
        source.slice(i + META.length, j) +
        META +
        source.slice(j + ID.length)
      );
    },
    attendus: ['déclarée après /:id'],
  },
  {
    id: 'recommandations/libelle-recopie',
    titre: 'libellé de règle de combinaison recopié en dur (écran 2, web)',
    fichier: 'apps/web/src/pages/farmer/Plots/RecommendationMethod.tsx',
    test: 'tests/recommendationLabels.test.mjs',
    muter: remplacer(
      '              {combinationRuleLabel}',
      "              {combinationRule === 'MOST_LIMITING' ? 'facteur le plus limitant' : combinationRuleLabel}",
    ),
    attendus: ['facteur le plus limitant', 'combinationRule'],
  },
];

/* ═══════════════════ sauvegarde et restauration garanties ═══════════════════ */

/** Chemin absolu → contenu d'origine. Rempli une fois, au départ. */
const ORIGINAUX = new Map();
/** Chemins actuellement modifiés (vide entre deux contre-épreuves). */
const MODIFIES = new Set();
let nettoyageFait = false;

const restaurer = () => {
  for (const [absolu, contenu] of ORIGINAUX) {
    try {
      if (fs.readFileSync(absolu, 'utf8') !== contenu) fs.writeFileSync(absolu, contenu);
    } catch {
      /*
       * Un fichier devenu illisible est signalé par le contrôle d'intégrité
       * final : échouer ici masquerait les autres restaurations en cours.
       */
    }
  }
  MODIFIES.clear();
};

const quitter = (code) => {
  if (!nettoyageFait) {
    nettoyageFait = true;
    restaurer();
    fs.rmSync(SAUVEGARDE, { recursive: true, force: true });
  }
  process.exit(code);
};

const surSignal = (nom, code) => () => {
  process.stderr.write(
    `\n[contre-épreuves] ${nom} — fichiers restaurés, sauvegarde supprimée.\n`,
  );
  quitter(code);
};

process.on('SIGINT', surSignal('SIGINT reçu', 130));
process.on('SIGTERM', surSignal('SIGTERM reçu', 143));
process.on('uncaughtException', (erreur) => {
  process.stderr.write(`\n[contre-épreuves] exception : ${erreur?.stack ?? erreur}\n`);
  quitter(1);
});
process.on('unhandledRejection', (raison) => {
  process.stderr.write(`\n[contre-épreuves] rejet : ${raison}\n`);
  quitter(1);
});
/* `exit` est synchrone : dernier filet en processus, y compris après process.exit(). */
process.on('exit', () => {
  if (!nettoyageFait) {
    nettoyageFait = true;
    restaurer();
  }
});

/**
 * Filet 5 — auto-réparation.
 *
 * Un `SIGKILL` ou une coupure de courant ne laisse aucun gestionnaire
 * s'exécuter. La seule protection possible est de **constater au démarrage
 * suivant** qu'une sauvegarde traîne, et de s'en servir.
 */
const reparerInterruptionPrecedente = () => {
  if (!fs.existsSync(MANIFESTE)) return;
  let entrees;
  try {
    entrees = JSON.parse(fs.readFileSync(MANIFESTE, 'utf8'));
  } catch {
    fs.rmSync(SAUVEGARDE, { recursive: true, force: true });
    return;
  }
  const restaures = [];
  for (const { absolu, copie } of entrees) {
    try {
      if (!fs.existsSync(copie)) continue;
      const original = fs.readFileSync(copie, 'utf8');
      if (fs.readFileSync(absolu, 'utf8') !== original) {
        fs.writeFileSync(absolu, original);
        restaures.push(path.relative(RACINE, absolu));
      }
    } catch {
      /* un fichier illisible sera signalé par le contrôle d'intégrité final */
    }
  }
  fs.rmSync(SAUVEGARDE, { recursive: true, force: true });
  process.stdout.write(
    `\n  ⚠ Un lancement précédent a été interrompu brutalement.\n` +
      `    ${restaures.length} fichier(s) restauré(s) depuis la sauvegarde : ${
        restaures.join(', ') || 'aucun'
      }\n`,
  );
};

/* ════════════════════════════ exécution ════════════════════════════════════ */

/**
 * Lance un test **en asynchrone**.
 *
 * Pas de `spawnSync` : mesuré, un `SIGINT` reçu pendant `spawnSync` n'exécute
 * jamais le gestionnaire de signal et le processus poursuit normalement. La
 * boucle d'événements doit rester vivante pour que l'interruption soit
 * réellement prise en compte.
 */
const lancerTest = (relatif) =>
  new Promise((resoudre) => {
    const enfant = spawn(process.execPath, ['--test', relatif], {
      cwd: BACKEND,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let sortie = '';
    enfant.stdout.on('data', (d) => {
      sortie += d;
    });
    enfant.stderr.on('data', (d) => {
      sortie += d;
    });
    // Une borne évite un blocage silencieux.
    const borne = setTimeout(() => enfant.kill('SIGKILL'), 180_000);
    enfant.on('close', (code) => {
      clearTimeout(borne);
      resoudre({ code: code ?? -1, sortie });
    });
    enfant.on('error', (erreur) => {
      clearTimeout(borne);
      resoudre({ code: -1, sortie: `${sortie}\n${erreur.message}` });
    });
  });

const diffDisponible = spawnSync('diff', ['--version'], { encoding: 'utf8' }).status === 0;

/** Identité octet à octet, vérifiée sans rien écrire dans le dépôt. */
const identique = (absolu, contenuAttendu, copie) => {
  if (sha256(fs.readFileSync(absolu, 'utf8')) !== sha256(contenuAttendu)) return false;
  if (!diffDisponible) return true;
  return spawnSync('diff', ['-q', copie, absolu], { encoding: 'utf8' }).status === 0;
};

const principal = async () => {
  process.stdout.write('\n  Contre-épreuves des garde-fous structurels\n');

  // Filet 5 avant toute chose : un dépôt laissé sale par un run tué est réparé.
  reparerInterruptionPrecedente();

  // Sauvegarde AVANT toute modification : en mémoire + hors dépôt.
  const EMPREINTES = new Map();
  const COPIES = new Map();
  const entrees = [];
  fs.mkdirSync(SAUVEGARDE, { recursive: true });

  for (const [index, epreuve] of CONTRE_EPREUVES.entries()) {
    const absolu = path.join(RACINE, epreuve.fichier);
    if (!fs.existsSync(absolu)) {
      process.stderr.write(`\n✗ fichier absent : ${epreuve.fichier}\n`);
      quitter(1);
    }
    const contenu = fs.readFileSync(absolu, 'utf8');
    ORIGINAUX.set(absolu, contenu);
    EMPREINTES.set(absolu, sha256(contenu));
    const copie = path.join(SAUVEGARDE, `original-${index}`);
    fs.writeFileSync(copie, contenu);
    COPIES.set(absolu, copie);
    entrees.push({ absolu, copie });
  }
  fs.writeFileSync(MANIFESTE, JSON.stringify(entrees, null, 2));

  const echecs = [];
  process.stdout.write(`\n`);

  for (const [index, epreuve] of CONTRE_EPREUVES.entries()) {
    const absolu = path.join(RACINE, epreuve.fichier);
    process.stdout.write(
      `  ${index + 1}/${CONTRE_EPREUVES.length} ${epreuve.id}\n    ${epreuve.titre}\n`,
    );

    try {
      let muté;
      try {
        muté = epreuve.muter(ORIGINAUX.get(absolu));
      } catch (erreur) {
        echecs.push(`${epreuve.id} — mutation impossible : ${erreur.message}`);
        process.stdout.write(`    ✗ ${erreur.message}\n\n`);
        continue;
      }
      fs.writeFileSync(absolu, muté);
      MODIFIES.add(absolu);

      const { code, sortie } = await lancerTest(epreuve.test);
      if (code === 0) {
        echecs.push(
          `${epreuve.id} — le test PASSE avec le défaut : le garde-fou ne protège plus rien`,
        );
        process.stdout.write('    ✗ le test passe avec le défaut réintroduit\n\n');
        continue;
      }
      const manquants = epreuve.attendus.filter((motif) => !sortie.includes(motif));
      if (manquants.length > 0) {
        echecs.push(
          `${epreuve.id} — échec non attribué, motifs absents de la sortie : ${manquants.join(', ')}`,
        );
        process.stdout.write(`    ✗ échoue sans nommer : ${manquants.join(', ')}\n\n`);
        continue;
      }

      fs.writeFileSync(absolu, ORIGINAUX.get(absolu));
      MODIFIES.delete(absolu);
      if (!identique(absolu, ORIGINAUX.get(absolu), COPIES.get(absolu))) {
        echecs.push(`${epreuve.id} — restauration incomplète, le fichier diffère de l'original`);
        process.stdout.write('    ✗ fichier non identique après restauration\n\n');
        continue;
      }

      process.stdout.write(
        `    ✓ échoue en nommant « ${epreuve.attendus[0]} » · restauré, empreinte identique${
          diffDisponible ? ' (diff -q)' : ''
        }\n\n`,
      );
    } catch (erreur) {
      echecs.push(`${epreuve.id} — ${erreur.message}`);
      process.stdout.write(`    ✗ ${erreur.message}\n\n`);
    } finally {
      // Filet n°3 : quoi qu'il arrive dans cette itération, on remet l'original.
      if (MODIFIES.has(absolu)) {
        fs.writeFileSync(absolu, ORIGINAUX.get(absolu));
        MODIFIES.delete(absolu);
      }
    }
  }

  /*
   * Contrôle d'intégrité final : on refait l'empreinte de chaque fichier visé.
   * C'est ce qui transforme « le nettoyage est censé marcher » en « le dépôt est
   * vérifié identique au départ ».
   */
  const derives = [];
  for (const [absolu, attendue] of EMPREINTES) {
    if (sha256(fs.readFileSync(absolu, 'utf8')) !== attendue) {
      derives.push(path.relative(RACINE, absolu));
    }
  }

  process.stdout.write('  Intégrité du dépôt\n');
  if (derives.length > 0) {
    process.stdout.write(`    ✗ fichiers différents de l'état initial : ${derives.join(', ')}\n`);
  } else {
    process.stdout.write(
      `    ✓ ${EMPREINTES.size} fichiers visés, empreintes identiques à l'état initial\n`,
    );
  }

  process.stdout.write(
    `\n  ${CONTRE_EPREUVES.length - echecs.length}/${CONTRE_EPREUVES.length} contre-épreuves concluantes\n\n`,
  );

  // Fin normale : la sauvegarde n'a plus d'utilité.
  fs.rmSync(SAUVEGARDE, { recursive: true, force: true });
  nettoyageFait = true;

  if (echecs.length > 0) {
    for (const echec of echecs) process.stdout.write(`  ✗ ${echec}\n`);
    process.stdout.write('\n');
    process.exitCode = 1;
    return;
  }
  if (derives.length > 0) process.exitCode = 1;
};

await principal();
