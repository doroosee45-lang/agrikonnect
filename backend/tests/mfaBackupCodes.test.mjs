/**
 * Codes de secours MFA : affichés une seule fois, jamais journalisés.
 *
 * ## Le défaut couvert
 *
 * `mfa.confirm` renvoie `{ mfaEnabled, backupCodes, warning }` — et c'est la
 * **seule** fois. Le serveur n'en conserve que les empreintes
 * (`backupCodesHashes`) ; aucune requête ne peut les restituer, et
 * `/auth/mfa/status` ne les renvoie pas.
 *
 * Les deux écrans jetaient cette donnée : `onSuccess` vidait seulement l'état.
 * Le type client (`mfaConfirm: { enabled: true }`) masquait même les champs
 * renvoyés. Résultat : un utilisateur qui perdait son téléphone n'avait **aucune
 * voie de récupération**.
 *
 * ## Portée
 *
 * Test **structurel** : il lit le source des écrans, il ne les exécute pas.
 * Les écrans web et mobile restent vérifiés par compilation uniquement — ce
 * test ne prouve pas ce qui s'affiche, il prouve que le code contient le rendu
 * et ne contient pas les motifs d'exposition. Le comportement réel du serveur
 * (renvoi unique, non ré-exposition) est couvert par
 * `tests/e2e/mfaLogin.e2e.test.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ECRANS = [
  { nom: 'web', fichier: 'apps/web/src/pages/auth/Mfa.tsx' },
  { nom: 'mobile', fichier: 'apps/Mobile/src/app/auth/mfa.tsx' },
];

const lire = async (relatif) =>
  fs.readFile(path.join(RACINE, relatif), 'utf8');

/**
 * Retire les commentaires.
 *
 * Indispensable ici : le source de ces écrans **mentionne** les codes de
 * secours dans des commentaires explicatifs. Sans ce retrait, chaque test
 * d'absence trouverait la documentation et échouerait à tort.
 */
const sansCommentaires = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '');

const sourceSansCommentaires = new Map();
for (const { fichier } of ECRANS) {
  sourceSansCommentaires.set(fichier, sansCommentaires(await lire(fichier)));
}

/* ───────────────────── contre-épreuve d'abord ───────────────────── */

/**
 * Si le rendu disparaissait, les tests d'absence ci-dessous passeraient en ne
 * vérifiant rien. On commence donc par prouver que les codes **sont** rendus,
 * et que l'avertissement vient de l'API plutôt que d'un texte recopié.
 */
test('codes de secours — les deux écrans rendent bien les codes renvoyés par `confirm`', async () => {
  for (const { nom, fichier } of ECRANS) {
    const source = sourceSansCommentaires.get(fichier);

    assert.match(
      source,
      /backupCodes/,
      `${nom} : l'écran doit lire \`backupCodes\` dans la réponse de \`confirm\``,
    );
    assert.match(
      source,
      /setSecours\(\{\s*codes:/,
      `${nom} : l'écran doit conserver les codes dans un état dédié`,
    );

    // Le rendu : `{…codeSecours}` en position d'enfant JSX.
    assert.match(
      source,
      />\s*\{?\s*codeSecours\s*\}?\s*</,
      `${nom} : chaque code doit être rendu (position d'enfant JSX)`,
    );

    /*
     * L'avertissement vient de l'API (`warning`). Un texte recopié en dur
     * divergerait silencieusement si le backend changeait la formulation.
     */
    assert.match(
      source,
      /\{?\s*secours\.warning\s*\}?/,
      `${nom} : l'avertissement doit être repris de l'API, pas recopié`,
    );
  }
});

test('codes de secours — la seule sortie est la fermeture, aucun bouton de ré-affichage', async () => {
  for (const { nom, fichier } of ECRANS) {
    const source = sourceSansCommentaires.get(fichier);

    const occurrences = source.match(/setSecours\(([^)]*)\)/g) ?? [];
    // Une écriture `setSecours({…})` (le stockage) + une `setSecours(null)` (la fermeture).
    assert.equal(
      occurrences.filter((appel) => appel.includes('null')).length,
      1,
      `${nom} : exactement une fermeture (setSecours(null)) — un second point de sortie `
      + 'ouvrirait une voie de ré-affichage',
    );
    assert.ok(
      occurrences.length >= 2,
      `${nom} : attendu un stockage et une fermeture, trouvé ${occurrences.length} écriture(s)`,
    );
  }
});

/* ───────────────────────── absence d'exposition ───────────────────────── */

test('structurel — aucun `console.*` ne porte les codes de secours', async () => {
  const fautifs = [];
  for (const { nom, fichier } of ECRANS) {
    const source = sourceSansCommentaires.get(fichier);
    for (const match of source.matchAll(/console\.\w+\s*\(([^;]*)\)/g)) {
      const args = match[1];
      if (/backupCodes|secours|codeSecours/.test(args)) {
        fautifs.push(`${nom} → console.*(${args.trim().slice(0, 80)})`);
      }
    }
  }
  assert.deepEqual(fautifs, [], `Codes de secours journalisés :\n  ${fautifs.join('\n  ')}`);
});

/**
 * Les codes ne doivent pas non plus quitter la mémoire de l'onglet / de
 * l'application. Une persistance les ferait survivre à la fermeture de
 * l'écran — exactement ce que « affichés une seule fois » interdit.
 */
test('structurel — les codes de secours ne sont pas persistés', async () => {
  const MOTIFS = [
    /localStorage\.(setItem|removeItem)\s*\([^)]*(secours|backup)/i,
    /sessionStorage\.setItem\s*\([^)]*(secours|backup)/i,
    /AsyncStorage\.(setItem|multiSet)\s*\([^)]*(secours|backup)/i,
    /SecureStore\.setItemAsync\s*\([^)]*(secours|backup)/i,
    /MMKV[^;]{0,60}(secours|backup)/i,
  ];
  const fautifs = [];
  for (const { nom, fichier } of ECRANS) {
    const source = sourceSansCommentaires.get(fichier);
    for (const motif of MOTIFS) {
      if (motif.test(source)) fautifs.push(`${nom} → ${motif}`);
    }
  }
  assert.deepEqual(fautifs, [], `Persistance des codes de secours :\n  ${fautifs.join('\n  ')}`);
});

/* ──────────────────────── côté serveur ──────────────────────── */

/**
 * Le serveur ne doit ré-exposer les codes nulle part. `confirm` est le seul
 * endroit autorisé à les renvoyer ; `status` et `setup` doivent rester muets.
 *
 * Couplé au test e2e qui vérifie que `/auth/mfa/status` ne les renvoie pas
 * après activation.
 */
test('structurel — `backupCodes` n’est renvoyé que par `confirm` côté serveur', async () => {
  const source = await lire('backend/src/modules/auth/mfa.service.js');
  const code = sansCommentaires(source);

  // Les seules positions où la clé apparaît dans un objet renvoyé.
  const renvois = [...code.matchAll(/^\s*backupCodes\s*[,:]/gm)].map((m) => m.index);
  assert.equal(
    renvois.length,
    1,
    'attendu exactement un renvoi de `backupCodes` (celui de `confirm`), '
    + `trouvé ${renvois.length}`,
  );

  // Et il est bien dans `confirm`, pas dans une autre fonction.
  const position = renvois[0];
  const debutConfirm = code.lastIndexOf('export const confirm', position);
  const debutSuivant = code.indexOf('export const ', debutConfirm + 1);
  assert.ok(debutConfirm !== -1, '`confirm` introuvable avant le renvoi');
  assert.ok(
    debutSuivant === -1 || position < debutSuivant,
    'le renvoi de `backupCodes` n’est pas dans `confirm`',
  );

  // Les empreintes, elles, sont bien stockées — sinon les codes seraient inutiles.
  assert.match(code, /backupCodesHashes:\s*backupCodes\.map\(hashCode\)/);
});

/**
 * L'audit ne doit journaliser que le **nombre** de codes, jamais les codes.
 * Une trace d'audit est lisible par les administrateurs et exportée.
 */
test('structurel — l’audit de `confirm` ne journalise pas les codes eux-mêmes', async () => {
  const code = sansCommentaires(await lire('backend/src/modules/auth/mfa.service.js'));
  const debut = code.indexOf("action: 'mfa.confirm'");
  assert.ok(debut !== -1, 'trace d’audit `mfa.confirm` introuvable');
  const trace = code.slice(debut, debut + 400);

  assert.match(
    trace,
    /backupCodes:\s*backupCodes\.length/,
    'la trace doit porter le nombre de codes, pas leur valeur',
  );
  assert.doesNotMatch(
    trace,
    /backupCodes:\s*backupCodes\s*[,}]/,
    'la trace ne doit pas contenir la liste des codes',
  );
});
