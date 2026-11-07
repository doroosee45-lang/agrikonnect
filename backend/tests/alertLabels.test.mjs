/**
 * Écran 3 — les libellés des alertes viennent de l'API, pas des écrans.
 *
 * ## Le défaut couvert
 *
 * `alerts.service.js` renvoyait les lignes Prisma brutes. Les écrans affichaient
 * donc `MEASUREMENT`, `WARNING`, `NEW` tels quels, et le panneau de capteurs
 * recopiait trois phrases françaises :
 *
 * ```tsx
 * {alert.sourceType === 'SENSOR_SILENCE'
 *   ? 'Capteur muet : aucune donnée transmise…'
 *   : alert.sourceType === 'FORECAST' ? 'Franchissement anticipé…' : 'Franchissement constaté…'}
 * ```
 *
 * Ce code est juste pour les trois sources connues et **muet** pour toute autre
 * valeur. Une source ajoutée au moteur n'aurait produit aucune erreur : l'écran
 * n'aurait simplement rien dit de l'origine de l'alerte — précisément
 * l'information qui décide de l'action (une mesure hors seuil, une prévision et
 * un capteur muet n'appellent pas la même réponse).
 *
 * Même famille : `alertApi.list` annonçait un filtre `severity` que l'API ne
 * connaît pas. Un filtre qui ne fait rien est pire qu'un filtre absent.
 *
 * ## Portée
 *
 * Deux volets :
 * - **comportemental** — les fonctions pures de `alertLabels.js` sont exécutées
 *   (libellés, formatage de plage, enrichissement additif) ;
 * - **structurel** — le source des écrans est lu. Les écrans restent vérifiés
 *   par compilation uniquement : ce test ne prouve pas ce qui s'affiche, il
 *   prouve que le code lit les champs de l'API et ne recopie pas leur texte.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEVERITY_LABELS,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  describeAlert,
  describeAlertFilters,
  formatRange,
  parameterLabel,
  parameterUnit,
} from '../src/modules/alerts/alertLabels.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lire = (relatif) => fs.readFile(path.join(RACINE, relatif), 'utf8');

/** Les quatre surfaces qui affichent des alertes, sur les deux clients. */
const ECRANS = [
  { nom: 'web — boîte d’alertes', fichier: 'apps/web/src/pages/farmer/Alerts.tsx' },
  { nom: 'mobile — boîte d’alertes', fichier: 'apps/Mobile/src/app/farmer/alerts.tsx' },
  { nom: 'web — capteurs de parcelle', fichier: 'apps/web/src/pages/farmer/Plots/Sensors.tsx' },
  {
    nom: 'mobile — capteurs de parcelle',
    fichier: 'apps/Mobile/src/app/farmer/plots/[id]/sensors.tsx',
  },
];

/** Retire les commentaires : les défauts y sont décrits, pas commis. */
const sansCommentaires = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '');

const code = new Map();
for (const { fichier } of ECRANS) {
  code.set(fichier, sansCommentaires(await lire(fichier)));
}

/* ═══════════════════════ volet comportemental ═══════════════════════ */

test('Libellés : chaque valeur d’enum est nommée, et distinctement', () => {
  const tables = [SOURCE_TYPE_LABELS, SEVERITY_LABELS, STATUS_LABELS];
  for (const table of tables) {
    const valeurs = Object.values(table);
    assert.ok(valeurs.length >= 3, 'une table d’enum vide ou réduite');
    for (const [cle, libelle] of Object.entries(table)) {
      assert.ok(typeof libelle === 'string' && libelle.length > 0, `libellé vide pour ${cle}`);
      // Un libellé identique au code n'apporte rien et trahit un oubli.
      assert.notEqual(libelle, cle, `« ${cle} » n'est pas un libellé`);
    }
    assert.equal(new Set(valeurs).size, valeurs.length, 'deux codes partagent un libellé');
  }

  assert.equal(SOURCE_TYPE_LABELS.SENSOR_SILENCE, 'Capteur silencieux');
  assert.equal(SEVERITY_LABELS.CRITICAL, 'Critique');
  assert.equal(STATUS_LABELS.HANDLED, 'Traitée');
});

test('Libellés : une valeur d’enum inconnue retombe sur le code, pas sur « undefined »', () => {
  const alerte = describeAlert({
    id: 'a',
    sourceType: 'DRONE',
    severity: 'APOCALYPTIQUE',
    status: 'OUBLIEE',
    parameter: 'champMagnetique',
    referenceValue: 3,
    observedValue: null,
  });

  // Le repli sur le code est délibéré : afficher « undefined » masquerait la valeur.
  assert.equal(alerte.sourceTypeLabel, 'DRONE');
  assert.equal(alerte.severityLabel, 'APOCALYPTIQUE');
  assert.equal(alerte.statusLabel, 'OUBLIEE');
  assert.equal(alerte.parameterLabel, 'champMagnetique');
  assert.equal(alerte.referenceLabel, '3');
  assert.equal(alerte.observedLabel, null);
});

test('Grandeurs : les libellés viennent de RANGE_LABELS, pas d’une seconde table', async () => {
  const { RANGE_LABELS } = await import('../src/modules/recommendation/agronomicRanges.js');

  // Une seconde table divergerait de celle que l'agriculteur voit sur l'écran
  // de recommandations : la même grandeur aurait deux noms.
  for (const cle of Object.keys(RANGE_LABELS)) {
    assert.equal(parameterLabel(cle), RANGE_LABELS[cle], `divergence sur ${cle}`);
  }

  // Cas particulier : le paramètre synthétique des capteurs silencieux n'est
  // pas une grandeur agronomique et n'est donc pas dans RANGE_LABELS.
  assert.equal(parameterLabel('sensorSilence'), 'Délai depuis la dernière remontée');
  assert.equal(RANGE_LABELS.sensorSilence, undefined, 'sensorSilence ne doit pas polluer RANGE_LABELS');
  assert.equal(parameterUnit('sensorSilence'), 'h');
});

test('Plage : formatée quand elle existe, null quand elle est inconnue', () => {
  assert.equal(formatRange({ min: 5.5, max: 6.8, unit: 'pH' }), '5.5 – 6.8 pH');
  // Borne supérieure absente sur un critère « au moins » : réelle, pas un manque.
  assert.equal(formatRange({ min: 12, unit: '%' }), '≥ 12 %');
  assert.equal(formatRange({ min: 6, max: 6, unit: 'pH' }), '6 pH');
  assert.equal(formatRange({ min: null, max: 8 }), null, 'une plage sans borne minimale n’est pas affichable');
  assert.equal(formatRange(null), null);
  assert.equal(formatRange(undefined), null);
});

test('Enrichissement : additif, aucun champ d’origine n’est perdu ni renommé', () => {
  const ligne = {
    id: 'alerte-1',
    organizationId: 'org-1',
    plotId: 'parcelle-1',
    recommendationId: 'reco-1',
    parameter: 'ph',
    sourceType: 'MEASUREMENT',
    referenceValue: 6.8,
    observedValue: 7.4,
    deviation: 0.6,
    severity: 'WARNING',
    status: 'NEW',
    episodeKey: 'ph:2026-10',
    channelsSent: ['sms'],
    notificationCount: 2,
    observedAt: '2026-10-01T08:00:00.000Z',
    predictive: false,
  };

  const decrite = describeAlert(ligne, {
    range: { min: 5.5, max: 6.8, unit: 'pH', rangeStatus: 'PROVISIONAL', derivedFrom: 'publication' },
  });

  for (const [cle, valeur] of Object.entries(ligne)) {
    assert.deepEqual(decrite[cle], valeur, `le champ ${cle} a été altéré`);
  }

  assert.equal(decrite.parameterLabel, parameterLabel('ph'));
  assert.equal(decrite.referenceLabel, '6.8 pH');
  assert.equal(decrite.observedLabel, '7.4 pH');
  assert.equal(decrite.range.label, '5.5 – 6.8 pH');
  /*
   * Le statut de la plage est conservé : une alerte fondée sur une plage
   * provisoire doit pouvoir le dire. Aucune plage n'est validée dans ce dépôt
   * tant que le formulaire agronome n'est pas rempli.
   */
  assert.equal(decrite.range.status, 'PROVISIONAL');
});

test('Enrichissement : sans plage, `range` est null — pas un objet vide', () => {
  const decrite = describeAlert({
    id: 'a',
    sourceType: 'SENSOR_SILENCE',
    severity: 'INFO',
    status: 'NEW',
    parameter: 'sensorSilence',
    referenceValue: 24,
    observedValue: 31,
  });

  // `null` est une information : sans bornes on peut dire qu'un seuil a été
  // franchi, pas situer la valeur observée. Un `{}` afficherait « – ».
  assert.equal(decrite.range, null);
  assert.equal(decrite.unit, 'h');
  assert.equal(decrite.observedLabel, '31 h');
  assert.equal(decrite.referenceLabel, '24 h');
});

test('Enrichissement : une alerte préventive se distingue d’une mesure absente', () => {
  const prevision = describeAlert({
    id: 'p',
    sourceType: 'FORECAST',
    severity: 'WARNING',
    status: 'NEW',
    parameter: 'moisture',
    referenceValue: 30,
    observedValue: null,
    predictive: true,
  });
  const silence = describeAlert({
    id: 's',
    sourceType: 'MEASUREMENT',
    severity: 'WARNING',
    status: 'NEW',
    parameter: 'moisture',
    referenceValue: 30,
    observedValue: null,
    predictive: false,
  });

  // Les deux ont `observedValue === null` : sans le drapeau, un écran ne
  // pourrait pas distinguer « pas encore mesuré » de « n'a pas remonté ».
  assert.equal(prevision.predictive, true);
  assert.equal(silence.predictive, false);
});

test('Filtres : les options reprennent exactement les tables de libellés', () => {
  const meta = describeAlertFilters();
  assert.deepEqual(meta.sourceTypes.map((o) => o.value), Object.keys(SOURCE_TYPE_LABELS));
  assert.deepEqual(meta.severities.map((o) => o.value), Object.keys(SEVERITY_LABELS));
  assert.deepEqual(meta.statuses.map((o) => o.value), Object.keys(STATUS_LABELS));

  for (const liste of [meta.sourceTypes, meta.severities, meta.statuses]) {
    for (const option of liste) {
      assert.ok(option.label, `option sans libellé : ${option.value}`);
      assert.notEqual(option.label, option.value);
    }
  }

  // Gelé : un écran ne peut pas muter la liste des valeurs acceptées par l'API.
  assert.throws(() => {
    meta.statuses.push({ value: 'IGNOREE', label: 'Ignorée' });
  }, TypeError);
});

/* ═════════════════════════ volet structurel ═════════════════════════ */

test('Écrans : aucun libellé d’alerte recopié, sur les deux clients', () => {
  const violations = [];

  /*
   * Motifs recherchés :
   * - une table `CODE: 'Libellé'` recopiée dans le client ;
   * - un ternaire qui traduit un code d'enum en français.
   *
   * Les deux sont justes pour les valeurs connues et muets pour toute autre.
   */
  /*
   * Vocabulaire fermé des **tons visuels** des deux clients.
   *
   * Une carte de tons (`{ WARNING: 'warning' }`, `status === 'HANDLED' ? 'paper'
   * : 'white'`) mappe un code vers un jeton de thème : c'est de la mise en
   * forme, pas un libellé, et elle n'a pas à venir de l'API. L'exclure n'est pas
   * un trou — la valeur doit être l'un de ces jetons, et un libellé français
   * (« Avertissement ») ne l'est jamais.
   */
  const TONS =
    'info|warning|error|success|neutral|forest|living|gold|paper|white|pale|ink|dark|primary|outline|ghost|danger|sm|md|lg';

  // Les trois guillemets utilisables en JSX : apostrophe, double, accent grave.
  const G = '[\'"`]';
  /** Négation : la valeur mappée est un jeton de thème, pas un libellé. */
  const pasUnTon = '(?!\\s*(?:' + TONS + ')\\s*' + G + ')';

  /** `CODE: 'valeur'` où la valeur n'est pas un ton = table de libellés recopiée. */
  const table = (codes) => new RegExp('\\b(?:' + codes + ')\\s*:\\s*' + G + pasUnTon);
  /** `=== 'CODE' ? 'phrase française'` où la phrase n'est pas un ton. */
  const ternaire = (codes) =>
    new RegExp('===\\s*[\'"](?:' + codes + ')[\'"]\\s*\\?\\s*' + G + pasUnTon + '[^\'"`]*[a-zà-ÿ]');

  const MOTIFS = [
    { re: table('MEASUREMENT|FORECAST|SENSOR_SILENCE'), nom: 'table de libellés de source' },
    { re: table('INFO|WARNING|CRITICAL'), nom: 'table de libellés de gravité' },
    { re: table('NEW|READ|HANDLED'), nom: 'table de libellés de statut' },
    { re: ternaire('MEASUREMENT|FORECAST|SENSOR_SILENCE'), nom: 'ternaire source vers français' },
    { re: ternaire('INFO|WARNING|CRITICAL'), nom: 'ternaire gravité vers français' },
    { re: ternaire('NEW|READ|HANDLED'), nom: 'ternaire statut vers français' },
    {
      re: /\b(?:SOURCE_TYPE_LABELS|SEVERITY_LABELS|STATUS_LABELS)\b/,
      nom: 'table de libellés importée dans le client',
    },
  ];

  for (const { nom, fichier } of ECRANS) {
    const source = code.get(fichier);
    for (const motif of MOTIFS) {
      if (motif.re.test(source)) violations.push(`${nom} : ${motif.nom} (${fichier})`);
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('Écrans : aucun code d’enum affiché tel quel', () => {
  const violations = [];
  /*
   * `{alert.severity}` rend le code brut. Le ton visuel peut rester déduit du
   * code (`SEVERITY_TONE[alert.severity]`) : c'est de la mise en forme, pas un
   * libellé. On ne cherche donc que l'affichage direct.
   */
  const AFFICHAGES = ['severity', 'status', 'sourceType', 'parameter'];

  for (const { nom, fichier } of ECRANS) {
    const source = code.get(fichier);
    for (const champ of AFFICHAGES) {
      const re = new RegExp(`\\{\\s*alert\\.${champ}\\s*\\}`);
      if (re.test(source)) violations.push(`${nom} : affiche alert.${champ} brut`);
      const re2 = new RegExp(`label=\\{alert\\.${champ}\\}`);
      if (re2.test(source)) violations.push(`${nom} : pastille label={alert.${champ}}`);
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('Écrans : les libellés et la plage sont lus sur les deux clients', () => {
  const CHAMPS = ['sourceTypeLabel', 'severityLabel', 'statusLabel', 'parameterLabel', 'referenceLabel'];

  for (const { nom, fichier } of ECRANS) {
    const source = code.get(fichier);
    const manquants = CHAMPS.filter((champ) => !source.includes(`alert.${champ}`));
    assert.deepEqual(manquants, [], `${nom} n'utilise pas : ${manquants.join(', ')}`);
  }

  // La plage (« valeur observée et plage ») n'a de sens que sur les deux
  // boîtes d'alertes ; le panneau de parcelle porte déjà le seuil franchi.
  for (const { nom, fichier } of ECRANS.slice(0, 2)) {
    const source = code.get(fichier);
    assert.ok(source.includes('range'), `${nom} n'affiche pas la plage de référence`);
    assert.ok(
      source.includes('observedLabel'),
      `${nom} n'affiche pas la valeur observée formatée`,
    );
    // Une plage provisoire doit pouvoir être signalée : c'est la contrainte
    // « rien n'est validé tant que le formulaire agronome n'est pas rempli ».
    assert.ok(
      source.includes('PROVISIONAL'),
      `${nom} ne distingue pas une plage provisoire d'une plage validée`,
    );
  }
});

test('Écrans : `open` et `status` ne sont jamais envoyés ensemble', () => {
  /*
   * L'API renvoie 422 quand les deux filtres sont présents (`listAlertsQuery`
   * `.refine`). Deux sélecteurs distincts laisseraient croire que les deux
   * s'appliquent alors que l'un est rejeté — d'où un seul sélecteur d'état.
   */
  for (const { nom, fichier } of ECRANS.slice(0, 2)) {
    const source = code.get(fichier);
    assert.ok(
      /etat === 'OUVERTS' \? true : undefined/.test(source),
      `${nom} n'exprime pas l'exclusivité open/status`,
    );
    assert.ok(
      /etat === 'OUVERTS' \|\| etat === 'TOUS' \? undefined : etat/.test(source),
      `${nom} peut envoyer open et status en même temps`,
    );
    // Les options d'état viennent de l'API, pas d'une liste écrite à la main.
    assert.ok(source.includes('options.statuses'), `${nom} n'utilise pas /alerts/meta`);
    assert.ok(source.includes('options.sourceTypes'), `${nom} n'utilise pas /alerts/meta`);
  }
});

test('Types client : les alertes sont typées `DescribedAlert`, pas `ThresholdAlert`', async () => {
  for (const relatif of ['apps/web/src/services/types.ts', 'apps/Mobile/src/services/api/types.ts']) {
    const source = sansCommentaires(await lire(relatif));
    assert.ok(
      /export interface DescribedAlert extends ThresholdAlert/.test(source),
      `${relatif} ne déclare pas DescribedAlert`,
    );
    assert.ok(/items: DescribedAlert\[\]/.test(source), `${relatif} : AlertList.items n'est pas enrichi`);
    // `range` doit être `AlertRange | null` : un type qui masque l'absence
    // ferait afficher « undefined » au lieu de « non disponible ».
    assert.ok(/range: AlertRange \| null/.test(source), `${relatif} : range doit pouvoir être null`);
  }

  /*
   * `severity` n'est pas un filtre de l'API. Annoncé dans la signature, il
   * donnait l'impression de filtrer alors que l'API l'ignore.
   */
  for (const relatif of [
    'apps/web/src/services/endpoints.ts',
    'apps/Mobile/src/services/api/endpoints.ts',
  ]) {
    const source = sansCommentaires(await lire(relatif));
    const bloc = source.slice(source.indexOf('export const alertApi'));
    assert.ok(bloc.length > 0, `${relatif} ne définit pas alertApi`);
    assert.ok(!/severity\?:\s*AlertSeverity/.test(bloc), `${relatif} annonce encore un filtre severity inopérant`);
    assert.ok(/sourceType\?:\s*AlertSourceType/.test(bloc), `${relatif} n'expose pas le filtre sourceType`);
    assert.ok(/\/alerts\/meta/.test(bloc), `${relatif} n'appelle pas /alerts/meta`);
  }
});

test('Service : les quatre sorties d’alertes passent par describeAlert', async () => {
  const service = sansCommentaires(await lire('backend/src/modules/alerts/alerts.service.js'));

  for (const sortie of ['export const list', 'export const get', 'export const markRead', 'export const markHandled']) {
    const debut = service.indexOf(sortie);
    assert.ok(debut > -1, `${sortie} introuvable dans alerts.service.js`);
    const fin = service.indexOf('\n};', debut);
    const corps = service.slice(debut, fin === -1 ? undefined : fin);
    assert.ok(
      corps.includes('describeAlert'),
      `${sortie} renvoie encore la ligne Prisma brute`,
    );
  }

  // La plage du détail vient des `thresholds` de la recommandation liée, pas
  // d'un recalcul : une plage différente de celle qui a déclenché l'alerte
  // serait trompeuse.
  assert.ok(
    /thresholds: true/.test(service),
    'le service ne lit pas CropRecommendation.thresholds',
  );
});

test('Routes : /alerts/meta est déclarée avant /alerts/:id', async () => {
  const routes = await lire('backend/src/modules/alerts/alerts.routes.js');
  const positionMeta = routes.indexOf("'/meta'");
  const positionId = routes.indexOf("'/:id'");

  assert.ok(positionMeta > -1, 'la route /alerts/meta a disparu');
  assert.ok(positionId > -1, 'la route /alerts/:id a disparu');
  /*
   * Express teste les routes dans l'ordre : déclarée après, `/alerts/meta`
   * serait avalée par `/:id` avec `id = 'meta'` et renverrait 404.
   */
  assert.ok(
    positionMeta < positionId,
    '/alerts/meta est déclarée après /:id et serait avalée par le paramètre',
  );
});
