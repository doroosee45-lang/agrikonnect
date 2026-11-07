import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { Reveal } from '@/components/ui/Reveal';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { HOME_SLIDES } from './homeSlides';

const CLOSING_IMAGE = new URL('../../assets/partenaires/hero.jpg', import.meta.url).href;

const PRINCIPLES = [
  { mark: '01', title: 'Une donnée, une origine', body: 'Mesure, capteur, satellite ou déclaration : la provenance accompagne chaque valeur. Une donnée absente reste absente.' },
  { mark: '02', title: 'Déclaré n’est pas vérifié', body: 'Les statuts déclarés et vérifiés restent distincts et visibles sur les fiches publiques comme dans les exports.' },
  { mark: '03', title: 'La confidentialité par défaut', body: 'Coordonnées protégées, positions approximatives et statistiques agrégées selon le seuil de k-anonymat.' },
  { mark: '04', title: 'L’aide à la décision reste une aide', body: 'Les analyses présentent leurs sources et leurs limites. Elles ne déclenchent aucune action automatique.' },
];

const RELEASES = [
  { tag: 'V1', name: 'EXPLOITATION', body: 'Inscription des producteurs, exploitations, parcelles géolocalisées, productions, analyses de sol, profils publics.' },
  { tag: 'V2', name: 'MARCHÉ', body: 'Annonces et demandes d’achat, offres, commandes, messagerie interne, transport, avis et réputation.' },
  { tag: 'V3', name: 'INTELLIGENCE', body: 'Prix de marché sourcés, météo par parcelle, traçabilité des lots, certifications, capteurs et synchronisation hors ligne.' },
  { tag: 'V4', name: 'INVESTISSEMENT', body: 'Dossiers de projet, data room à accès limité, due diligence, reporting d’avancement et d’impact, double authentification.' },
  { tag: 'V5', name: 'INTERNATIONAL', body: 'Appels d’offres internationaux, API publique à clé, exports, jeux de données et indicateurs multi-pays.' },
];

export default function About() {
  const farms = useQuery({ queryKey: queryKeys.public.farms({ limit: 1 }), queryFn: () => publicApi.farms({ limit: 1 }) });
  const map = useQuery({ queryKey: queryKeys.public.map({ limit: 500 }), queryFn: () => publicApi.map({ limit: 500 }) });
  const soil = useQuery({ queryKey: queryKeys.public.soilStats({}), queryFn: () => publicApi.soilStats() });

  const stats = useMemo(() => {
    const features = map.data?.data.features ?? [];
    return [
      { value: farms.data?.meta?.total, label: 'exploitations publiques' },
      { value: map.data?.data.meta.count, label: 'exploitations localisées' },
      { value: soil.data?.data.rows.reduce((sum, row) => sum + row.assessments, 0), label: 'analyses de sol agrégées' },
      { value: map.data ? new Set(features.map((feature) => feature.properties.countryCode)).size : undefined, label: 'pays représentés' },
    ];
  }, [farms.data, map.data, soil.data]);

  return (
    <div className="public-home about-page">
      <HeroCarousel slides={HOME_SLIDES} height={440} intervalMs={5000} className="home-hero" />

      <section className="about-intro">
        <div className="about-container">
          <Reveal>
            <div className="about-page-heading">
              <span className="services-eyebrow">AGRIKONNECT AFRICA · À PROPOS</span>
              <h1>Une infrastructure de confiance</h1>
              <p>AGRIKONNECT AFRICA relie producteurs, coopératives, acheteurs et investisseurs autour de données agricoles vérifiables — et assume publiquement les limites de ce qu’elle publie.</p>
            </div>
          </Reveal>

          <Reveal delay={70}>
            <article className="about-mission">
              <span className="about-kicker">NOTRE CONVICTION</span>
              <h2>La valeur d’une filière se prouve, elle ne se déclare pas.</h2>
              <p>Sur les marchés agricoles africains, l’information circule mal : surfaces approximatives, prix sans source, origines invérifiables. Chaque acteur paie cette opacité. Notre réponse n’est pas d’ajouter des promesses, mais de rendre chaque information traçable jusqu’à son origine — et de dire clairement quand elle manque.</p>
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

      <section className="about-stats" aria-label="Chiffres publics de la plateforme">
        <div className="about-container about-stats-grid">
          {stats.map((stat) => (
            <div className="about-stat" key={stat.label}>
              <strong>{stat.value === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(stat.value)}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
        {(farms.isError || map.isError || soil.isError) && <p className="about-stats-note">Certains chiffres publics sont temporairement indisponibles.</p>}
      </section>

      <section className="about-releases">
        <div className="about-container">
          <Reveal>
            <div className="about-section-heading">
              <span className="services-eyebrow">PÉRIMÈTRE</span>
              <h2>Ce que la plateforme couvre</h2>
              <p>Cinq versions fonctionnelles, de la parcelle à l’appel d’offres international.</p>
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
              <span className="services-eyebrow">GOUVERNANCE</span>
              <h2>Qui peut faire quoi</h2>
              <p>Les rôles opérationnels s’obtiennent en libre-service. Les rôles de contrôle sont attribués — jamais auto-déclarés.</p>
            </div>
          </Reveal>
          <div className="about-roles">
            <Reveal>
              <article className="about-role-card about-role-card-dark">
                <span className="about-kicker">LIBRE-SERVICE</span>
                <p>Producteur, coopérative, société agricole, acheteur, fournisseur, transporteur, agronome, investisseur et agent d’appui.</p>
                <Link className="about-cta about-cta-gold" to="/auth/register">Créer un compte <span aria-hidden="true">→</span></Link>
              </article>
            </Reveal>
            <Reveal delay={100}>
              <article className="about-role-card">
                <span className="about-kicker">ATTRIBUÉS PAR UN ADMINISTRATEUR</span>
                <p>Les rôles de contrôle donnent accès à des données sensibles : ils ne sont jamais accordés à l’inscription.</p>
                <div className="about-chips">{['ADMIN', 'MODERATOR', 'VERIFIER', 'LAB_PARTNER', 'API_CLIENT'].map((role) => <span key={role}>{role}</span>)}</div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="about-closing">
        <div className="about-container about-closing-inner" style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 43, 31, .88), rgba(10, 43, 31, .68)), url("${CLOSING_IMAGE}")` }}>
          <div><span className="about-kicker">AGRIKONNECT AFRICA</span><h2>Construisons des filières plus lisibles.</h2><p>Rejoignez les producteurs, coopératives et partenaires qui rendent les données agricoles plus utiles et vérifiables.</p></div>
          <Link className="about-cta about-cta-light" to="/auth/register">Rejoindre la plateforme <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </div>
  );
}
