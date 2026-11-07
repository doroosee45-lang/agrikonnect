/**
 * Matching déterministe et explicable (REQ-02 / CDC V2 §8.5).
 *
 * Aucun score opaque : chaque correspondance liste les critères satisfaits
 * et manquants, puis un tri explicite (nombre de critères RÉPONDUS, vérification
 * du vendeur, fraîcheur). Le classement est affiché à l'utilisateur.
 */

/** Distance approximative en km entre deux points (Haversine). */
const distanceKm = (a, b) => {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

/**
 * Évalue une annonce face à une demande d'achat.
 * @returns {{ criteria: object[], matched: number, total: number, rank: object }}
 */
export const matchListingToRequest = (listing, request, { minVolumeRatio = 0.25, maxDistanceKm = 300 } = {}) => {
  const criteria = [];

  // 1. Produit
  criteria.push({
    key: 'product',
    label: 'Même culture',
    satisfied: listing.cropId && listing.cropId === request.cropId,
    detail: listing.cropId === request.cropId ? null : 'Culture différente',
  });

  // 2. Volume (une offre partielle est acceptée au-delà du seuil paramétrable)
  const ratio = Number(listing.quantity) / Number(request.quantity || 1);
  criteria.push({
    key: 'volume',
    label: `Volume ≥ ${Math.round(minVolumeRatio * 100)} % de la demande`,
    satisfied: ratio >= minVolumeRatio,
    detail: `Disponible : ${listing.quantity} ${listing.unit} — demandé : ${request.quantity} ${request.unit} (${Math.round(ratio * 100)} %)`,
  });

  // 3. Zone : même province, ou rayon paramétrable
  const sameProvince = Boolean(
    listing.province && request.deliveryProvince && listing.province === request.deliveryProvince,
  );
  const city = request.deliveryProvince && !listing.province
    ? null
    : { lat: listing.latitude, lng: listing.longitude };
  const km = city ? distanceKm(city, { lat: request.latitude, lng: request.longitude }) : null;

  criteria.push({
    key: 'zone',
    label: 'Zone de livraison compatible',
    satisfied: sameProvince || (km !== null && km <= maxDistanceKm),
    detail: sameProvince
      ? `Même province (${listing.province})`
      : km !== null
        ? `${km} km (seuil ${maxDistanceKm} km)`
        : 'Zone non déterminable : coordonnées absentes',
  });

  // 4. Disponibilité
  const neededBy = request.neededBy ? new Date(request.neededBy) : null;
  const availableTo = listing.availableTo ? new Date(listing.availableTo) : null;
  criteria.push({
    key: 'availability',
    label: 'Disponibilité compatible avec la date souhaitée',
    satisfied: !neededBy || !availableTo ? true : availableTo >= neededBy,
    detail:
      !neededBy || !availableTo
        ? 'Fenêtre non précisée : à confirmer entre les parties'
        : `Disponible jusqu'au ${availableTo.toISOString().slice(0, 10)}`,
  });

  // 5. Statut
  criteria.push({
    key: 'status',
    label: 'Annonce publiée et vendeur actif',
    satisfied: listing.status === 'PUBLISHED',
    detail: listing.status === 'PUBLISHED' ? null : `Statut : ${listing.status}`,
  });

  // 6. Qualité demandée (si précisée)
  if (request.quality) {
    criteria.push({
      key: 'quality',
      label: 'Qualité demandée',
      satisfied: Boolean(listing.quality) && listing.quality === request.quality,
      detail: listing.quality ? `Qualité annoncée : ${listing.quality}` : 'Qualité non renseignée',
    });
  }

  const matched = criteria.filter((c) => c.satisfied).length;

  return {
    criteria,
    matched,
    total: criteria.length,
    // Tri explicite, communiqué à l'utilisateur (aucun intérêt commercial caché)
    rank: {
      byCriteria: matched,
      verifiedSeller: Boolean(listing.verifiedSeller),
      freshness: listing.updatedAt ?? listing.createdAt ?? null,
    },
    explainingOrder:
      'Tri : nombre de critères satisfaits, puis vendeur vérifié, puis fraîcheur de l\'annonce.',
  };
};
