/**
 * Sources satellite — configuration de déploiement RDC.
 *
 * Choix structurant pour ce déploiement : **Sentinel-1 (radar) est la source
 * principale pour l'humidité du sol**, devant Sentinel-2 (optique).
 *
 * Pourquoi : Équateur et Bandundu sont des zones à couverture nuageuse
 * fréquente et persistante. Un capteur optique ne voit pas le sol sous les
 * nuages ; attendre une scène sans nuage peut coûter plusieurs semaines de
 * données. Le radar à ouverture synthétique (bande C) traverse les nuages et
 * donne une mesure à chaque passage, indépendamment de la météo et de
 * l'éclairage.
 *
 * Limite à ne pas masquer : **le radar mesure la surface**, pas le sous-sol.
 * La règle du CDC reste absolue — la vérité sous-sol vient des sondes et du
 * GPR. Sentinel-1 complète les zones sans sonde, avec une confiance faible.
 *
 * Ce fichier ne contient que la **logique de choix** de la source. Les
 * paramètres du matériel (missions, capteurs, sensibilité aux nuages, ordre de
 * priorité) vivent dans le fichier de configuration matériel,
 * `src/config/hardware.js`, seule source de vérité : changer l'ordre des
 * sources ou ajouter une mission se fait là-bas, sans toucher à ce fichier.
 */
import { env } from './env.js';
import { hardware } from './hardware.js';

/**
 * Priorité des sources satellite pour l'humidité du sol.
 *
 * Lue dans le fichier de configuration matériel. L'ordre du tableau EST la
 * priorité : le premier disponible gagne.
 */
const MOISTURE_SOURCE_PRIORITY = Object.freeze(hardware.satellite.sources.map(Object.freeze));

/**
 * Index satellite admis comme mesure d'humidité du sol.
 *
 * `SatelliteObservation.value` est un flottant dont le sens dépend de `index`,
 * et la valeur par défaut est **NDVI**. Un NDVI (0–1) n'est pas un pourcentage
 * d'humidité : le lire comme tel produirait un nombre plausible mais faux.
 * On filtre donc explicitement, et l'absence d'index d'humidité est signalée
 * plutôt que comblée par une autre mesure.
 *
 * La liste des index admis est un paramètre du matériel : elle figure dans
 * `src/config/hardware.js`.
 */
export const MOISTURE_INDEXES = Object.freeze([...hardware.satellite.moistureIndexes]);

/**
 * Seuil au-delà duquel une scène optique est refusée pour l'humidité.
 *
 * Validé par le schéma d'environnement (`src/config/env.js`) : une valeur hors
 * bornes fait refuser le démarrage plutôt que de borner silencieusement.
 *
 * **Non dupliqué** dans le fichier matériel : celui-ci ne porte que le nom de
 * la variable (`satellite.cloudRejectThresholdEnvVar`). Deux copies d'un même
 * seuil finissent toujours par diverger.
 */
if (env.SATELLITE_CLOUD_REJECT_PCT === undefined && hardware.satellite.cloudRejectThresholdEnvVar) {
  throw new Error(
    `Le seuil de nuages attendu dans ${hardware.satellite.cloudRejectThresholdEnvVar} est absent de l'environnement.`,
  );
}
export const CLOUD_COVER_REJECT_PCT = env.SATELLITE_CLOUD_REJECT_PCT;

/** Ordre retenu pour l'humidité du sol, du plus au moins prioritaire. */
export const MOISTURE_SOURCES = MOISTURE_SOURCE_PRIORITY;

/**
 * Source principale pour l'humidité — la première de la liste.
 *
 * Contrôlée contre la déclaration du fichier matériel : si les deux divergent,
 * le code et la configuration racontent des histoires différentes.
 */
export const PRIMARY_MOISTURE_SOURCE = MOISTURE_SOURCE_PRIORITY[0];

if (PRIMARY_MOISTURE_SOURCE?.id !== hardware.satellite.primaryMoistureSource) {
  throw new Error(
    `Source principale incohérente : le fichier matériel déclare `
    + `« ${hardware.satellite.primaryMoistureSource} », la liste commence par `
    + `« ${PRIMARY_MOISTURE_SOURCE?.id} ».`,
  );
}

/**
 * Résout la source satellite à utiliser pour l'humidité.
 *
 * @param {object} options
 * @param {number|null} options.cloudCoverPct couverture nuageuse de la scène
 *        candidate (0–100), `null` si inconnue.
 * @param {string|null} options.availableSource identifiant de la source
 *        effectivement disponible pour la scène.
 * @returns {{ source: object, degraded: boolean, reason: string }}
 */
export const resolveMoistureSource = ({ cloudCoverPct = null, availableSource = null } = {}) => {
  // Une scène explicitement fournie prime sur la préférence théorique.
  const explicit = MOISTURE_SOURCE_PRIORITY.find((entry) => entry.id === availableSource);
  const cloudy = Number.isFinite(cloudCoverPct) && cloudCoverPct >= CLOUD_COVER_REJECT_PCT;

  if (explicit) {
    if (!explicit.cloudInsensitive && cloudy) {
      /**
       * La scène optique est **refusée**, conformément au contrat de
       * `SATELLITE_CLOUD_REJECT_PCT` : au-delà du seuil, une mesure d'humidité
       * optique n'est pas exploitable. On ne la conserve pas en la dégradant —
       * une valeur douteuse finit toujours par être lue comme une mesure.
       *
       * On bascule sur le radar, qui traverse les nuages : c'est précisément
       * pourquoi il est la source principale de ce déploiement.
       */
      const fallback =
        MOISTURE_SOURCE_PRIORITY.find((entry) => entry.cloudInsensitive) ?? PRIMARY_MOISTURE_SOURCE;
      return {
        source: fallback,
        degraded: false,
        rejectedSource: explicit.id,
        reason: `Scène optique ${explicit.id} refusée : ${cloudCoverPct} % de couverture nuageuse `
          + `(seuil ${CLOUD_COVER_REJECT_PCT} %). Bascule sur ${fallback.id} (radar).`,
      };
    }
    return { source: explicit, degraded: false, reason: null };
  }

  // Aucune scène précisée : on prend la première source insensible aux nuages.
  const preferred = MOISTURE_SOURCE_PRIORITY.find((entry) => entry.cloudInsensitive) ?? PRIMARY_MOISTURE_SOURCE;
  return {
    source: preferred,
    degraded: false,
    reason: preferred.id === PRIMARY_MOISTURE_SOURCE.id
      ? 'Source principale (radar) : mesure disponible indépendamment de la couverture nuageuse.'
      : null,
  };
};

/** Libellé commun rappelant la limite du satellite. */
export const SUBSURFACE_CAVEAT =
  'Le satellite mesure la surface, pas le sous-sol. Les valeurs de sous-sol '
  + 'proviennent des sondes et du GPR ; le satellite ne complète que les zones sans sonde.';
