import { StyleSheet, View } from 'react-native';

import { Card, Chip, Text } from '@/components/ui';
import type { RecommendationCreated } from '@/services/api/types';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

/**
 * Méthode de calcul d'une recommandation — écran 2, mobile.
 *
 * Miroir de `apps/web/src/pages/farmer/Plots/RecommendationMethod.tsx`.
 *
 * ## Règle de ce composant
 *
 * **Aucun texte métier n'est écrit ici.** Version du moteur, libellé de la
 * règle de combinaison, description de cette règle, rappel sur la nature du
 * score et raisons du caractère indicatif viennent tous de la réponse de l'API.
 *
 * La version précédente recopiait les libellés :
 *
 * ```tsx
 * {entry.combinationRule === 'MOST_LIMITING' ? ' · facteur le plus limitant' : ''}
 * ```
 *
 * Ce code est juste pour les deux règles connues et **muet** pour toute autre
 * valeur. Une règle ajoutée au moteur ne provoquerait aucune erreur : l'écran
 * cesserait simplement de dire selon quoi le score est calculé.
 *
 * Les seuls littéraux sont les intitulés de champs (« Moteur », « Couverture »),
 * qui sont de la chrome d'interface.
 */

export type MethodeDonnees = Pick<
  RecommendationCreated,
  | 'engineVersion'
  | 'scoringModelLabel'
  | 'combinationRuleLabel'
  | 'combinationRuleDescription'
  | 'scoreNotice'
  | 'indicative'
  | 'indicativeReasons'
  | 'counts'
>;

/** Une ligne intitulé / valeur. */
function Ligne({ intitule, valeur }: { intitule: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text preset="caption" color={COLORS.slateGray} style={styles.intitule}>
        {intitule}
      </Text>
      <Text preset="bodySm" color={COLORS.textPrimary} style={{ flex: 1 }}>
        {valeur}
      </Text>
    </View>
  );
}

export function MethodeDeCalcul({ data }: { data: MethodeDonnees }) {
  const {
    engineVersion,
    scoringModelLabel,
    combinationRuleLabel,
    combinationRuleDescription,
    scoreNotice,
    indicative,
    indicativeReasons,
    counts,
  } = data;

  return (
    <View style={styles.conteneur}>
      {indicative ? (
        <Card tone="gold" style={styles.bloc}>
          <Chip label="Recommandation indicative" tone="warning" size="sm" />
          {/* Raisons fournies par l'API : elles nomment la cause réelle. */}
          {indicativeReasons.map((raison) => (
            /* Les raisons sont des phrases distinctes, stables pour un calcul donné. */
            <Text key={raison} preset="caption" color={COLORS.onGoldSurface} style={styles.lineHeight}>
              • {raison}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card tone="white" style={styles.bloc}>
        <Text preset="overline" color={COLORS.forestGreen}>
          Méthode de calcul
        </Text>

        <Ligne intitule="Moteur" valeur={`v${engineVersion} — ${scoringModelLabel}`} />

        <View style={styles.ligne}>
          <Text preset="caption" color={COLORS.slateGray} style={styles.intitule}>
            Règle de combinaison
          </Text>
          {/* Libellé fourni par l'API, jamais recopié ici. */}
          <Text preset="bodySm" color={COLORS.textPrimary} style={styles.gras}>
            {combinationRuleLabel}
          </Text>
        </View>

        {combinationRuleDescription ? (
          <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
            {combinationRuleDescription}
          </Text>
        ) : null}

        <Ligne
          intitule="Critères évalués"
          valeur={`${counts.ranked} culture(s) classée(s) sur ${counts.candidates} examinée(s) · ${counts.eliminated} écartée(s) · ${counts.insufficientData} sans données suffisantes`}
        />
        <Ligne intitule="Mesures utilisées" valeur={`${counts.readingsUsed} lecture(s)`} />
      </Card>

      <Card tone="pale" style={styles.bloc}>
        {/*
          `scoreNotice` affiché **tel quel** : c'est le garde-fou contre la
          lecture d'un score comme une promesse.
        */}
        <Text preset="caption" color={COLORS.textPrimary} style={styles.lineHeight}>
          {scoreNotice}
        </Text>
      </Card>
    </View>
  );
}

/**
 * Couverture et nombre de critères évalués d'une culture classée.
 *
 * Avec la règle du facteur le plus limitant, un paramètre non mesuré est
 * ignoré : sans le nombre de critères, une couverture de 100 % obtenue sur un
 * seul paramètre se lit comme une évaluation complète.
 */
export function LigneMethodeCulture({
  coverage,
  evaluatedCount,
  tooFewCriteria,
}: {
  coverage: number;
  evaluatedCount?: number;
  tooFewCriteria?: boolean;
}) {
  return (
    <Text preset="caption" color={COLORS.slateGray} style={styles.lineHeight}>
      {`couverture ${Math.round(coverage * 100)} %`}
      {typeof evaluatedCount === 'number' ? ` · ${evaluatedCount} critère(s) évalué(s)` : ''}
      {tooFewCriteria ? ' · trop peu de critères pour classer' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  conteneur: { gap: SPACING.sm },
  bloc: { gap: SPACING.xs },
  ligne: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  intitule: { width: 120 },
  gras: { fontWeight: '600', flex: 1 },
  lineHeight: { lineHeight: 18 },
});
