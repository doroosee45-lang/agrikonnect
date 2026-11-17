import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou : aucune valeur partagée Reanimated ne doit être ÉCRITE pendant le
 * rendu d'un composant. Une écriture au niveau du corps du composant relance
 * l'animation (souvent infinie) à chaque rendu et produit deux avertissements
 * « Reading/Writing to `value` during component render » ; 8 composants le
 * faisaient (Accordion, HeroBackground, MapPreview, Hero ×4, PressOverlay),
 * d'où des centaines d'avertissements et un fil JS ralenti en développement.
 *
 * Dans ce projet (indentation de 2 espaces), une telle écriture se repère à
 * `x.value = …` indenté d'exactement 2 espaces, c'est-à-dire hors de tout
 * useEffect, gestionnaire ou worklet.
 */
// fileURLToPath décode les espaces du chemin (« Nouveau dossier »).
const RACINE = fileURLToPath(new URL('../src/', import.meta.url));

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name)) : e.name.endsWith('.tsx') ? [join(dossier, e.name)] : [],
  );

describe('Reanimated — pas d’écriture de valeur partagée pendant le rendu', () => {
  it('aucun `x.value = …` au niveau du corps d’un composant', () => {
    const fautes: string[] = [];
    for (const fichier of fichiers(RACINE)) {
      readFileSync(fichier, 'utf8')
        .split(/\r?\n/)
        .forEach((ligne, i) => {
          if (/^ {2}[A-Za-z_]\w*\.value\s*=[^=]/.test(ligne)) {
            fautes.push(`${relative(RACINE, fichier).split(sep).join('/')}:${i + 1}`);
          }
        });
    }
    assert.deepEqual(fautes, [], `Écriture pendant le rendu — à placer dans un useEffect : ${fautes.join(', ')}`);
  });
});

describe('SVG — props compatibles web', () => {
  it('pas de `origin` / `originX` / `originY` (deviennent l’attribut DOM invalide `transform-origin` sur le web)', () => {
    const fautes: string[] = [];
    for (const fichier of fichiers(RACINE)) {
      readFileSync(fichier, 'utf8')
        .split(/\r?\n/)
        .forEach((ligne, i) => {
          if (/\b(origin|originX|originY)=/.test(ligne)) fautes.push(`${relative(RACINE, fichier).split(sep).join('/')}:${i + 1}`);
        });
    }
    assert.deepEqual(fautes, [], `Utiliser transform="rotate(angle cx cy)" : ${fautes.join(', ')}`);
  });
});
