import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AuthGate,
  EmptyState,
  ErrorState,
  LoadingState,
  Section,
} from '@/components/ui';
import {
  BadgeFiabilite,
  Bouton,
  Carte,
  Champ,
  Encadre,
  Etiquette,
  Reveal,
  TitreSection,
} from '@/components/kit';
import { IconeGraphique, IconePlant } from '@/components/Icons';
import { plotApi, referenceApi, seasonApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { ENCRE, VERT } from '@/theme/agrikonnect';
import type { SeasonFeedback } from '@/services/types';

/** Année en cours : la saison déclarée est presque toujours celle-ci ou la suivante. */
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Rappel affiché à côté de tout rapprochement.
 *
 * Le backend renvoie le même texte dans `scoreNote`. Il est répété ici pour que
 * l'écran reste honnête même si la réponse ne le porte pas.
 */
const SCORE_NOTE =
  'Le score d’une recommandation mesure l’adéquation d’un sol à une culture, pas un '
  + 'rendement attendu. Un rendement faible sur une culture bien classée peut venir du '
  + 'climat, des ravageurs ou de la récolte, qui ne sont pas mesurés ici.';

const formatKg = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

const emptyForm = () => ({
  plotId: '',
  cropId: '',
  season: '',
  year: String(CURRENT_YEAR),
  periodStart: '',
  periodEnd: '',
  actualYieldKg: '',
  areaHa: '',
  observations: '',
});

/**
 * Saisie du rendement réellement obtenu.
 *
 * C'est la seule entrée de vérité « ce qui s'est passé ». Sans elle, aucune
 * comparaison entre le moteur de règles et un modèle appris n'est possible.
 *
 * Deux règles d'affichage en découlent :
 *
 * - **rien n'est estimé ici.** Aucun rendement par hectare pré-rempli, aucune
 *   valeur par défaut : ce que l'agriculteur ne saisit pas reste absent ;
 * - **le rendement par hectare est montré comme un calcul**, pas comme une
 *   donnée saisie, et il disparaît quand la surface est inconnue.
 */
export default function SeasonFeedbackPage() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });

  const plots = useQuery({
    queryKey: queryKeys.plots.list({ limit: 100 }),
    queryFn: () => plotApi.list({ limit: 100 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const crops = useQuery({
    queryKey: queryKeys.crops.list({}),
    queryFn: () => referenceApi.crops().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const feedbacks = useQuery({
    queryKey: queryKeys.seasons.list({}),
    queryFn: () => seasonApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const comparison = useQuery({
    queryKey: queryKeys.seasons.compare(compareId ?? ''),
    queryFn: () => seasonApi.compare(compareId as string).then((result) => result.data),
    enabled: isAuthenticated && Boolean(compareId),
  });

  const create = useMutation({
    mutationFn: () =>
      seasonApi.create({
        plotId: form.plotId,
        cropId: form.cropId,
        season: form.season,
        year: Number(form.year),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        actualYieldKg: Number(form.actualYieldKg),
        // Une surface absente reste absente : envoyer 0 ferait croire à une
        // parcelle de superficie nulle.
        ...(form.areaHa ? { areaHa: Number(form.areaHa) } : {}),
        ...(form.observations ? { observations: form.observations } : {}),
      }),
    onSuccess: (response) => {
      setSaved(
        `Rendement enregistré : ${formatKg(response.data.seasonFeedback.actualYieldKg)} kg.`
        + ' Merci — c’est cette donnée qui permet d’améliorer les recommandations.',
      );
      setForm(emptyForm);
      invalidate();
    },
  });

  const items = feedbacks.data ?? [];
  const set = (key: keyof ReturnType<typeof emptyForm>) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Rendement par hectare montré en direct, comme un calcul et non une saisie. */
  const previewPerHa =
    form.actualYieldKg && form.areaHa && Number(form.areaHa) > 0
      ? Math.round((Number(form.actualYieldKg) / Number(form.areaHa)) * 100) / 100
      : null;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Rendements réels"
        description="Connectez-vous pour déclarer ce que vous avez réellement récolté."
        icon="🌾"
      >
        {/* ====== En-tête : un seul h1 (A1, I6) ====== */}
        <div className="conteneur pb-4 pt-12 sm:pt-16" style={{ paddingInline: 0 }}>
          <Reveal>
            <TitreSection
              niveau={1}
              surtitre="Retour de saison"
              titre="Rendements réels"
              intro="Déclarez ce que vous avez récolté. C'est la seule donnée que la plateforme ne
                     peut pas mesurer elle-même, et c'est elle qui permet d'améliorer les
                     recommandations."
            />
          </Reveal>
        </div>

        <div className="conteneur py-10" style={{ paddingInline: 0, maxWidth: 880 }}>
          {/* ====== Formulaire ====== */}
          <Reveal>
            <Carte>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--texte-sous-titre)',
                  fontWeight: 600,
                  color: VERT[900],
                }}
              >
                Déclarer un rendement
              </h2>
              <p style={{ marginTop: 6, fontSize: 'var(--texte-dense)', color: ENCRE[500] }}>
                Toutes les valeurs sont déclaratives. Rien n'est estimé à votre place&nbsp;: un
                champ laissé vide reste vide.
              </p>

              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  marginTop: 20,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                }}
              >
                <div>
                  <label htmlFor="saison-parcelle" className="etiquette-champ">
                    Parcelle <span aria-hidden="true" style={{ color: 'var(--terre-600)' }}>*</span>
                  </label>
                  <select
                    id="saison-parcelle"
                    value={form.plotId}
                    className="champ"
                    aria-required="true"
                    onChange={(event) => set('plotId')(event.target.value)}
                  >
                    <option value="">Choisir une parcelle</option>
                    {(plots.data ?? []).map((plot) => (
                      <option key={plot.id} value={plot.id}>
                        {plot.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="saison-culture" className="etiquette-champ">
                    Culture <span aria-hidden="true" style={{ color: 'var(--terre-600)' }}>*</span>
                  </label>
                  <select
                    id="saison-culture"
                    value={form.cropId}
                    className="champ"
                    aria-required="true"
                    onChange={(event) => set('cropId')(event.target.value)}
                  >
                    <option value="">Choisir une culture</option>
                    {(crops.data ?? []).map((crop) => (
                      <option key={crop.id} value={crop.slug ?? crop.id}>
                        {crop.slug ?? crop.id}
                      </option>
                    ))}
                  </select>
                </div>

                <Champ
                  id="saison-nom"
                  label="Saison"
                  valeur={form.season}
                  onChange={set('season')}
                  placeholder="Saison A"
                  obligatoire
                />
                <Champ
                  id="saison-annee"
                  label="Année"
                  valeur={form.year}
                  onChange={set('year')}
                  type="number"
                  inputMode="numeric"
                  obligatoire
                />
                <Champ
                  id="saison-debut"
                  label="Début de période"
                  valeur={form.periodStart}
                  onChange={set('periodStart')}
                  type="date"
                  obligatoire
                />
                <Champ
                  id="saison-fin"
                  label="Fin de période"
                  valeur={form.periodEnd}
                  onChange={set('periodEnd')}
                  type="date"
                  obligatoire
                />
                <Champ
                  id="saison-rendement"
                  label="Rendement total récolté (kg)"
                  valeur={form.actualYieldKg}
                  onChange={set('actualYieldKg')}
                  type="number"
                  inputMode="decimal"
                  obligatoire
                  aide="Le total de la récolte, pas un rendement à l'hectare."
                />
                <Champ
                  id="saison-surface"
                  label="Surface récoltée (ha)"
                  valeur={form.areaHa}
                  onChange={set('areaHa')}
                  type="number"
                  inputMode="decimal"
                  aide="Sans surface, aucun rendement à l'hectare ne sera calculé."
                />
              </div>

              {/*
                Le rendement à l'hectare est montré comme un **calcul en direct**,
                jamais comme une valeur à saisir. S'il est absent, on l'écrit :
                un champ vide ne veut pas dire « zéro ».
              */}
              <p style={{ marginTop: 16, fontSize: 'var(--texte-dense)', color: ENCRE[500] }}>
                {previewPerHa !== null
                  ? `Soit ${previewPerHa.toLocaleString('fr-FR')} kg/ha (calculé à partir de vos deux valeurs).`
                  : 'Rendement par hectare : non calculé — la surface n’est pas renseignée.'}
              </p>

              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {/* Un seul bouton principal par section. */}
                <Bouton
                  variante="principale"
                  onClick={() => create.mutate()}
                  charge={create.isPending}
                  labelleCharge="Enregistrement…"
                  disabled={!form.plotId || !form.cropId || !form.season || !form.actualYieldKg}
                >
                  Enregistrer le rendement
                </Bouton>
              </div>

              {create.isError ? (
                <div style={{ marginTop: 16 }}>
                  <ErrorState error={create.error} />
                </div>
              ) : null}

              {saved ? (
                <div style={{ marginTop: 16 }}>
                  <Encadre ton="succes">{saved}</Encadre>
                </div>
              ) : null}
            </Carte>
          </Reveal>

          {/* ====== Rendements déclarés ====== */}
          <Reveal delai={70}>
            <div style={{ marginTop: 16 }}>
              <Carte>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--texte-sous-titre)',
                    fontWeight: 600,
                    color: VERT[900],
                  }}
                >
                  Rendements déclarés
                </h2>

                <div style={{ marginTop: 16 }}>
                  {feedbacks.isLoading ? (
                    <LoadingState count={3} height={72} />
                  ) : feedbacks.isError ? (
                    <ErrorState error={feedbacks.error} onRetry={() => void feedbacks.refetch()} />
                  ) : items.length === 0 ? (
                    /* Un état vide est toujours un texte explicite, jamais un blanc. */
                    <Encadre ton="info" titre="Aucun rendement déclaré">
                      Les rendements apparaîtront ici après votre première récolte.
                    </Encadre>
                  ) : (
                    /*
                      Recette obligatoire pour un tableau large (§5.5) : conteneur
                      défilant **focusable**, avec `role="region"`, un `aria-label`
                      et `tabIndex={0}`. Sans `tabIndex`, un utilisateur au clavier
                      ne peut pas atteindre le contenu masqué par le défilement.
                    */
                    <div
                      className="relative overflow-x-auto"
                      role="region"
                      aria-label="Rendements déclarés (défilement horizontal si nécessaire)"
                      tabIndex={0}
                      style={{ overflowX: 'auto' }}
                    >
                      <table
                        style={{
                          width: '100%',
                          minWidth: 620,
                          borderCollapse: 'collapse',
                          fontSize: 'var(--texte-dense)',
                        }}
                      >
                        <caption className="visually-hidden">
                          Rendements déclarés, avec la parcelle, la culture, la saison, la
                          récolte, la surface et le rendement à l'hectare
                        </caption>
                        <thead>
                          <tr style={{ background: VERT[800], color: 'var(--creme-100)' }}>
                            {['Parcelle', 'Culture', 'Saison', 'Récolte', 'Surface', 'kg/ha', 'Source', ''].map(
                              (colonne) => (
                                <th
                                  key={colonne}
                                  scope="col"
                                  style={{
                                    padding: '10px 14px',
                                    textAlign: 'left',
                                    fontSize: 'var(--texte-surtitre)',
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {colonne}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: SeasonFeedback) => (
                            <tr
                              key={item.id}
                              style={{ borderTop: '1px solid rgba(18,61,42,0.10)' }}
                            >
                              <th
                                scope="row"
                                style={{
                                  padding: '10px 14px',
                                  textAlign: 'left',
                                  fontWeight: 500,
                                  color: VERT[900],
                                }}
                              >
                                {item.plot?.name ?? 'Parcelle'}
                              </th>
                              <td style={{ padding: '10px 14px' }}>{item.crop?.slug ?? item.cropId}</td>
                              <td style={{ padding: '10px 14px' }}>
                                {item.season} {item.year}
                              </td>
                              <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums' }}>
                                {formatKg(item.actualYieldKg)} kg
                              </td>
                              <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums' }}>
                                {item.areaHa ? `${item.areaHa} ha` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums' }}>
                                {item.yieldPerHa !== null
                                  ? item.yieldPerHa.toLocaleString('fr-FR')
                                  : 'surface inconnue'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <Etiquette ton={item.source === 'declared' ? 'vert' : 'terre'}>
                                  {item.source === 'declared' ? 'Déclaré' : item.source}
                                </Etiquette>
                                {item.version > 1 ? (
                                  <span style={{ marginLeft: 6 }}>
                                    <Etiquette ton="creme">v{item.version}</Etiquette>
                                  </span>
                                ) : null}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <Bouton
                                  variante="fantome"
                                  onClick={() => setCompareId(compareId === item.id ? null : item.id)}
                                >
                                  {compareId === item.id ? 'Masquer' : 'Comparer'}
                                </Bouton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Carte>
            </div>
          </Reveal>

          {/* ====== Rapprochement, sans verdict ====== */}
          {compareId ? (
            <Reveal delai={70}>
              <div style={{ marginTop: 16 }}>
                <Carte style={{ borderLeft: '3px solid var(--terre-400)' }}>
                  {comparison.isLoading ? (
                    <LoadingState count={1} height={90} />
                  ) : comparison.isError ? (
                    <ErrorState error={comparison.error} />
                  ) : (
                    <>
                      <h2
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: 'var(--font-display)',
                          fontSize: 'var(--texte-sous-titre)',
                          fontWeight: 600,
                          color: VERT[900],
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 18 }}>
                          <IconeGraphique />
                        </span>
                        Comparaison avec la recommandation
                      </h2>

                      <div style={{ marginTop: 12 }}>
                        {comparison.data?.comparable && comparison.data.recommendation ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            {comparison.data.recommendation.cultureRank ? (
                              <>
                                {/*
                                  Le rang et le score sont **écrits**, pas seulement
                                  colorés (A11). Le badge de fiabilité n'a pas sa
                                  place ici : une recommandation n'est pas une mesure.
                                */}
                                <BadgeFiabilite
                                  niveau={Math.max(1, Math.min(5, Math.round((comparison.data.recommendation.cultureRank.score ?? 0) * 5)))}
                                  source={`classée ${comparison.data.recommendation.cultureRank.rank}ᵉ sur ${comparison.data.recommendation.culturesClassified}`}
                                />
                                <span style={{ fontSize: 'var(--texte-dense)', color: ENCRE[500] }}>
                                  score {comparison.data.recommendation.cultureRank.score ?? '—'}
                                </span>
                              </>
                            ) : (
                              <p style={{ fontSize: 'var(--texte-dense)', color: ENCRE[500] }}>
                                Cette culture ne figurait pas dans le classement de la
                                recommandation.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p style={{ fontSize: 'var(--texte-dense)', color: ENCRE[500] }}>
                            {comparison.data?.reason ?? 'Rapprochement indisponible.'}
                          </p>
                        )}
                      </div>

                      {/*
                        Le rappel est affiché **quoi qu'il arrive** : c'est lui qui
                        empêche de lire cette comparaison comme une validation ou un
                        désaveu de la recommandation.
                      */}
                      <div style={{ marginTop: 16 }}>
                        <Encadre ton="attention" titre="Adéquation, pas rendement">
                          {comparison.data?.scoreNote ?? SCORE_NOTE}
                        </Encadre>
                      </div>
                    </>
                  )}
                </Carte>
              </div>
            </Reveal>
          ) : null}

          {/* ====== Rappel de ce que cet écran ne fait pas ====== */}
          <Reveal delai={70}>
            <div style={{ marginTop: 16 }}>
              <Encadre ton="info" titre="Ce que cet écran ne calcule pas">
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, fontSize: 16 }}>
                    <IconePlant />
                  </span>
                  Aucune estimation de rendement n'est produite ici, ni ailleurs dans
                  l'application. Un rendement manquant reste manquant&nbsp;: il n'est jamais
                  complété par une moyenne.
                </span>
              </Encadre>
            </div>
          </Reveal>
        </div>
      </AuthGate>
    </Section>
  );
}
