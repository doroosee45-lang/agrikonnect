/**
 * Rapporteur `node --test` pour GitHub Actions : chaque test en échec devient
 * une annotation `::error` (fichier, ligne, nom du test, message), visible
 * dans la PR sans ouvrir les journaux. N'affecte ni l'exécution ni le code
 * de sortie : utilisé EN PLUS du rapporteur habituel (voir .github/workflows/ci.yml).
 */
const propriete = (v) => String(v)
  .replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  .replace(/:/g, '%3A').replace(/,/g, '%2C');
const donnee = (v) => String(v).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const cheminRelatif = (file) => String(file ?? '')
  .replace(/^file:\/+/, '')
  .split('\\').join('/')
  .replace(/^.*?\/backend\//, 'backend/');

export default async function* reporterAnnotationsGithub(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const { name, file, line, details } = event.data;
    const erreur = details?.error?.cause ?? details?.error;
    // Les échecs « de fichier » couvrent aussi les erreurs de chargement (import, environnement).
    const message = String(erreur?.message ?? erreur ?? 'échec').slice(0, 1500);
    yield `::error file=${propriete(cheminRelatif(file))},line=${line ?? 1},title=${propriete(name).slice(0, 200)}::${donnee(message)}\n`;
  }
}
