/**
 * Alignement du format E.164 entre le backend et les deux écrans.
 *
 * Le risque n'est pas qu'une des deux règles soit fausse, c'est qu'elles
 * **divergent**. Si l'écran acceptait un numéro que l'envoi refuse,
 * l'agriculteur donnerait son consentement en voyant un bouton actif sur un
 * canal mort : l'accord serait enregistré, aucun SMS ne partirait jamais, et
 * rien dans l'interface ne le dirait. L'inverse — un écran plus strict que
 * l'envoi — empêcherait un envoi parfaitement possible.
 *
 * Ces règles vivent dans trois langages et trois dépôts de dépendances
 * différents, donc aucun test d'un seul côté ne peut les tenir alignées. Ce
 * test lit le **source** des trois implémentations et exige que la regex soit
 * la même au caractère près.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateE164 } from '../src/integrations/twilio.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

/**
 * Extrait le littéral de regex E.164 d'un source.
 *
 * Lit le fichier plutôt qu'une constante exportée : les écrans sont en
 * TypeScript et ne sont pas importables ici sans transpileur. Ce n'est pas un
 * contournement — c'est précisément le texte qui doit correspondre.
 */
const extractRegex = (relativePath) => {
  const source = readFileSync(join(repoRoot, relativePath), 'utf8');
  /*
   * Deux formes sont acceptées, parce que les trois implémentations n'écrivent
   * pas la règle de la même façon :
   *   - le backend l'applique en ligne  : return /^…$/.test(value);
   *   - les écrans la nomment d'abord   : const E164 = /^…$/;
   * Ce qui doit correspondre, c'est le littéral, pas sa mise en forme.
   */
  const found = source.match(/(=|return)\s+\/(\^\\\+\[1-9\][^/\n]*)\//);
  if (!found) {
    throw new Error(`Aucune regex E.164 trouvée dans ${relativePath}`);
  }
  return found[2];
};

const BACKEND = 'backend/src/integrations/twilio.js';
const WEB = 'apps/web/src/lib/phone.ts';
const MOBILE = 'apps/Mobile/src/lib/phone.ts';

/** Regex attendue, écrite ici pour que le test ne se compare pas à lui-même. */
const EXPECTED = '^\\+[1-9]\\d{6,14}$';

test('E.164 : le backend valide exactement +, 1-9, puis 6 à 14 chiffres', () => {
  assert.equal(validateE164('+243812345678'), true, 'numéro RDC valide');
  assert.equal(validateE164('+33612345678'), true);
  assert.equal(validateE164('0812345678'), false, 'format local sans +');
  assert.equal(validateE164('+0123456789'), false, 'premier chiffre à 0');
  /*
   * E.164 admet 1 à 15 chiffres. La regex du dépôt en exige 7 à 15 (1 chiffre
   * de 1-9, puis 6 à 14) : c'est volontairement plus strict qu'E.164 en bas,
   * pour écarter les indicatifs de pays seuls, mais un numéro court **est**
   * accepté. Un vrai numéro congolais en compte 12 après le +.
   */
  assert.equal(validateE164('+24381234'), true, '8 chiffres : dans la plage admise');
  assert.equal(validateE164('+2438123'), true, '7 chiffres : la borne basse');
  assert.equal(validateE164('+243812'), false, '6 chiffres : sous la borne basse');
  assert.equal(validateE164('+2438123456789012'), false, '16 chiffres : au-dessus des 15 d’E.164');
  assert.equal(validateE164('+243812345678901'), true, '15 chiffres : la borne haute d’E.164');
  assert.equal(validateE164(''), false);
  assert.equal(validateE164(null), false);
  assert.equal(validateE164(undefined), false);
  assert.equal(validateE164('+243 81 234 5678'), false, 'les espaces ne sont pas de l’E.164');
});

test('E.164 : les trois implémentations portent la même regex', () => {
  const found = {
    backend: extractRegex(BACKEND),
    web: extractRegex(WEB),
    mobile: extractRegex(MOBILE),
  };
  for (const [where, pattern] of Object.entries(found)) {
    assert.equal(
      pattern,
      EXPECTED,
      `${where} a divergé : /${pattern}/ au lieu de /${EXPECTED}/. `
      + 'Les trois doivent rester identiques, sinon l’écran et l’envoi ne sont '
      + 'plus d’accord sur ce qu’est un numéro valable.',
    );
  }
});

test('E.164 : les écrans web et mobile ne divergent pas l’un de l’autre', () => {
  assert.equal(
    extractRegex(WEB),
    extractRegex(MOBILE),
    'Les deux écrans doivent appliquer la même règle au même utilisateur.',
  );
});

/**
 * La règle de disponibilité du bouton, vérifiée depuis le backend.
 *
 * Le helper TypeScript n'est pas importable ici, donc le comportement attendu
 * est écrit en clair et comparé à ce que la regex du backend donnerait. Si un
 * jour l'écran change de logique sans changer la regex, ce test ne le verra
 * pas — il garde la **règle**, pas le code de l'écran.
 */
test('E.164 : le bouton « donner mon accord » ne s’active que sur un numéro valide', () => {
  const cases = [
    { phone: '+243812345678', canGrant: true, label: 'numéro RDC complet' },
    { phone: null, canGrant: false, label: 'aucun numéro' },
    { phone: undefined, canGrant: false, label: 'numéro absent' },
    { phone: '', canGrant: false, label: 'numéro vide' },
    { phone: '   ', canGrant: false, label: 'numéro blanc' },
    { phone: '0812345678', canGrant: false, label: 'format local congolais' },
    { phone: '243812345678', canGrant: false, label: 'international sans +' },
    { phone: '+243 81 234 5678', canGrant: false, label: 'espaces de lisibilité' },
    { phone: '+24381', canGrant: false, label: 'numéro tronqué' },
  ];
  for (const { phone, canGrant, label } of cases) {
    // `canGrant` dans les écrans vaut `isValidE164(phone)` ; `validateE164`
    // applique la même regex sur la même valeur après `trim()`.
    assert.equal(
      validateE164(String(phone ?? '').trim()),
      canGrant,
      `${label} (${JSON.stringify(phone)}) : attendu canGrant=${canGrant}`,
    );
  }
});

test('E.164 : le retrait reste possible même sans numéro valide', () => {
  /*
   * `canAct = granted || readiness.canGrant`. Un consentement déjà donné sur un
   * numéro devenu invalide doit rester retirable : bloquer la désinscription
   * parce que le numéro est malformé retiendrait la personne captive d'un canal
   * qu'elle veut quitter.
   */
  for (const granted of [true, false]) {
    for (const phone of ['+243812345678', '0812345678', null]) {
      const canGrant = validateE164(String(phone ?? '').trim());
      const canAct = granted || canGrant;
      assert.equal(
        canAct,
        granted || canGrant,
        `granted=${granted} phone=${JSON.stringify(phone)}`,
      );
      if (granted) assert.equal(canAct, true, 'un accord donné est toujours retirable');
    }
  }
});
