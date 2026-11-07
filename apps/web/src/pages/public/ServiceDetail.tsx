import { Link, Navigate, useParams } from 'react-router-dom';

import { SERVICE_CATALOG } from '@/lib/service-catalog';

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const service = SERVICE_CATALOG.find((item) => item.id === serviceId);
  if (!service) return <Navigate to="/services" replace />;

  return (
    <main className="service-detail-page">
      <Link className="service-detail-close" to="/services" aria-label="Fermer et revenir aux services">← <span>Retour aux services</span></Link>
      <article className="service-detail-card">
        <div className="service-detail-image-wrap">
          <img src={service.image} alt={service.imageAlt} />
          <span className="service-detail-image-label">AGRIKONNECT AFRICA · SERVICES</span>
        </div>
        <div className="service-detail-copy">
          <span className="services-eyebrow">SERVICE AGRICOLE</span>
          <h1>{service.title}</h1>
          <p className="service-detail-lead">{service.description}</p>
          <h2>Ce que le service permet</h2>
          <ul>{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <Link className="service-open-button" to="/services">Fermer le détail <span aria-hidden="true">×</span></Link>
        </div>
      </article>
    </main>
  );
}
