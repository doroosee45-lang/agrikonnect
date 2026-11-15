import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { Reveal } from '@/components/ui/Reveal';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { HOME_SLIDES } from './homeSlides';
import { useI18n, tr } from '@/i18n';
import { bcpLocale } from '@/lib/format';

const CLOSING_IMAGE = new URL('../../assets/partenaires/hero.jpg', import.meta.url).href;

const PRINCIPLES = [
  { mark: '01', get title() { return tr('ui.uneDonneeUneOrigine'); }, get body() { return tr('ui.mesureCapteurSatelliteOuDeclarationLa'); } },
  { mark: '02', get title() { return tr('ui.declareNEstPasVerifie'); }, get body() { return tr('ui.lesStatutsDeclaresEtVerifiesRestent'); } },
  { mark: '03', get title() { return tr('ui.laConfidentialiteParDefaut'); }, get body() { return tr('ui.coordonneesProtegeesPositionsApproximativesEtSta'); } },
  { mark: '04', get title() { return tr('ui.lAideALaDecisionReste'); }, get body() { return tr('ui.lesAnalysesPresententLeursSourcesEt'); } },
];

const RELEASES = [
  { tag: 'V1', get name() { return tr('ui.releaseFarm'); }, get body() { return tr('ui.inscriptionDesProducteursExploitationsParcellesG'); } },
  { tag: 'V2', get name() { return tr('ui.releaseMarket'); }, get body() { return tr('ui.annoncesEtDemandesDAchatOffres'); } },
  { tag: 'V3', get name() { return tr('ui.releaseIntelligence'); }, get body() { return tr('ui.prixDeMarcheSourcesMeteoPar'); } },
  { tag: 'V4', get name() { return tr('ui.releaseInvestment'); }, get body() { return tr('ui.dossiersDeProjetDataRoomA'); } },
  { tag: 'V5', get name() { return tr('ui.releaseInternational'); }, get body() { return tr('ui.appelsDOffresInternationauxApiPublique'); } },
];

export default function About() {
  const { t } = useI18n();
  const farms = useQuery({ queryKey: queryKeys.public.farms({ limit: 1 }), queryFn: () => publicApi.farms({ limit: 1 }) });
  const map = useQuery({ queryKey: queryKeys.public.map({ limit: 500 }), queryFn: () => publicApi.map({ limit: 500 }) });
  const soil = useQuery({ queryKey: queryKeys.public.soilStats({}), queryFn: () => publicApi.soilStats() });

  const stats = useMemo(() => {
    const features = map.data?.data.features ?? [];
    return [
      { value: farms.data?.meta?.total, label: t('ui.exploitationsPubliques') },
      { value: map.data?.data.meta.count, label: t('ui.exploitationsLocalisees') },
      { value: soil.data?.data.rows.reduce((sum, row) => sum + row.assessments, 0), label: t('ui.analysesDeSolAgregees') },
      { value: map.data ? new Set(features.map((feature) => feature.properties.countryCode)).size : undefined, label: t('ui.paysRepresentes') },
    ];
  }, [farms.data, map.data, soil.data, t]);

  return (
    <div className="public-home about-page">
      <HeroCarousel slides={HOME_SLIDES} height={440} intervalMs={5000} className="home-hero" />

      <section className="about-intro">
        <div className="about-container">
          <Reveal>
            <div className="about-page-heading">
              <span className="services-eyebrow">{t('ui.agrikonnectAfricaAPropos')}</span>
              <h1>{t('ui.uneInfrastructureDeConfiance')}</h1>
              <p>{t('ui.agrikonnectAfricaRelieProducteursCooperativesAch')}</p>
            </div>
          </Reveal>

          <Reveal delay={70}>
            <article className="about-mission">
              <span className="about-kicker">{t('ui.notreConviction')}</span>
              <h2>{t('ui.laValeurDUneFiliereSe')}</h2>
              <p>{t('ui.surLesMarchesAgricolesAfricainsL')}</p>
            </article>
          </Reveal>

          <div className="about-principles">
            {PRINCIPLES.map((item, index) => (
              <Reveal key={item.mark} delay={index * 75}>
                <article className="about-principle">
                  <span className="about-principle-mark">{item.mark}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="about-stats" aria-label={t('ui.chiffresPublicsDeLaPlateforme')}>
        <div className="about-container about-stats-grid">
          {stats.map((stat) => (
            <div className="about-stat" key={stat.label}>
              <strong>{stat.value === undefined ? '—' : new Intl.NumberFormat(bcpLocale()).format(stat.value)}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
        {(farms.isError || map.isError || soil.isError) && <p className="about-stats-note">{t('ui.certainsChiffresPublicsSontTemporairementIndispo')}</p>}
      </section>

      <section className="about-releases">
        <div className="about-container">
          <Reveal>
            <div className="about-section-heading">
              <span className="services-eyebrow">{t('ui.perimetre_a9110')}</span>
              <h2>{t('ui.ceQueLaPlateformeCouvre')}</h2>
              <p>{t('ui.cinqVersionsFonctionnellesDeLaParcelle')}</p>
            </div>
          </Reveal>
          <div className="about-release-list">
            {RELEASES.map((release, index) => (
              <Reveal key={release.tag} delay={index * 65}>
                <article className="about-release">
                  <div className="about-release-tag"><strong>{release.tag}</strong><span>{release.name}</span></div>
                  <p>{release.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="about-governance">
        <div className="about-container">
          <Reveal>
            <div className="about-section-heading">
              <span className="services-eyebrow">{t('ui.gouvernanceEyebrow')}</span>
              <h2>{t('ui.quiPeutFaireQuoi')}</h2>
              <p>{t('ui.lesRolesOperationnelsSObtiennentEn')}</p>
            </div>
          </Reveal>
          <div className="about-roles">
            <Reveal>
              <article className="about-role-card about-role-card-dark">
                <span className="about-kicker">{t('ui.libreService')}</span>
                <p>{t('ui.producteurCooperativeSocieteAgricoleAcheteurFour')}</p>
                <Link className="about-cta about-cta-gold" to="/auth/register">{t('ui.creerUnCompte')}{' '}<span aria-hidden="true">→</span></Link>
              </article>
            </Reveal>
            <Reveal delay={100}>
              <article className="about-role-card">
                <span className="about-kicker">{t('ui.attribuesParUnAdministrateur')}</span>
                <p>{t('ui.lesRolesDeControleDonnentAcces')}</p>
                <div className="about-chips">{['ADMIN', 'MODERATOR', 'VERIFIER', 'LAB_PARTNER', 'API_CLIENT'].map((role) => <span key={role}>{role}</span>)}</div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="about-closing">
        <div className="about-container about-closing-inner" style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 43, 31, .88), rgba(10, 43, 31, .68)), url("${CLOSING_IMAGE}")` }}>
          <div><span className="about-kicker">{t('common.appName')}</span><h2>{t('ui.construisonsDesFilieresPlusLisibles')}</h2><p>{t('ui.rejoignezLesProducteursCooperativesEtPartenaires')}</p></div>
          <Link className="about-cta about-cta-light" to="/auth/register">{t('ui.rejoindreLaPlateforme')}{' '}<span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </div>
  );
}
