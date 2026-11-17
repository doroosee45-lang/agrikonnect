import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { decisionReveal, estVisible } from '../src/components/ui/revealDecision.ts';

const ECRAN = 800;
const SEUIL = 0.1;

describe('Reveal — visibilité', () => {
  it('élément dans l’écran → visible', () => {
    assert.equal(estVisible({ pageY: 200, height: 90 }, ECRAN, SEUIL), true);
  });
  it('élément sous la ligne de flottaison → pas encore visible', () => {
    assert.equal(estVisible({ pageY: 750, height: 90 }, ECRAN, SEUIL), false);
  });
  it('élément entièrement au-dessus de l’écran → non visible', () => {
    assert.equal(estVisible({ pageY: -200, height: 90 }, ECRAN, SEUIL), false);
  });
});

describe('Reveal — décision d’animation', () => {
  const base = { lance: false, repeter: false, etaitVisible: false };

  it('premier passage visible → apparition', () => {
    assert.equal(decisionReveal(true, base), 'show');
  });

  it('non-régression : une animation lancée n’est PAS relancée à chaque image de défilement', () => {
    // Avant : la condition `progress !== 1` relançait withDelay tant que l’animation n’était pas finie.
    for (let image = 0; image < 30; image += 1) {
      assert.equal(decisionReveal(true, { ...base, lance: true, etaitVisible: true }), 'none');
    }
  });

  it('sortie de l’écran sans « repeat » → reste affiché', () => {
    assert.equal(decisionReveal(false, { lance: true, repeter: false, etaitVisible: true }), 'none');
  });

  it('sortie de l’écran avec « repeat » → masqué, puis réaffiché au retour', () => {
    assert.equal(decisionReveal(false, { lance: true, repeter: true, etaitVisible: true }), 'hide');
    assert.equal(decisionReveal(true, { lance: false, repeter: true, etaitVisible: false }), 'show');
  });
});
