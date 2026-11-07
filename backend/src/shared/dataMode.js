/**
 * Marquage des données géospatiales : réel / configuration / simulé.
 *
 * Pourquoi ce module existe : le matériel géospatial (sondes, drone, GPR) n'est
 * pas encore installé. Le système doit fonctionner maintenant, mais **une valeur
 * simulée ne doit jamais pouvoir passer pour une mesure réelle** — l'agriculteur
 * prend des décisions de semis dessus.
 *
 * Trois modes, portés en base par la colonne `mode` (`DataMode`) :
 *   • `REAL`          — mesure d'un équipement physique réellement connecté ;
 *   • `CONFIGURATION` — équipement enregistré, pas encore en service : la fiche
 *                       existe, aucune mesure n'est produite ;
 *   • `SIMULATED`     — valeur générée. Toujours étiquetée comme telle, et
 *                       refusée à l'écriture dès que l'environnement est en
 *                       production.
 *
 * Les fonctions de décision sont pures (elles reçoivent leur contexte) : elles
 * sont testables sans modifier l'environnement du processus, comme
 * `resolveEncryptionMaterial` dans le module MFA.
 */
import { ApiError } from './errors/ApiError.js';

export const DATA_MODES = Object.freeze(['REAL', 'CONFIGURATION', 'SIMULATED']);

/** Seul `REAL` est une mesure : tout le reste doit être signalé comme tel. */
export const isRealMeasurement = (mode) => mode === 'REAL';

/**
 * Résout le mode d'une écriture. L'absence de mode vaut `REAL` : le chemin
 * nominal (une vraie sonde qui pousse une mesure) ne change pas de comportement.
 */
export const resolveDataMode = (value) => {
  if (value === undefined || value === null || value === '') return 'REAL';
  const normalised = String(value).toUpperCase();
  if (!DATA_MODES.includes(normalised)) {
    throw ApiError.badRequest(
      `Mode de donnée invalide : « ${value} ». Valeurs acceptées : ${DATA_MODES.join(', ')}.`
    );
  }
  return normalised;
};

/**
 * Garde d'écriture : refuse une donnée simulée quand la simulation n'est pas
 * autorisée.
 *
 * Le contexte est passé explicitement plutôt que lu dans `env` pour que la règle
 * soit testable. En production, `simulationAllowed` est `false` par construction
 * (voir `src/config/env.js`) : aucune variable ne peut rouvrir cette porte.
 *
 * @returns {string} le mode résolu, pour que l'appelant le persiste.
 */
export const assertDataModeAllowed = (value, context = {}) => {
  const mode = resolveDataMode(value);
  const { isProd = false, simulationAllowed = !isProd } = context;

  if (mode !== 'SIMULATED') return mode;

  if (isProd) {
    throw ApiError.forbidden(
      'Les données simulées sont refusées en production : aucune valeur générée ne peut être enregistrée comme mesure. Connectez un équipement réel ou désactivez la simulation.'
    );
  }
  if (!simulationAllowed) {
    throw ApiError.forbidden(
      'La simulation est désactivée sur cet environnement (SIMULATION_ENABLED=false). Aucune donnée simulée ne peut être enregistrée.'
    );
  }
  return mode;
};

/**
 * Mention obligatoire affichée avec toute valeur non réelle.
 *
 * Le CDC est explicite : « ne présente jamais des données simulées comme des
 * mesures géospatiales réelles ». Cette mention est donc produite par le backend,
 * pas laissée à la bonne volonté de chaque écran.
 */
export const dataModeLabel = (mode) => {
  switch (mode) {
    case 'SIMULATED':
      return {
        mode: 'SIMULATED',
        isReal: false,
        label: 'Donnée simulée',
        warning:
          'Valeur générée en l’absence de matériel connecté. Elle ne provient d’aucune mesure et ne doit pas fonder une décision de semis.',
      };
    case 'CONFIGURATION':
      return {
        mode: 'CONFIGURATION',
        isReal: false,
        label: 'Équipement en configuration',
        warning:
          'Équipement enregistré mais pas encore en service : aucune mesure réelle n’est disponible pour cette source.',
      };
    default:
      return { mode: 'REAL', isReal: true, label: 'Mesure réelle', warning: null };
  }
};
