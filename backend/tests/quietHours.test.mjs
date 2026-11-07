import test from 'node:test';
import assert from 'node:assert/strict';

import { dansFenetreSilence, heureLocale, enMinutes } from '../src/shared/quietHours.js';

/**
 * Fenêtre de silence des SMS d'alerte.
 *
 * Les heures attendues sont exprimées en UTC et vérifiées dans le fuseau du
 * destinataire. C'est le point central : un backend qui appliquerait son heure
 * locale enverrait en pleine nuit à Kinshasa.
 *
 * Kinshasa est à UTC+1, sans heure d'été. Lubumbashi est à UTC+2 — les deux
 * fuseaux sont testés, parce que traiter toute la RDC au même fuseau est une
 * simplification qu'il faut pouvoir mesurer.
 */

const fenetre = (debut, fin, fuseau = 'Africa/Kinshasa') => ({ debut, fin, fuseau });

test('heureLocale — la conversion se fait vers le fuseau du destinataire', () => {
  // 20:30 UTC = 21:30 à Kinshasa (UTC+1).
  assert.equal(heureLocale(new Date('2026-10-28T20:30:00Z'), 'Africa/Kinshasa').texte, '21:30');
  // 20:30 UTC = 22:30 à Lubumbashi (UTC+2).
  assert.equal(heureLocale(new Date('2026-10-28T20:30:00Z'), 'Africa/Lubumbashi').texte, '22:30');
  // Le même instant à Paris (UTC+2 en été, UTC+1 en hiver) : fin octobre, +1.
  assert.equal(heureLocale(new Date('2026-10-28T20:30:00Z'), 'Europe/Paris').texte, '21:30');
});

test('heureLocale — un fuseau inconnu est refusé, pas remplacé', () => {
  /*
   * Un repli silencieux sur l'heure du serveur appliquerait la fenêtre au
   * mauvais fuseau, et l'alerte partirait de nuit sans qu'aucun journal ne le
   * dise. Mieux vaut échouer bruyamment.
   */
  assert.throws(() => heureLocale(new Date(), 'Mars/Olympus'), /Fuseau horaire inconnu/);
});

test('heureLocale — une date invalide est refusée', () => {
  assert.throws(() => heureLocale(new Date('pas-une-date'), 'Africa/Kinshasa'), /date invalide/);
});

test('fenêtre traversant minuit — 21:00 à 06:00', () => {
  const f = fenetre('21:00', '06:00');
  const cas = [
    ['2026-10-28T19:59:00Z', false, '20:59 locale — juste avant'],
    ['2026-10-28T20:00:00Z', true, '21:00 locale — début inclus'],
    ['2026-10-28T23:30:00Z', true, '00:30 locale — après minuit'],
    ['2026-10-28T04:59:00Z', true, '05:59 locale — juste avant la fin'],
    ['2026-10-28T05:00:00Z', false, '06:00 locale — fin exclue'],
    ['2026-10-28T12:00:00Z', false, '13:00 locale — en journée'],
  ];
  for (const [iso, attendu, pourquoi] of cas) {
    const resultat = dansFenetreSilence(new Date(iso), f);
    assert.equal(resultat.silencieux, attendu, `${iso} (${pourquoi})`);
  }
});

test('fenêtre dans la même journée — 09:00 à 17:00', () => {
  const f = fenetre('09:00', '17:00');
  // 08:00 UTC = 09:00 locale : le début de la fenêtre est **inclus**.
  assert.equal(dansFenetreSilence(new Date('2026-10-28T07:59:00Z'), f).silencieux, false); // 08:59
  assert.equal(dansFenetreSilence(new Date('2026-10-28T08:00:00Z'), f).silencieux, true); // 09:00
  assert.equal(dansFenetreSilence(new Date('2026-10-28T11:00:00Z'), f).silencieux, true); // 12:00
  assert.equal(dansFenetreSilence(new Date('2026-10-28T16:00:00Z'), f).silencieux, false); // 17:00
});

test('fenêtre — début égal à fin ne coupe pas tout le canal', () => {
  /*
   * `00:00` → `00:00` pourrait se lire « toute la journée ». Ce serait couper
   * les alertes sans que personne ne l'ait décidé explicitement : traité comme
   * « aucune fenêtre ».
   */
  const f = fenetre('00:00', '00:00');
  for (const iso of ['2026-10-28T00:00:00Z', '2026-10-28T12:00:00Z', '2026-10-28T23:59:00Z']) {
    assert.equal(dansFenetreSilence(new Date(iso), f).silencieux, false, iso);
  }
});

test('fenêtre — la réponse dit quoi a été appliqué', () => {
  /*
   * Un envoi retenu doit pouvoir être expliqué : l'heure locale retenue, le
   * fuseau, et la fenêtre en vigueur. Sans cela, « pourquoi mon alerte n'est
   * pas partie ? » n'a pas de réponse.
   */
  const resultat = dansFenetreSilence(new Date('2026-10-28T22:15:00Z'), fenetre('21:00', '06:00'));
  assert.equal(resultat.heureLocale, '23:15');
  assert.equal(resultat.fuseau, 'Africa/Kinshasa');
  assert.equal(resultat.debut, '21:00');
  assert.equal(resultat.fin, '06:00');
  assert.equal(resultat.silencieux, true);
});

test('fenêtre — les deux fuseaux de la RDC ne donnent pas la même réponse', () => {
  /*
   * 20:30 UTC : 21:30 à Kinshasa (dans la fenêtre) mais 22:30 à Lubumbashi
   * (dans la fenêtre aussi). En revanche 19:30 UTC donne 20:30 à Kinshasa
   * (hors fenêtre) et 21:30 à Lubumbashi (dans la fenêtre) : le même instant
   * n'appelle pas la même décision selon la ville.
   *
   * Le test fixe cet écart pour qu'il reste visible — le déploiement actuel
   * n'applique qu'un seul fuseau à tout le pays.
   */
  const f = { debut: '21:00', fin: '06:00' };
  const instant = new Date('2026-10-28T19:30:00Z');
  assert.equal(dansFenetreSilence(instant, { ...f, fuseau: 'Africa/Kinshasa' }).silencieux, false);
  assert.equal(dansFenetreSilence(instant, { ...f, fuseau: 'Africa/Lubumbashi' }).silencieux, true);
});

test('enMinutes — HH:MM en minutes depuis minuit', () => {
  assert.equal(enMinutes('00:00'), 0);
  assert.equal(enMinutes('06:30'), 390);
  assert.equal(enMinutes('21:00'), 1260);
  assert.equal(enMinutes('23:59'), 1439);
});
