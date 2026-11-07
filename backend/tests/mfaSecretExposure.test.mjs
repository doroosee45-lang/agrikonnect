/**
 * Aucun secret MFA affiché ni journalisé.
 *
 * ## Le défaut couvert
 *
 * L'écran mobile `auth/mfa.tsx` rendait `{setup.secret}` en clair, ainsi que
 * l'`otpauthUrl` complet — **qui contient le secret**. Un secret TOTP affiché à
 * l'écran est lisible par-dessus l'épaule, capturable, et se retrouve dans les
 * captures d'écran, les journaux d'accessibilité et les partages d'écran.
 *
 * Il a été remplacé par un QR code généré côté serveur. Ce test empêche la
 * régression : si quelqu'un réaffiche le secret, ou le fait passer dans un
 * `console.*`, la suite échoue.
 *
 * ## Portée
 *
 * Test **structurel** : il lit le source des écrans, il ne les exécute pas. Les
 * écrans web et mobile restent vérifiés par compilation uniquement — ce test ne
 * prouve pas ce qui s'affiche à l'écran, il prouve que le code ne contient pas
 * les motifs d'exposition connus.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLIENTS = [
  { nom: 'web', dossiers: ['apps/web/src'] },
  { nom: 'mobile', dossiers: ['apps/Mobile/src'] },
];

/** `.tsx`/`.ts` d'un dossier, récursivement, hors `node_modules`. */
const fichiers = async (relatif) => {
  const absolu = path.join(RACINE, relatif);
  const entrees = await fs.readdir(absolu, { withFileTypes: true }).catch(() => []);
  const resultat = [];
  for (const entree of entrees) {
    if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue;
    const complet = path.join(absolu, entree.name);
    if (entree.isDirectory()) resultat.push(...(await fichiers(path.join(relatif, entree.name))));
    else if (/\.(tsx?|jsx?)$/.test(entree.name)) resultat.push(complet);
  }
  return resultat;
};

/**
 * Retire les commentaires et les attributs `style={…}`.
 *
 * Sans ce second retrait, `style={styles.secret}` — un **nom de style** — est
 * pris pour un rendu de secret. Le faux positif a été observé sur
 * `farmer/plots/[id]/sensors.tsx`.
 */
const sansCommentaires = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/style=\{[^}]*\}/g, '');

/* ═══════════════ le secret n'est pas rendu ═══════════════ */

test('écrans — le secret TOTP n’est rendu dans aucun écran', async () => {
  /*
   * Motifs d'exposition : interpolation JSX du secret, ou rendu dans un
   * composant de texte. `setup.secret` **lu** (pour le copier dans le
   * presse-papiers) n'est pas un affichage ; ce qui compte est qu'il ne soit
   * pas rendu.
   */
  /*
   * Motifs ciblés sur le secret **MFA**. Un `.secret` générique donnerait des
   * faux positifs : `developers/index.tsx` affiche une clé d'API **une seule
   * fois à sa création**, avec bouton « Masquer » — c'est le motif normal pour
   * une valeur qui ne peut plus être retrouvée ensuite, et ce n'est pas un
   * défaut. Le secret TOTP, lui, reste disponible indéfiniment via le QR : il
   * n'a aucune raison d'être affiché.
   */
  /*
   * Motifs en **position de rendu**, pas n'importe quelle accolade.
   *
   * Un motif sur `{…\.secret…}` seul donne des faux positifs vérifiés :
   * `navigator.clipboard.writeText(setup.secret)` — une **lecture** pour le
   * presse-papiers, pas un affichage — et `otpauthUrl: string;` dans une
   * déclaration de type. Ni l'un ni l'autre ne met le secret à l'écran.
   *
   * On cible donc les deux seules façons de rendre une valeur en JSX : en
   * enfant de balise (`>{…}<`) ou en attribut de texte/image.
   */
  const motifs = [
    // Enfant JSX : <Text>{setup.secret}</Text>
    />[\s\n]*\{[^{}]*(?:setup\.secret|otpauthUrl)[^{}]*\}[\s\n]*</,
    // Attribut qui affiche : label= value= text= uri= src=
    /\b(?:label|value|text|children|uri|src)=\{[^{}]*(?:\.secret\b|otpauthUrl)[^{}]*\}/,
  ];

  const trouvés = [];
  for (const client of CLIENTS) {
    for (const dossier of client.dossiers) {
      for (const fichier of await fichiers(dossier)) {
        const source = sansCommentaires(await fs.readFile(fichier, 'utf8'));
        for (const motif of motifs) {
          if (motif.test(source)) trouvés.push(`${path.relative(RACINE, fichier)} ← ${motif}`);
        }
      }
    }
  }

  assert.deepEqual(
    trouvés,
    [],
    'Secret MFA rendu dans un écran — passer par le QR « qrDataUri » :\n  ' + trouvés.join('\n  '),
  );
});

test('écrans — le QR code est bien utilisé à la place du secret', async () => {
  /*
   * Contre-épreuve : sans elle, le test précédent passerait aussi si l'écran
   * n'affichait plus **rien**. On vérifie que le QR est présent là où
   * l'activation MFA est proposée.
   */
  const ecransMfa = [
    'apps/web/src/pages/auth/Mfa.tsx',
    'apps/Mobile/src/app/auth/mfa.tsx',
  ];

  for (const relatif of ecransMfa) {
    const source = await fs.readFile(path.join(RACINE, relatif), 'utf8').catch(() => null);
    assert.ok(source, `${relatif} doit exister`);
    assert.match(source, /qrDataUri/, `${relatif} doit utiliser le QR généré côté serveur`);
    assert.doesNotMatch(
      sansCommentaires(source),
      />[\s\n]*\{[^{}]*(?:setup\.secret|otpauthUrl)[^{}]*\}[\s\n]*</,
      `${relatif} ne doit pas rendre le secret`,
    );
  }
});

/* ═══════════════ le secret n'est pas journalisé ═══════════════ */

test('clients — aucun `console.*` ne porte le secret, l’otpauthUrl ni le code MFA', async () => {
  const motifs = [
    /console\.\w+\([^)]*\.secret\b/,
    /console\.\w+\([^)]*otpauthUrl/,
    /console\.\w+\([^)]*\bsetup\b[^)]*\)/,
  ];

  const trouvés = [];
  for (const client of CLIENTS) {
    for (const dossier of client.dossiers) {
      for (const fichier of await fichiers(dossier)) {
        const source = sansCommentaires(await fs.readFile(fichier, 'utf8'));
        for (const motif of motifs) {
          if (motif.test(source)) trouvés.push(`${path.relative(RACINE, fichier)} ← ${motif}`);
        }
      }
    }
  }

  assert.deepEqual(trouvés, [], `Secret MFA journalisé côté client :\n  ${trouvés.join('\n  ')}`);
});

test('backend — le service MFA ne journalise pas le secret', async () => {
  const source = await fs.readFile(
    path.join(RACINE, 'backend/src/modules/auth/mfa.service.js'),
    'utf8',
  );
  const sansDoc = sansCommentaires(source);

  // Aucun appel de journalisation ne doit porter le secret ni l'otpauthUrl.
  const appels = [...sansDoc.matchAll(/logger\.\w+\(([^;]*)\)/g)].map((m) => m[1]);
  for (const appel of appels) {
    assert.doesNotMatch(appel, /\bsecret\b/, `logger porte le secret : ${appel.slice(0, 80)}`);
    assert.doesNotMatch(appel, /otpauthUrl/, `logger porte l'otpauthUrl : ${appel.slice(0, 80)}`);
  }
});

/**
 * L'audit enregistre l'événement, pas la valeur : un journal d'audit est lisible
 * par les administrateurs, un secret ne doit pas y figurer.
 */
test('backend — l’audit MFA n’enregistre pas la valeur du secret', async () => {
  const source = await fs.readFile(
    path.join(RACINE, 'backend/src/modules/auth/mfa.service.js'),
    'utf8',
  );
  const sansDoc = sansCommentaires(source);
  const blocs = [...sansDoc.matchAll(/audit\(\{[\s\S]*?\n {2}\}\)/g)].map((m) => m[0]);

  assert.ok(blocs.length > 0, 'le service doit auditer ses actions, sinon ce test ne prouve rien');
  for (const bloc of blocs) {
    assert.doesNotMatch(
      bloc,
      /newValue:[\s\S]*?\bsecret\b/,
      `l'audit ne doit pas porter le secret : ${bloc.slice(0, 120)}`,
    );
  }
});

/* ═══════════════ les routes sont raccordées ═══════════════ */

test('contrat — verify-email et mfa/verify sont appelés par les deux clients', async () => {
  /*
   * C'est le point de départ de cet écran : `POST /auth/verify-email` et
   * `POST /auth/mfa/verify` n'étaient appelés **nulle part**, donc un code reçu
   * n'avait aucun endroit où être saisi.
   */
  const cibles = [
    ['apps/web/src/services/endpoints.ts', ['/auth/verify-email', '/auth/mfa/verify']],
    ['apps/Mobile/src/services/api/endpoints.ts', ['/auth/verify-email', '/auth/mfa/verify']],
  ];

  for (const [relatif, routes] of cibles) {
    const source = await fs.readFile(path.join(RACINE, relatif), 'utf8');
    for (const route of routes) {
      assert.ok(
        source.includes(`'${route}'`),
        `${relatif} doit appeler ${route}`,
      );
    }
  }
});

test('contrat — les écrans appellent bien ces wrappers', async () => {
  const attentes = [
    ['apps/web/src/pages/auth/VerifyEmail.tsx', ['verifyEmail', 'resendVerification']],
    ['apps/Mobile/src/app/auth/verify-email.tsx', ['verifyEmail', 'resendVerification']],
    ['apps/web/src/pages/auth/Mfa.tsx', ['mfaVerify', 'mfaConfirm', 'mfaDisable']],
    ['apps/Mobile/src/app/auth/mfa.tsx', ['mfaVerify', 'mfaConfirm', 'mfaDisable']],
  ];

  for (const [relatif, wrappers] of attentes) {
    const source = await fs.readFile(path.join(RACINE, relatif), 'utf8');
    for (const wrapper of wrappers) {
      assert.ok(
        new RegExp(`authApi\\.${wrapper}\\b`).test(source),
        `${relatif} doit appeler authApi.${wrapper}`,
      );
    }
  }
});
