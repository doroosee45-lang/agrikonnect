import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Respecte le réglage système « réduire les animations » (§7.2).
 *
 * ## Pourquoi ce hook existe
 *
 * **Aucun écran de l'application ne consultait ce réglage.** Les révélations au
 * défilement, les translations et les zooms jouaient donc pour tout le monde, y
 * compris pour les personnes qui ont explicitement demandé à ne pas en avoir.
 *
 * ## La règle
 *
 * Quand le réglage est actif : **aucune translation, aucun zoom**, et un fondu
 * court conservé (≤ 150 ms). Un fondu seul ne déclenche pas le mal des
 * transports ; un déplacement de 22 px, si.
 *
 * Un contenu ne doit **jamais** rester invisible : si un écran conditionne son
 * opacité à une animation, il doit la jouer jusqu'au bout ou s'afficher
 * directement.
 *
 * ## Usage
 *
 * ```tsx
 * const reduit = useMouvementReducit();
 * const decalage = reduit ? 0 : 22;
 * const duree = reduit ? 150 : 620;
 * ```
 */
export function useMouvementReducit(): boolean {
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    let actif = true;

    /*
     * La valeur initiale est lue une fois, puis le réglage est suivi : un
     * utilisateur peut l'activer sans redémarrer l'application.
     */
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valeur) => {
        if (actif) setReduit(valeur);
      })
      // Certains environnements (web via Expo, tests) ne l'implémentent pas.
      // On retombe sur « animations normales » plutôt que de planter l'écran.
      .catch(() => {
        if (actif) setReduit(false);
      });

    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', (valeur) => {
      setReduit(valeur);
    });

    return () => {
      actif = false;
      abonnement.remove();
    };
  }, []);

  return reduit;
}
