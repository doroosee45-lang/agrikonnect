/**
 * Écran 2 — les libellés du moteur viennent de l'API, pas des écrans.
 *
 * ## Le défaut couvert
 *
 * Les deux écrans de recommandations recopiaient les libellés de la règle de
 * combinaison :
 *
 * ```tsx
 * {entry.combinationRule === 'MOST_LIMITING' ? ' · facteur le plus limitant' : ''}
 * {entry.combinationRule === 'MEAN_SATISFIED' ? ' · moyenne des critères' : ''}
 * ```
 *
 * Ce code est juste pour les deux règles connues et **muet** pour toute autre
 * valeur. Une règle ajoutée au moteur ne produirait aucune erreur : l'écran
 * cesserait simplement de dire selon quoi le score est calculé — précisément
 * l'information qui rend un score interprétable.
 *
 * Même famille de défaut : `notEvaluated.join(', ')` alors que l'API renvoie des
 * objets. Le type client déclarait `string[]`, donc ça compilait, et l'écran
 * affichait `[object Object]`.
 *
 * ## Portée
 *
 * Test **structurel** : il lit le source des écrans et du service. Les écrans
 * restent vérifiés par compilation uniquement — ce test ne prouve pas ce qui
 * s'affiche, il prouve que le code lit les champs de l'API et ne recopie pas
 * leur texte.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lire = (relatif) => fs.readFile(path.join(RACINE, relatif), 'utf8');

const ECRANS = [
  { nom: 'web', fichier: 'apps/web/src/pages/farmer/Plots/Recommendations.tsx' },
  { nom: 'mobile', fichier: 'apps/Mobile/src/app/farmer/plots/[id]/recommendations.tsx' },
];

const COMPOSANTS = [
  { nom: 'web', fichier: 'apps/web/src/pages/farmer/Plots/RecommendationMethod.tsx' },
  { nom: 'mobile', fichier: 'apps/Mobile/src/components/farmer/RecommendationMethod.tsx' },
];

/** Retire les commentaires : les défauts y sont décrits, pas commis. */
const sansCommentaires = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '');

const code = new Map();
for (const { fichier } of [...ECRANS, ...COMPOSANTS]) {
  code.set(fichier, sansCommentaires(await lire(fichier)));
}

/* ─────────────── aucune recopie de libellé du moteur ─────────────── */

test('écran 2 — aucun écran ne recopie les libellés de règle de combinaison', () => {
  const fautifs = [];
  for (const { nom, fichier } of [...ECRANS, ...COMPOSANTS]) {
    const source = code.get(fichier);
    /*
     * Ce qui est interdit, c'est le **couplage identifiant → libellé**. Une
     * comparaison à `'MOST_LIMITING'` suivie d'une chaîne française est exactly
     * cela ; afficher `combinationRuleLabel` ne l'est pas.
     */
    if (/combinationRule\s*===/.test(source)) {
      fautifs.push(`${nom} → comparaison sur combinationRule (libellé recopié)`);
    }
    for (const libelle of ['facteur le plus limitant', 'moyenne des critères']) {
      if (source.includes(libelle)) {
        fautifs.push(`${nom} → libellé recopié : « ${libelle} »`);
      }
    }
  }
  assert.deepEqual(fautifs, [], `Libellés recopiés au lieu d'être lus dans l'API :\n  ${fautifs.join('\n  ')}`);
});

test('écran 2 — le texte du rappel n’est recopié sur aucun client', async () => {
  /*
   * `SCORE_NOTICE` est porté par la réponse (`scoreNotice`). S'il était aussi
   * écrit en dur dans un écran, les deux finiraient par diverger — et c'est le
   * texte qui empêche de lire un score comme une promesse de rendement.
   */
  const service = await lire('backend/src/modules/recommendation/recommendation.service.js');
  const notice = service.match(/export const SCORE_NOTICE =\s*([\s\S]*?);\n/);
  assert.ok(notice, 'SCORE_NOTICE introuvable dans le service');

  // Un fragment stable du rappel, suffisant pour détecter une recopie.
  const fragment = 'ni un rendement attendu';
  assert.ok(notice[1].includes(fragment), 'fragment de contrôle absent du rappel du service');

  const fautifs = [];
  for (const { nom, fichier } of [...ECRANS, ...COMPOSANTS]) {
    if (code.get(fichier).includes(fragment)) {
      fautifs.push(`${nom} (${fichier})`);
    }
  }
  assert.deepEqual(
    fautifs,
    [],
    `Le rappel est recopié au lieu d'être repris de \`scoreNotice\` :\n  ${fautifs.join('\n  ')}`,
  );
});

/* ─────────────── les champs exigés sont bien lus ─────────────── */

test('écran 2 — les deux clients affichent version, règle, critères, couverture et rappel', () => {
  const attendus = [
    ['engineVersion', 'version du moteur'],
    ['combinationRuleLabel', 'libellé de la règle de combinaison'],
    ['combinationRuleDescription', 'description de la règle'],
    ['scoreNotice', 'rappel « adéquation, pas rendement »'],
    ['evaluatedCount', 'nombre de critères évalués'],
    ['coverage', 'couverture'],
    ['indicative', 'statut indicatif'],
    ['indicativeReasons', 'raisons du caractère indicatif'],
  ];

  for (const { nom, fichier } of COMPOSANTS) {
    const source = code.get(fichier);
    for (const [champ, quoi] of attendus) {
      assert.ok(source.includes(champ), `${nom} : « ${quoi} » (\`${champ}\`) n'est pas affiché`);
    }
  }
});

test('écran 2 — les critères non évalués ne sont jamais concaténés comme des chaînes', () => {
  /*
   * `notEvaluated` porte des objets `{ key, label, reason, cause }`. Un
   * `.join(', ')` compile si le type ment, et affiche `[object Object]`.
   */
  const fautifs = [];
  for (const { nom, fichier } of [...ECRANS, ...COMPOSANTS]) {
    if (/notEvaluated\.join\(/.test(code.get(fichier))) {
      fautifs.push(nom);
    }
  }
  assert.deepEqual(fautifs, [], `notEvaluated concaténé comme des chaînes : ${fautifs.join(', ')}`);
});

test('écran 2 — le type client déclare `notEvaluated` comme des objets', async () => {
  for (const fichier of [
    'apps/web/src/services/types.ts',
    'apps/Mobile/src/services/api/types.ts',
  ]) {
    const source = await lire(fichier);
    assert.doesNotMatch(
      source,
      /notEvaluated:\s*string\[\]/,
      `${fichier} déclare notEvaluated comme string[] — c'est ce qui laissait passer le .join()`,
    );
    assert.match(
      source,
      /notEvaluated:\s*NotEvaluatedCriterion\[\]/,
      `${fichier} doit typer notEvaluated comme NotEvaluatedCriterion[]`,
    );
  }
});

/* ──────────────── côté serveur : le libellé est bien renvoyé ──────────────── */

/**
 * Les écrans lisent `combinationRuleLabel` sur **chaque culture classée**.
 * `scoreCrop` étend `describeEngine(engine)` sur l'entrée, mais le mapping de
 * réponse ne sélectionne que certains champs : c'est là que le libellé était
 * perdu, ce qui obligeait les clients à le recopier.
 */
test('écran 2 — chaque culture classée porte le libellé de sa règle de combinaison', async () => {
  const source = await lire('backend/src/modules/recommendation/recommendation.service.js');
  const mapping = source.match(/scores:\s*ranked\.map\(\(entry\)\s*=>\s*\(\{([\s\S]*?)\}\)\)/);
  assert.ok(mapping, 'le mapping `scores:` est introuvable — le test ne prouve rien');

  for (const champ of ['combinationRuleLabel', 'combinationRuleDescription', 'evaluatedCount', 'coverage']) {
    assert.ok(
      mapping[1].includes(champ),
      `le mapping de réponse abandonne \`${champ}\` : les clients devront le recopier`,
    );
  }
});

test('écran 2 — `describeEngine` fournit bien les libellés qu’il décrit', async () => {
  const source = await lire('backend/src/modules/recommendation/engineVersions.js');
  const corps = source.match(/export const describeEngine = \(engine\) => \(\{([\s\S]*?)\}\);/);
  assert.ok(corps, 'describeEngine introuvable');
  for (const champ of ['engineVersion', 'combinationRuleLabel', 'combinationRuleDescription', 'scoringModelLabel']) {
    assert.ok(corps[1].includes(champ), `describeEngine ne renvoie pas \`${champ}\``);
  }
});
