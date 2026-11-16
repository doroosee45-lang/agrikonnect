/**
 * Activation du module d'appels audio — règle de priorité UNIQUE.
 *
 * Le module est actif si et seulement si LES TROIS conditions sont réunies :
 *   1. `CALLS_ENABLED=true`         interrupteur d'infrastructure (Render),
 *                                    désactivé par défaut ; `false` l'emporte
 *                                    TOUJOURS, quel que soit le réglage admin ;
 *   2. LiveKit configuré             `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
 *                                    `LIVEKIT_API_SECRET` présents ;
 *   3. `modules.appels` ≠ false      réglage d'administration (palier 1),
 *                                    actif par défaut : coupure rapide sans
 *                                    redéploiement.
 *
 * Aucune contradiction silencieuse : `etatAppels()` renvoie la liste des
 * raisons d'indisponibilité (exposée par `GET /calls/config` et journalisée
 * au démarrage), jamais un simple booléen muet.
 */
import { env } from '../../config/env.js';
import { liveKitConfigure } from '../../integrations/livekit.js';
import { lireDrapeaux } from '../../middleware/settingsEffects.js';

/** Fonction pure (testée) : état d'activation et raisons. */
export const evaluerActivation = ({ callsEnabled, liveKitPret, reglageModule }) => {
  const raisons = [];
  if (callsEnabled !== 'true') raisons.push('CALLS_ENABLED_FALSE');
  if (!liveKitPret) raisons.push('LIVEKIT_NOT_CONFIGURED');
  if (reglageModule === false) raisons.push('MODULE_DISABLED_BY_ADMIN');
  return { enabled: raisons.length === 0, reasons: raisons };
};

/** État courant (lit le réglage d'administration via le cache partagé). */
export const etatAppels = async () => {
  let reglageModule;
  try {
    reglageModule = (await lireDrapeaux())['modules.appels'];
  } catch {
    reglageModule = undefined; // lecture impossible : les deux autres conditions décident
  }
  return evaluerActivation({
    callsEnabled: env.CALLS_ENABLED,
    liveKitPret: liveKitConfigure(),
    reglageModule,
  });
};

/** Contradiction à signaler au démarrage : demandé mais impossible. */
export const avertissementDemarrage = () => {
  if (env.CALLS_ENABLED === 'true' && !liveKitConfigure()) {
    return 'CALLS_ENABLED=true mais LiveKit n\'est pas configuré (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) : '
      + 'les appels restent INDISPONIBLES.';
  }
  return null;
};
