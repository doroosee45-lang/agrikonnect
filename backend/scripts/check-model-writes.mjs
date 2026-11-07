/**
 * Contrôle des points d'écriture — modèles de la mission géospatiale.
 *
 * Un modèle Prisma sans écriture est une table vide : le schéma promet une
 * capacité que le code ne fournit pas. Aucun contrôle existant ne le détectait —
 * `check-cdc` vérifie qu'une famille du CDC a un module, des routes, une
 * permission et un test, mais rien ne réclame un modèle précis. Trois modèles
 * sont restés orphelins sans qu'aucune porte ne rougisse.
 *
 * Deux pièges couverts explicitement :
 *
 *  1. **Le client de transaction.** `decideRecommendation` écrit via
 *     `tx.cropRecommendation.update`, pas `prisma.…`. Une recherche limitée à
 *     `prisma.` sous-estime les écritures et ferait échouer ce contrôle à tort.
 *  2. **Les exceptions qui pourrissent.** Une exception dont le modèle finit par
 *     être câblé doit disparaître de la liste : le contrôle échoue tant qu'elle
 *     y reste, pour que la liste ne devienne pas un cimetière.
 *
 * Usage : `npm run check:models`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Modèles ajoutés pour la mission géospatiale.
 *
 * Chaque nom est vérifié contre `prisma/schema.prisma` : une faute de frappe
 * ici rendrait le contrôle aveugle au modèle concerné.
 */
const GEOSPATIAL_MODELS = [
  'CropRecommendation',
  'ThresholdAlert',
  'SoilPrediction',
  'InterpolatedMap',
  'SensorAnomaly',
  'SeasonFeedback',
  'AiModelVersion',
];

/**
 * Modèles sans écriture **assumée**, avec la raison.
 *
 * Une exception sans justification n'a pas de valeur : elle dit seulement que
 * personne n'a regardé. La raison est affichée à chaque exécution.
 */
const ACCEPTED_WITHOUT_WRITE = {
  /*
   * `GeospatialImport` a quitté cette liste : le module
   * `src/modules/geospatialImport/` écrit désormais la ligne (dépôt de fichiers
   * géoradar et drone, statut `RECEIVED` uniquement — aucun traitement du
   * contenu). L'ancienne raison d'exemption (« aucune capacité d'upload ») est
   * devenue fausse ; une exception obsolète masque un modèle réellement câblé.
   */
  /*
   * `SeasonFeedback` a quitté cette liste : le module `src/modules/seasons/`
   * écrit désormais le rendement réellement obtenu (3 points d'écriture). Le
   * contrôle refuse une exception devenue obsolète, c'est son rôle — la laisser
   * masquerait un modèle qu'on croirait encore non câblé.
   */
};

const WRITE_OPERATIONS = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
];

/** Nom du modèle → accesseur Prisma (`CropRecommendation` → `cropRecommendation`). */
const accessorOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

/** Recense les fichiers `.js` sous `src/`, sans descendre dans node_modules. */
const listSourceFiles = (dir) => {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') found.push(...listSourceFiles(full));
    } else if (entry.name.endsWith('.js')) {
      found.push(full);
    }
  }
  return found;
};

const run = () => {
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const declaredModels = new Set(
    [...schema.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)].map((match) => match[1]),
  );

  const errors = [];

  // Une liste qui diverge du schéma est un contrôle aveugle.
  for (const model of GEOSPATIAL_MODELS) {
    if (!declaredModels.has(model)) {
      errors.push(`« ${model} » est listé mais absent de prisma/schema.prisma.`);
    }
  }
  for (const model of Object.keys(ACCEPTED_WITHOUT_WRITE)) {
    if (!GEOSPATIAL_MODELS.includes(model)) {
      errors.push(`« ${model} » est dans les exceptions mais pas dans GEOSPATIAL_MODELS.`);
    }
  }
  if (errors.length > 0) {
    for (const error of errors) console.error(`  ✗ ${error}`);
    console.error(`\n${errors.length} erreur(s) de configuration du contrôle.`);
    process.exit(1);
  }

  const files = listSourceFiles(path.join(root, 'src'));
  const counts = new Map();
  const where = new Map();

  for (const model of GEOSPATIAL_MODELS) {
    counts.set(model, 0);
    where.set(model, new Set());
  }

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const model of GEOSPATIAL_MODELS) {
      const accessor = accessorOf(model);
      // `prisma.` ET `tx.` / `client.` : les écritures en transaction passent par
      // le client reçu en paramètre, jamais par l'import global.
      const pattern = new RegExp(
        `\\b(?:prisma|tx|client|db)\\.${accessor}\\.(${WRITE_OPERATIONS.join('|')})\\b`,
        'g',
      );
      /**
       * Recherche sur le fichier entier, pas ligne par ligne : un appel Prisma
       * s'écrit couramment sur plusieurs lignes (`prisma\n  .sensorAnomaly\n  .upsert(…)`).
       * Une recherche par ligne les manque toutes — et un audit d'écriture qui
       * sous-estime est pire qu'aucun audit.
       *
       * On reconstitue ensuite le numéro de ligne à partir de l'offset du match.
       */
      let match = null;
      while ((match = pattern.exec(source)) !== null) {
        const line = source.slice(0, match.index).split('\n').length;
        counts.set(model, counts.get(model) + 1);
        where.get(model).add(`${path.relative(root, file)}:${line}`);
      }
      pattern.lastIndex = 0;
    }
  }

  const orphans = [];
  const stale = [];

  console.log('Points d’écriture — modèles de la mission géospatiale\n');
  console.log('  Modèle                Écritures  Emplacements');
  for (const model of GEOSPATIAL_MODELS) {
    const count = counts.get(model);
    const places = [...where.get(model)].slice(0, 3).join(', ');
    const marker = count === 0 ? ' ⚠' : '';
    console.log(`  ${model.padEnd(20)} ${String(count).padStart(9)}  ${places}${marker}`);

    if (count === 0 && !ACCEPTED_WITHOUT_WRITE[model]) orphans.push(model);
    if (count > 0 && ACCEPTED_WITHOUT_WRITE[model]) stale.push(model);
  }

  const accepted = GEOSPATIAL_MODELS.filter(
    (model) => counts.get(model) === 0 && ACCEPTED_WITHOUT_WRITE[model],
  );
  if (accepted.length > 0) {
    console.log('\n  Sans écriture, assumé :');
    for (const model of accepted) {
      console.log(`   • ${model} — ${ACCEPTED_WITHOUT_WRITE[model]}`);
    }
  }

  if (stale.length > 0) {
    console.error('\n  ✗ Exception(s) devenue(s) obsolète(s) — le modèle est désormais câblé,');
    console.error('    retirez-le de ACCEPTED_WITHOUT_WRITE :');
    for (const model of stale) {
      console.error(`      ${model} (${counts.get(model)} écriture(s))`);
    }
  }

  if (orphans.length > 0) {
    console.error('\n  ✗ Modèle(s) sans aucun point d’écriture et sans exception justifiée :');
    for (const model of orphans) {
      console.error(`      ${model}`);
    }
    console.error('\n    Un modèle jamais écrit est une table vide. Soit le câbler,');
    console.error('    soit l’ajouter à ACCEPTED_WITHOUT_WRITE avec une raison.');
  }

  const failures = orphans.length + stale.length;
  if (failures > 0) {
    console.error(`\n${failures} écart(s).`);
    process.exit(1);
  }

  console.log(`\nAucun écart : ${GEOSPATIAL_MODELS.length - accepted.length} modèle(s) câblé(s), `
    + `${accepted.length} exception(s) justifiée(s).`);
};

run();
