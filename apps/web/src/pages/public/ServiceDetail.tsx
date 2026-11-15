import { Link, Navigate, useParams } from 'react-router-dom';

import { SERVICE_CATALOG } from '@/lib/service-catalog';
import { useI18n } from '@/i18n';

export default function ServiceDetail() {
  const { t } = useI18n();
  const { serviceId } = useParams();
  const service = SERVICE_CATALOG.find((item) => item.id === serviceId);
  if (!service) return <Navigate to="/services" replace />;

  return (
    <main className="service-detail-page">
      <Link className="service-detail-close" to="/services" aria-label={t('ui.fermerEtRevenirAuxServices')}>← <span>{t('ui.retourAuxServices')}</span></Link>
      <article className="service-detail-card">
        <div className="service-detail-image-wrap">
          <img src={service.image} alt={service.imageAlt} />
          <span className="service-detail-image-label">{t('ui.agrikonnectAfricaServices')}</span>
        </div>
        <div className="service-detail-copy">
          <span className="services-eyebrow">{t('ui.serviceAgricole')}</span>
          <h1>{service.title}</h1>
          <p className="service-detail-lead">{service.description}</p>
          <h2>{t('ui.ceQueLeServicePermet')}</h2>
          <ul>{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <Link className="service-open-button" to="/services">{t('ui.fermerLeDetail')}{' '}<span aria-hidden="true">×</span></Link>
        </div>
      </article>
    </main>
  );
}
