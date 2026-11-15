import { Link } from 'react-router-dom';

import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { HOME_SLIDES } from './homeSlides';

import { Reveal } from '@/components/ui/Reveal';
import { SERVICE_CATALOG, SERVICE_DOMAINS } from '@/lib/service-catalog';
import { useI18n } from '@/i18n';

export default function Services() {
  const { t } = useI18n();
  return (
    <div className="public-home services-page">
      <HeroCarousel slides={HOME_SLIDES} height={520} intervalMs={5000} className="home-hero" />

      <section id="catalogue-services" className="services-catalogue">
        <div className="services-section-heading">
          <span className="services-eyebrow">{t('common.appName')}</span>
          <h1>{t('ui.lesServicesDeLaPlateforme')}</h1>
          <p>{t('ui.desOutilsConnectesPourInspecterLes')}</p>
        </div>

        <div className="services-grid">
          {SERVICE_CATALOG.map((service, index) => (
            <Reveal key={service.id}>
              <article className="service-card">
                <div className="service-card-photo">
                  <img src={service.image} alt={service.imageAlt} loading="lazy" decoding="async" />
                  <span className="service-card-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="service-photo-content">
                    <h2 className="service-photo-title">{service.title}</h2>
                    <p className="service-photo-summary">{service.summary}</p>
                    <Link className="service-open-button" to={`/services/${service.id}`}>{t('ui.ouvrir')}{' '}<span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="domaines" className="services-domains">
        <div className="services-section-heading">
          <span className="services-eyebrow">{t('ui.perimetreComplet')}</span>
          <h2>{t('ui.unePlateformePourTouteLaChaine')}</h2>
          <p>{t('ui.lesServicesSAppuientSurDes')}</p>
        </div>
        <div className="services-domain-grid">
          {SERVICE_DOMAINS.map((domain, index) => (
            <Reveal key={domain.title} delay={index * 65}>
              <article className="services-domain-card">
                <span className="services-domain-letter">{String.fromCharCode(65 + index)}</span>
                <div className="services-domain-copy">
                  <span className="services-domain-index">{t('ui.domainIndex', { value: String(index + 1).padStart(2, '0') })}</span>
                  <h3>{domain.title}</h3>
                  <p>{domain.text}</p>
                </div>
                <span className="services-domain-arrow" aria-hidden="true">↗</span>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}


