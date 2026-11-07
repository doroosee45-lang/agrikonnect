import { Card, Chip, Text } from '@/components/ui';
import type { RecommendationCreated } from '@/services/types';
import { COLORS } from '@/theme';

/**
 * Méthode de calcul d'une recommandation — écran 2.
 *
 * ## Règle de ce composant
 *
 * **Aucun texte métier n'est écrit ici.** Version du moteur, libellé de la
 * règle de combinaison, description de cette règle, rappel sur la nature du
 * score et raisons du caractère indicatif viennent **tous de la réponse de
 * l'API** (`engineVersion`, `combinationRuleLabel`,
 * `combinationRuleDescription`, `scoreNotice`, `indicativeReasons`).
 *
 * La version précédente recopiait les libellés en dur :
 *
 * ```tsx
 * {entry.combinationRule === 'MOST_LIMITING' ? ' · facteur le plus limitant' : ''}
 * ```
 *
 * Ce code affiche un libellé juste pour les deux règles connues et **rien**
 * pour toute autre valeur : le jour où le moteur change de règle, l'écran
 * n'affiche pas un texte faux, il n'affiche rien du tout — ce qui est pire,
 * parce que ça passe inaperçu. Les libellés sont donc lus dans la réponse.
 *
 * Les seuls littéraux de ce fichier sont les **intitulés de champs**
 * (« Moteur », « Couverture ») : de la chrome d'interface, pas du texte
 * produit par l'API.
 */

/** Ce dont l'API garantit la présence sur un résultat de calcul. */
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

interface Props {
  data: MethodeDonnees;
}

/** Une ligne intitulé / valeur, alignée comme les autres. */
function Ligne({ intitule, valeur }: { intitule: string; valeur: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Text preset="caption" color={COLORS.slateGray} style={{ minWidth: 150 }}>
        {intitule}
      </Text>
      <Text preset="bodySm">{valeur}</Text>
    </div>
  );
}

export function MethodeDeCalcul({ data }: Props) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      {/* ── Statut indicatif ───────────────────────────────────── */}
      {indicative ? (
        <Card tone="gold">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Chip label="Recommandation indicative" tone="warning" size="sm" />
            {/*
              Les raisons viennent de l'API. Elles expliquent **pourquoi** le
              résultat est indicatif (plage provisoire, calendrier non validé) :
              les reformuler ici ferait perdre la cause réelle.
            */}
            {indicativeReasons.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {indicativeReasons.map((raison) => (
                  /* Les raisons sont des phrases distinctes, stables pour un calcul donné. */
                  <li key={raison}>
                    <Text preset="caption">{raison}</Text>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ── Moteur et règle ────────────────────────────────────── */}
      <Card tone="white">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text preset="overline" color={COLORS.forestGreen}>
            Méthode de calcul
          </Text>

          <Ligne intitule="Moteur" valeur={`v${engineVersion} — ${scoringModelLabel}`} />

          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Text preset="caption" color={COLORS.slateGray} style={{ minWidth: 150 }}>
              Règle de combinaison
            </Text>
            {/* Libellé fourni par l'API, jamais recopié ici. */}
            <Text preset="bodySm" style={{ fontWeight: 600 }}>
              {combinationRuleLabel}
            </Text>
          </div>

          {combinationRuleDescription ? (
            <Text preset="caption" color={COLORS.slateGray} style={{ paddingLeft: 162 }}>
              {combinationRuleDescription}
            </Text>
          ) : null}

          <Ligne
            intitule="Critères évalués"
            valeur={`${counts.ranked} culture(s) classée(s) sur ${counts.candidates} examinée(s) · ${counts.eliminated} écartée(s) · ${counts.insufficientData} sans données suffisantes`}
          />
          <Ligne intitule="Mesures utilisées" valeur={`${counts.readingsUsed} lecture(s)`} />
        </div>
      </Card>

      {/* ── Rappel sur la nature du score ──────────────────────── */}
      <Card tone="pale">
        <Text preset="caption" style={{ fontStyle: 'italic' }}>
          {/*
            `scoreNotice` est affiché **tel quel**. C'est le garde-fou contre la
            lecture d'un score comme une promesse : « 0,8 » ne veut pas dire
            80 % de chances de réussite. Le texte est porté par l'API pour
            qu'aucun écran ne puisse l'adoucir ni l'oublier.
          */}
          {scoreNotice}
        </Text>
      </Card>
    </div>
  );
}

/**
 * Ligne de méthode d'une culture classée.
 *
 * Séparée du bloc global parce qu'elle se répète par culture : couverture et
 * nombre de critères évalués sont propres à chaque culture, tandis que le
 * moteur et la règle sont communs au calcul.
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
    <Text preset="caption" color={COLORS.slateGray}>
      {`couverture ${Math.round(coverage * 100)} %`}
      {typeof evaluatedCount === 'number' ? ` · ${evaluatedCount} critère(s) évalué(s)` : ''}
      {tooFewCriteria ? ' · trop peu de critères pour classer' : ''}
    </Text>
  );
}
