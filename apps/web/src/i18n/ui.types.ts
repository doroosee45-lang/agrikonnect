import type { uiFr } from './ui.fr';

/** Même jeu de clés que le français, valeurs libres. */
export type UiDictionary = { [K in keyof typeof uiFr]: string };
