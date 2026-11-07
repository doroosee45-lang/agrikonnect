/**
 * Slug lisible et unique pour les profils publics (PUB-02).
 * ex. "Ferme Espoir Kongo" → "ferme-espoir-kongo"
 */
export const slugify = (input) =>
  String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'profil';

/**
 * Trouve un slug disponible en ajoutant un suffixe numérique.
 * `exists` est une fonction async (slug) => boolean fournie par le service.
 */
export const uniqueSlug = async (base, exists) => {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${root}-${i}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
};
