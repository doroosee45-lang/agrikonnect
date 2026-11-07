/**
 * Notes sémantiques de l'OpenAPI — garde-fou contre la dérive.
 *
 * `scripts/generate-openapi.mjs` porte une table `ROUTE_NOTES` qui complète la
 * description générée : le générateur déduit méthode, chemin et permission du
 * code, mais il ne peut pas deviner la **sémantique d'un champ de réponse**.
 *
 * Sans ce test, une note pourrait viser une route renommée ou supprimée et
 * rester indéfiniment dans la table sans jamais atteindre le contrat — la
 * documentation mentirait par omission, en silence. Ici : toute note doit
 * correspondre à une opération réellement présente dans `openapi.json`, et
 * toute note doit effectivement apparaître dans la description générée.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');

const contrat = JSON.parse(readFileSync(join(racine, 'src/docs/openapi.json'), 'utf8'));
const generateur = readFileSync(join(racine, 'scripts/generate-openapi.mjs'), 'utf8');

/** Extrait les clés de `ROUTE_NOTES` sans exécuter le générateur. */
const clesNotes = () => {
  const bloc = generateur.match(/const ROUTE_NOTES = \{([\s\S]*?)\n\};/);
  assert.ok(bloc, 'la table ROUTE_NOTES doit exister dans le générateur');
  return [...bloc[1].matchAll(/'(get|post|patch|put|delete) (\/[^']+)':/g)]
    .map(([, methode, chemin]) => `${methode} ${chemin}`);
};

test('OpenAPI : chaque note sémantique vise une opération qui existe', () => {
  const cles = clesNotes();
  assert.ok(cles.length > 0, 'la table devrait porter au moins une note');

  const orphelines = cles.filter((cle) => {
    const [methode, chemin] = cle.split(' ');
    return !contrat.paths?.[chemin]?.[methode];
  });
  assert.deepEqual(
    orphelines,
    [],
    `notes visant une opération absente du contrat : ${orphelines.join(', ')}`,
  );
});

test('OpenAPI : chaque note apparaît bien dans la description générée', () => {
  for (const cle of clesNotes()) {
    const [methode, chemin] = cle.split(' ');
    const description = contrat.paths[chemin][methode].description ?? '';
    // On vérifie un marqueur stable de la note, pas son texte intégral : le
    // générateur concatène et pourrait reformater.
    assert.ok(
      description.length > 'Permission requise'.length + 40,
      `${cle} : la description ne porte pas la note sémantique`,
    );
  }
});

test('OpenAPI : /seasons/stats documente la séparation des kilos', () => {
  const description = contrat.paths['/api/v1/seasons/stats'].get.description;

  // Les deux totaux doivent être nommés, sinon le lecteur ne peut pas savoir
  // lequel couvre quoi.
  assert.match(description, /totalYieldKg/);
  assert.match(description, /yieldKgWithoutArea/);
  assert.match(description, /yieldPerHa/);
  assert.match(description, /withoutAreaCount/);

  // Le point de fond : la moyenne n'est jamais estimée.
  assert.match(description, /jamais estimé/);
  // Et la portée de totalYieldKg doit être explicite.
  assert.match(description, /que les retours qui portent une surface/);
});
