import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Matrice d'exigences — vérification **par identifiant du CDC**.
 *
 * Pourquoi ce script existe : `check:trace` prouve qu'une *famille* a un module,
 * des routes, une permission et un test. Il ne prouve pas que chaque exigence
 * numérotée du cahier des charges (AUTH-07, SOIL-12, PRC-10…) est réellement
 * couverte. Une famille peut être « complète » alors qu'une de ses exigences
 * n'existe nulle part.
 *
 * Règle appliquée ici, sans exception :
 *   - `impl`   : l'identifiant est cité dans `src/` (le code dit où il applique la règle) ;
 *   - `proof`  : l'identifiant est cité dans `tests/` (il existe une preuve exécutable) ;
 *   - `routes` : au moins une route HTTP est exposée par le module porteur.
 *
 * Le script échoue si une exigence n'a pas d'implémentation ou pas de preuve.
 *
 * Usage : `npm run check:reqs` (ou `node scripts/check-requirements.mjs --json`).
 */

const root = fileURLToPath(new URL('..', import.meta.url));

const walk = (directory, filter) => {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(child, filter);
    return filter(child) ? [child] : [];
  });
};

const jsFiles = walk('src', (file) => file.endsWith('.js'));
const testFiles = walk('tests', (file) => file.endsWith('.mjs'));

const srcText = jsFiles.map((file) => ({ file, source: fs.readFileSync(path.join(root, file), 'utf8') }));
const testText = testFiles.map((file) => ({ file, source: fs.readFileSync(path.join(root, file), 'utf8') }));
const routeFiles = jsFiles.filter((file) => file.endsWith('.routes.js'));

/**
 * Catalogue du cahier des charges (v2.0, 18/09/2026) — un identifiant par ligne.
 * `module` indique où la règle doit être appliquée ; `perm` la permission qui la garde.
 */
const REQUIREMENTS = [
  // ─── V1 — socle ───────────────────────────────────────────────────────────
  { id: 'AUTH-01', v: 1, title: 'Inscription et création du profil, de l’organisation et de l’appartenance', module: 'auth' },
  { id: 'AUTH-02', v: 1, title: 'Connexion, verrouillage après échecs répétés', module: 'auth' },
  { id: 'AUTH-03', v: 1, title: 'Code OTP SMS à durée de vie limitée et à usage unique', module: 'auth' },
  { id: 'AUTH-04', v: 1, title: 'Un code faux est refusé et comptabilisé', module: 'auth' },
  { id: 'AUTH-05', v: 1, title: 'Jeton rafraîchissable puis révocable (logout)', module: 'auth' },
  { id: 'AUTH-06', v: 1, title: 'Réinitialisation du mot de passe par lien à usage unique', module: 'auth' },
  { id: 'AUTH-07', v: 1, title: 'Vérification de l’email', module: 'auth' },
  { id: 'PROF-01', v: 1, title: 'Lecture et mise à jour du profil', module: 'users' },
  { id: 'PROF-02', v: 1, title: 'Visibilité champ par champ', module: 'users' },
  { id: 'PROF-03', v: 1, title: 'Préférences de notification du profil', module: 'users' },
  { id: 'PROF-04', v: 1, title: 'Aucune donnée personnelle dans les vues publiques', module: 'public' },
  { id: 'FARM-01', v: 1, title: 'Création d’une exploitation', module: 'farms' },
  { id: 'FARM-02', v: 1, title: 'Mise à jour contrôlée (version) ', module: 'farms' },
  { id: 'FARM-03', v: 1, title: 'Archivage logique, jamais destructif', module: 'farms' },
  { id: 'FARM-04', v: 1, title: 'Publication du profil public par le producteur', module: 'farms' },
  { id: 'PLOT-01', v: 1, title: 'Parcelle géolocalisée avec superficie dérivée', module: 'plots' },
  { id: 'PLOT-02', v: 1, title: 'Historique cultural de la parcelle', module: 'plots' },
  { id: 'PLOT-03', v: 1, title: 'Mise à jour avec verrou optimiste', module: 'plots' },
  { id: 'PLOT-04', v: 1, title: 'Suppression logique de la parcelle', module: 'plots' },
  { id: 'PLOT-05', v: 1, title: 'Coordonnée hors du pays déclaré refusée', module: 'plots' },
  { id: 'CROP-01', v: 1, title: 'Référentiel des cultures consultable', module: 'crops' },
  { id: 'CROP-02', v: 1, title: 'Référentiel alimenté par l’administration seulement', module: 'crops' },
  { id: 'CROP-03', v: 1, title: 'Noms localisés par langue', module: 'crops' },
  { id: 'PROD-01', v: 1, title: 'Déclaration de production rattachée à une exploitation', module: 'productions' },
  { id: 'PROD-02', v: 1, title: 'Conversion en kg conservée avec l’unité d’origine', module: 'productions' },
  { id: 'PROD-03', v: 1, title: 'Statistiques de production par culture et période', module: 'productions' },
  { id: 'PROD-04', v: 1, title: 'Provenance déclarée vs vérifiée', module: 'productions' },
  { id: 'COOP-01', v: 1, title: 'Coopérative rattachée à une organisation', module: 'cooperatives' },
  { id: 'COOP-02', v: 1, title: 'Adhésion d’un membre par email ou téléphone', module: 'cooperatives' },
  { id: 'COOP-03', v: 1, title: 'Import CSV de membres avec essai à blanc', module: 'cooperatives' },
  { id: 'COOP-04', v: 1, title: 'Consentement du membre par périmètre', module: 'cooperatives' },
  { id: 'COOP-05', v: 1, title: 'Vue d’ensemble de la coopérative', module: 'cooperatives' },
  { id: 'PUB-01', v: 1, title: 'Profil public d’une exploitation', module: 'public' },
  { id: 'PUB-02', v: 1, title: 'Ancien slug redirigé (jamais de lien mort)', module: 'public' },
  { id: 'PUB-03', v: 1, title: 'QR du profil public en PNG et SVG', module: 'public' },
  { id: 'PUB-04', v: 1, title: 'Partage social et balises Open Graph', module: 'public' },
  { id: 'PUB-05', v: 1, title: 'Profil non vérifié en noindex', module: 'public' },
  { id: 'PUB-06', v: 1, title: 'Formulaire de contact sans exposition des coordonnées', module: 'public' },
  { id: 'MAP-01', v: 1, title: 'Cartographie publique paginée', module: 'public' },
  { id: 'MAP-02', v: 1, title: 'Filtrage par bbox', module: 'public' },
  { id: 'MAP-03', v: 1, title: 'Filtrage par culture et pays', module: 'public' },
  { id: 'MAP-04', v: 1, title: 'Coordonnées publiques arrondies', module: 'public' },
  { id: 'VER-01', v: 1, title: 'Demande de vérification déposée par le producteur', module: 'verification' },
  { id: 'VER-02', v: 1, title: 'Instruction administrative motivée', module: 'verification' },
  { id: 'VER-03', v: 1, title: 'Provenance affichée séparément (déclaré ≠ vérifié)', module: 'verification' },
  { id: 'VER-04', v: 1, title: 'Aucune note globale de confiance', module: 'verification' },
  { id: 'VER-05', v: 1, title: 'Décision tracée et auditable', module: 'verification' },
  { id: 'SOIL-01', v: 1, title: 'Relevé de sol daté, avec paramètres', module: 'soil' },
  { id: 'SOIL-02', v: 1, title: 'Rapport de laboratoire rattaché', module: 'soil' },
  { id: 'SOIL-03', v: 1, title: 'S1 : aucun conseil automatique', module: 'soil' },
  { id: 'SEC-01', v: 1, title: 'Limitation de débit sur l’authentification', module: 'middleware' },
  { id: 'SEC-02', v: 1, title: 'Jeton absent ou invalide rejeté', module: 'middleware' },
  { id: 'SEC-03', v: 1, title: 'Autorisation à quatre couches (rôle, permission, tenant, ressource)', module: 'middleware' },
  { id: 'SEC-04', v: 1, title: 'Isolation stricte entre tenants', module: 'middleware' },
  { id: 'SEC-05', v: 1, title: 'Injection SQL neutralisée (requêtes paramétrées)', module: 'shared' },
  { id: 'SEC-06', v: 1, title: 'En-têtes de sécurité HTTP', module: 'middleware' },
  { id: 'SEC-07', v: 1, title: 'CORS restreint aux origines déclarées', module: 'middleware' },
  { id: 'SEC-08', v: 1, title: 'Corps de requête borné (413)', module: 'middleware' },
  { id: 'SEC-09', v: 1, title: 'Secrets et clés jamais stockés en clair', module: 'shared' },
  { id: 'SEC-10', v: 1, title: 'Journal d’audit append-only', module: 'shared' },
  { id: 'SEC-11', v: 1, title: 'Aucune donnée sensible dans les journaux', module: 'middleware' },
  { id: 'SEC-12', v: 1, title: 'Idempotence des écritures sensibles', module: 'middleware' },
  { id: 'NFR-01', v: 1, title: 'MFA TOTP obligatoire pour les accès sensibles', module: 'auth' },
  { id: 'NFR-02', v: 1, title: 'Pagination bornée et curseur', module: 'shared' },
  { id: 'NFR-03', v: 1, title: 'Transactions pour les écritures multi-tables', module: 'shared' },
  { id: 'NFR-04', v: 1, title: 'Pas de survente sous concurrence', module: 'market' },
  { id: 'NFR-05', v: 1, title: 'Journalisation structurée avec identifiant de requête', module: 'shared' },
  { id: 'NFR-06', v: 1, title: 'Surveillance des tâches planifiées', module: 'jobs' },
  { id: 'NFR-07', v: 1, title: 'Temps réel en lecture seule', module: 'realtime' },
  { id: 'I18N-01', v: 1, title: 'Français comme langue de référence', module: 'shared' },
  { id: 'I18N-02', v: 1, title: 'Messages d’erreur localisés', module: 'shared' },
  { id: 'I18N-03', v: 1, title: 'Unités et devises explicites', module: 'shared' },

  // ─── V2 — marché ──────────────────────────────────────────────────────────
  { id: 'MKT-01', v: 2, title: 'Annonce invisible avant publication', module: 'market/listings' },
  { id: 'MKT-02', v: 2, title: 'Vente plafonnée par le stock annoncé', module: 'market/listings' },
  { id: 'MKT-03', v: 2, title: 'Recherche par culture, prix, zone, certification', module: 'market/listings' },
  { id: 'MKT-04', v: 2, title: 'Cycle de vie contrôlé et expiration', module: 'market/listings' },
  { id: 'MKT-05', v: 2, title: 'Modération motivée et tracée', module: 'market/listings' },
  { id: 'MKT-06', v: 2, title: 'Contacter un vendeur sans exposer ses coordonnées', module: 'market/listings' },
  { id: 'REQ-01', v: 2, title: 'Demande d’achat sans divulgation des coordonnées', module: 'market/requests' },
  { id: 'REQ-02', v: 2, title: 'Critères de la demande structurés', module: 'market/requests' },
  { id: 'REQ-03', v: 2, title: 'Producteurs compatibles notifiés sans spam', module: 'market/requests' },
  { id: 'REQ-04', v: 2, title: 'Offre chiffrée, datée, opposable', module: 'market/offers' },
  { id: 'REQ-05', v: 2, title: 'Matching explicable, jamais un score opaque', module: 'market/requests' },
  { id: 'OFF-01', v: 2, title: 'Offre émise par un producteur compatible', module: 'market/offers' },
  { id: 'OFF-02', v: 2, title: 'Validité datée de l’offre', module: 'market/offers' },
  { id: 'OFF-03', v: 2, title: 'Acceptation transforme l’offre en commande', module: 'market/offers' },
  { id: 'OFF-04', v: 2, title: 'Retrait possible avant décision', module: 'market/offers' },
  { id: 'ORD-01', v: 2, title: 'Création idempotente', module: 'market/orders' },
  { id: 'ORD-02', v: 2, title: 'Conditions figées dans un instantané', module: 'market/orders' },
  { id: 'ORD-03', v: 2, title: 'Machine à états stricte, par rôle et par état', module: 'market/orders' },
  { id: 'ORD-04', v: 2, title: 'Aucun paiement opéré par la plateforme', module: 'market/orders' },
  { id: 'ORD-05', v: 2, title: 'Litige ouvert, instruit et arbitré', module: 'market/orders' },
  { id: 'STK-01', v: 2, title: 'Stock dérivé des mouvements, jamais un solde', module: 'market/inventory' },
  { id: 'STK-02', v: 2, title: 'Pas de stock négatif', module: 'market/inventory' },
  { id: 'TRP-01', v: 2, title: 'Transport lié à une commande, offres, preuve de livraison', module: 'transport' },
  { id: 'TRA-01', v: 2, title: 'Transport rattaché à une commande', module: 'transport' },
  { id: 'TRA-02', v: 2, title: 'Distance approximative, libellés seuls', module: 'transport' },
  { id: 'TRA-03', v: 2, title: 'Pas de livraison sans preuve', module: 'transport' },
  { id: 'MSG-01', v: 2, title: 'Messagerie rattachée à un dossier métier', module: 'messaging' },
  { id: 'MSG-02', v: 2, title: 'Fil inaccessible à un tiers', module: 'messaging' },
  { id: 'MSG-03', v: 2, title: 'Signalement conservé pour la modération', module: 'messaging' },
  { id: 'MSG-04', v: 2, title: 'Notification temps réel sans polling', module: 'messaging' },
  { id: 'NOTIF-01', v: 2, title: 'Notification in-app et e-mail', module: 'notifications' },
  { id: 'NOTIF-02', v: 2, title: 'Aucun doublon (clé de déduplication)', module: 'notifications' },
  { id: 'NOTIF-03', v: 2, title: 'Préférences par type et par canal', module: 'notifications' },
  { id: 'NOTIF-04', v: 2, title: 'Purge selon la durée de conservation', module: 'notifications' },
  { id: 'BIL-01', v: 2, title: 'Numérotation séquentielle par organisation et facture PDF', module: 'billing' },
  { id: 'BIL-02', v: 2, title: 'Conversion uniquement avec un taux daté et sourcé', module: 'billing' },
  { id: 'REV-01', v: 2, title: 'Avis seulement après livraison', module: 'market/reviews' },
  { id: 'REV-02', v: 2, title: 'Réputation = moyenne et volume', module: 'market/reviews' },
  { id: 'REV-03', v: 2, title: 'Aucune note inventée sans avis', module: 'market/reviews' },
  { id: 'DISP-01', v: 2, title: 'Litige tracé avec preuves', module: 'market/orders' },
  { id: 'DISP-02', v: 2, title: 'Décision de modération conservée', module: 'market/orders' },
  { id: 'MOD-01', v: 2, title: 'Modération d’annonce motivée', module: 'market/listings' },
  { id: 'MOD-02', v: 2, title: 'Modération d’avis sans destruction de preuve', module: 'market/reviews' },
  { id: 'COOP-10', v: 2, title: 'Offre groupée avec répartition traçable', module: 'cooperatives' },
  { id: 'SOIL-04', v: 2, title: 'Règles agronomiques versionnées et validées par un tiers', module: 'soil' },
  { id: 'SOIL-05', v: 2, title: 'Compatibilité culture à quatre niveaux', module: 'soil' },
  { id: 'SOIL-06', v: 2, title: 'Rotation pluriannuelle proposée puis statuée', module: 'soil' },
  { id: 'SOIL-07', v: 2, title: 'Plan agricole issu du calendrier validé', module: 'soil' },
  { id: 'SOIL-08', v: 2, title: 'Réponse « pourquoi ? » sourcée', module: 'soil' },
  { id: 'SOIL-09', v: 2, title: 'Aucune conclusion sans données', module: 'soil' },

  // ─── V3 — intelligence ────────────────────────────────────────────────────
  { id: 'SYNC-01', v: 3, title: 'Travail hors-ligne rejouable', module: 'sync' },
  { id: 'SYNC-02', v: 3, title: 'Idempotence par opération', module: 'sync' },
  { id: 'SYNC-03', v: 3, title: 'Conflits détectés, jamais écrasés', module: 'sync' },
  { id: 'SYNC-04', v: 3, title: 'Rapport de conflits consultable', module: 'sync' },
  { id: 'SYNC-05', v: 3, title: 'Pull incrémental par curseur', module: 'sync' },
  { id: 'AI-01', v: 3, title: 'Consentement avant analyse d’image', module: 'ai' },
  { id: 'AI-02', v: 3, title: 'Toute sortie porte un avertissement', module: 'ai' },
  { id: 'AI-03', v: 3, title: 'Confiance affichée, jamais implicite', module: 'ai' },
  { id: 'AI-04', v: 3, title: 'Version de prompt et de modèle traçables', module: 'ai' },
  { id: 'AI-05', v: 3, title: 'Escalade humaine possible', module: 'ai' },
  { id: 'AI-06', v: 3, title: 'Quotas anti-abus', module: 'ai' },
  { id: 'AI-10', v: 3, title: 'Copilote ancré sur les données et documents en brouillon', module: 'ai' },
  { id: 'WX-01', v: 3, title: 'Météo sourcée et horodatée, alertes contextualisées à la culture', module: 'weather' },
  { id: 'WEA-01', v: 3, title: 'Aucune météo inventée', module: 'weather' },
  { id: 'WEA-02', v: 3, title: 'Donnée météo datée et sourcée', module: 'weather' },
  { id: 'WEA-03', v: 3, title: 'Alertes météo explicables', module: 'weather' },
  { id: 'PRC-01', v: 3, title: 'Prix agricoles : produit, marché, date, devise, unité, source', module: 'prices' },
  { id: 'PRC-02', v: 3, title: 'Aucun prix universel : zone et date toujours visibles', module: 'prices' },
  { id: 'PRC-03', v: 3, title: 'Sources distinctes, jamais mélangées sans étiquette', module: 'prices' },
  { id: 'PRI-01', v: 3, title: 'Chaque prix est daté et sourcé', module: 'prices' },
  { id: 'PRI-02', v: 3, title: 'Série de prix avec méthode affichée', module: 'prices' },
  { id: 'PRI-03', v: 3, title: 'Marchés sans relevé signalés', module: 'prices' },
  { id: 'TRC-01', v: 3, title: 'Lot traçable avec code normalisé', module: 'traceability' },
  { id: 'TRC-02', v: 3, title: 'Journal de lot append-only et rappel', module: 'traceability' },
  { id: 'TRC-03', v: 3, title: 'Page publique de lot limitée aux champs publiés', module: 'public' },
  { id: 'CERT-01', v: 3, title: 'Déclaré n’est pas vérifié', module: 'certifications' },
  { id: 'CERT-02', v: 3, title: 'Vérification réservée à l’administration', module: 'certifications' },
  { id: 'CERT-03', v: 3, title: 'Expiration prise en compte partout', module: 'certifications' },
  { id: 'IOT-01', v: 3, title: 'Clé d’appareil hachée, affichée une fois', module: 'iot' },
  { id: 'IOT-02', v: 3, title: 'Clé révocable et rotative', module: 'iot' },
  { id: 'IOT-03', v: 3, title: 'Seuils vers alertes, aucune action automatique', module: 'iot' },
  { id: 'IOT-04', v: 3, title: 'Mesures non interpolées (trous signalés)', module: 'iot' },
  { id: 'GEO-01', v: 3, title: 'Données satellite, drone et laboratoire rattachées à la parcelle', module: 'geodata' },
  { id: 'DRN-01', v: 3, title: 'Levé drone rattaché à la parcelle par un opérateur déclaré', module: 'geodata' },
  { id: 'GEO-02', v: 3, title: 'Provenance distincte par source', module: 'geodata' },
  { id: 'GEO-03', v: 3, title: 'Écriture laboratoire réservée au partenaire', module: 'geodata' },
  { id: 'USSD-01', v: 3, title: 'Canal USSD pas à pas, sans état opérateur', module: 'channels' },
  { id: 'WA-01', v: 3, title: 'Webhook WhatsApp signé', module: 'channels' },
  { id: 'SOIL-10', v: 3, title: 'Fusion multi-sources, priorité laboratoire', module: 'soil' },
  { id: 'SOIL-11', v: 3, title: 'Capteur puis satellite puis photo puis déclaré', module: 'soil' },
  { id: 'SOIL-12', v: 3, title: 'Valeurs concurrentes conservées en alternatives', module: 'soil' },
  { id: 'SOIL-13', v: 3, title: 'Profil de sol fusionné exposé', module: 'soil' },
  { id: 'SOIL-14', v: 3, title: 'Rendement en fourchette avec incertitude', module: 'soil' },

  // ─── V4 — investissement ──────────────────────────────────────────────────
  { id: 'PRJ-01', v: 4, title: 'Projet public seulement après revue', module: 'projects' },
  { id: 'PRJ-02', v: 4, title: 'Provenance champ par champ', module: 'projects' },
  { id: 'PRJ-03', v: 4, title: 'Pas d’auto-vérification', module: 'projects' },
  { id: 'PRJ-04', v: 4, title: 'Aucune promesse de rendement', module: 'projects' },
  { id: 'PRJ-05', v: 4, title: 'Revue administrative motivée', module: 'projects' },
  { id: 'INV-01', v: 4, title: 'Profil investisseur vérifié', module: 'investors' },
  { id: 'INV-02', v: 4, title: 'MFA obligatoire pour les données sensibles', module: 'investors' },
  { id: 'INV-03', v: 4, title: 'Accès data room conditionné à la vérification', module: 'investors' },
  { id: 'DR-01', v: 4, title: 'Data room fermée par défaut', module: 'dataroom' },
  { id: 'DR-02', v: 4, title: 'Demande d’accès justifiée et bornée', module: 'dataroom' },
  { id: 'DR-03', v: 4, title: 'Décision du porteur avec expiration', module: 'dataroom' },
  { id: 'DR-04', v: 4, title: 'Téléchargement désactivé par défaut', module: 'dataroom' },
  { id: 'DR-05', v: 4, title: 'Journal d’accès append-only', module: 'dataroom' },
  { id: 'DD-01', v: 4, title: 'Checklist de due diligence structurée', module: 'duediligence' },
  { id: 'DD-02', v: 4, title: 'Vérification professionnelle nominative', module: 'duediligence' },
  { id: 'DD-03', v: 4, title: 'Due diligence jamais publique', module: 'duediligence' },
  { id: 'RPT-01', v: 4, title: 'Rapports horodatés par le serveur', module: 'reporting' },
  { id: 'RPT-02', v: 4, title: 'Impact avec source par indicateur', module: 'reporting' },
  { id: 'RPT-03', v: 4, title: 'Aucune réécriture d’un rapport publié', module: 'reporting' },
  { id: 'FUND-01', v: 4, title: 'Consentement préalable matérialisé', module: 'funding' },
  { id: 'FUND-02', v: 4, title: 'Transmission impossible sans consentement', module: 'funding' },
  { id: 'FUND-03', v: 4, title: 'Aucune activité financière régulée', module: 'funding' },
  { id: 'SOIL-15', v: 4, title: 'Zonage de parcelle et recommandations par zone (bonne / moyenne / problème)', module: 'precision' },
  { id: 'PREC-01', v: 4, title: 'Zones de gestion versionnées et sourcées', module: 'precision' },
  { id: 'PREC-02', v: 4, title: 'Aucune zone sans données', module: 'precision' },
  { id: 'PREC-03', v: 4, title: 'Rapport non validé par défaut', module: 'precision' },

  // ─── V5 — global ──────────────────────────────────────────────────────────
  { id: 'GLB-01', v: 5, title: 'Référentiel pays, devises, unités', module: 'countries' },
  { id: 'GLB-02', v: 5, title: 'Profils de conformité par pays', module: 'countries' },
  { id: 'GLB-03', v: 5, title: 'Taux de change datés et sourcés', module: 'countries' },
  { id: 'GLB-04', v: 5, title: 'Endpoints publics normalisés (/agriculture, /regions, /crops…)', module: 'publicapi' },
  { id: 'PRC-10', v: 5, title: 'Appels d’offres avec réponses scellées', module: 'tenders' },
  { id: 'EXP-01', v: 5, title: 'Incoterm contrôlé', module: 'exports' },
  { id: 'EXP-02', v: 5, title: 'Taux de change daté pour l’export', module: 'exports' },
  { id: 'EXP-03', v: 5, title: 'Certification impossible sans documents', module: 'exports' },
  { id: 'API-01', v: 5, title: 'Clé hachée, affichée une seule fois', module: 'apiclients' },
  { id: 'API-02', v: 5, title: 'Clé révocable et expirable', module: 'apiclients' },
  { id: 'API-03', v: 5, title: 'Finalité approuvée avant usage', module: 'apiclients' },
  { id: 'API-04', v: 5, title: 'Quota et journal d’usage', module: 'apiclients' },
  { id: 'DATA-01', v: 5, title: 'Produits de données publiables seulement si conformes', module: 'dataproducts' },
  { id: 'DATA-02', v: 5, title: 'k-anonymat strict dans les agrégats', module: 'dataproducts' },
  { id: 'DATA-03', v: 5, title: 'Composition et version de règle exposées', module: 'dataproducts' },
  { id: 'DATA-04', v: 5, title: 'Contrat de données obligatoire', module: 'publicapi' },
  { id: 'DATA-10', v: 5, title: 'Non-ré-identification (ni min, ni max, ni liste)', module: 'dataproducts' },
  { id: 'INS-01', v: 5, title: 'Indicateurs pays tracés (source, méthode, date)', module: 'insights' },
  { id: 'INS-02', v: 5, title: 'k-anonymat appliqué aux agrégats pays', module: 'insights' },
  { id: 'INS-03', v: 5, title: 'Aucune donnée personnelle dans l’observatoire', module: 'insights' },
  { id: 'SOIL-16', v: 5, title: 'Statistiques de sol agrégées, k ≥ 10', module: 'public' },
  // ─── Compléments : identifiants cités par le code comme relevant du CDC ───
  { id: 'BIL-03', v: 2, title: 'Numérotation séquentielle par organisation et par type, sans trou', module: 'billing' },
  { id: 'BIL-04', v: 2, title: 'Règlement déclaratif hors plateforme, aucun fonds détenu', module: 'billing' },
  { id: 'AI-07', v: 3, title: 'Revue experte d’une analyse IA : annotation humaine, sortie machine inchangée', module: 'ai' },
  { id: 'CERT-04', v: 3, title: 'Certifications fiables d’une organisation, séparées du déclaratif', module: 'certifications' },
  { id: 'NFR-08', v: 3, title: 'Jeu de règles agronomiques opposable seulement après validation par un tiers', module: 'soil' },
  { id: 'NFR-09', v: 3, title: 'Minimisation des données transmises à l’IA, consentement explicite', module: 'ai' },
  { id: 'NFR-10', v: 3, title: 'Disponibilité 99,5 % : dégradation explicite, aucun diagnostic de substitution', module: 'integrations' },
  { id: 'NFR-11', v: 1, title: 'Logs structurés avec identifiant de corrélation', module: 'shared' },
  { id: 'FX-01', v: 5, title: 'Cotation datée et sourcée, jamais implicite', module: 'countries' },
  { id: 'FX-02', v: 5, title: 'Cotation refusée si future ou non strictement positive', module: 'countries' },
  { id: 'FX-03', v: 5, title: 'Enregistrement de cotation idempotent sur (base, quote, asOf)', module: 'countries' },
];

/** Citations d'un identifiant dans un corpus de fichiers. */
const citations = (corpus, id) => {
  const pattern = new RegExp(`\\b${id}\\b`);
  return corpus.filter(({ source }) => pattern.test(source)).map(({ file }) => file);
};

/**
 * Modules transverses : ils n'exposent pas de routes propres (helpers, config,
 * middlewares, tâches). L'exigence de fichier de routes ne s'y applique pas.
 */
const TRANSVERSAL_MODULES = new Set([
  'shared',
  'config',
  'middleware',
  'jobs',
  'integrations',
  'realtime',
  'app',
  'db',
]);


/**
 * Alias et sous-cas d'identifiants.
 *
 * Le CDC numérote certaines familles de deux façons (REP/RPT, PRE/PREC, TEN/PRC,
 * LOT/TRC) et certains tests nomment un **sous-cas** plutôt qu'une exigence
 * (« MFA-01 (NFR-01) »). Ces étiquettes ne sont pas des exigences
 * supplémentaires : chacune renvoie à l'exigence canonique qui la porte et à sa
 * preuve. Ce tableau existe pour qu'aucun identifiant cité dans le dépôt ne
 * puisse rester orphelin sans que la matrice le signale.
 */
const ALIASES = [
  ['MFA-01', 'NFR-01', 'TOTP conforme RFC 6238, secret jamais stocké en clair'],
  ['MFA-02', 'NFR-01', 'Code faux refusé, code de secours à usage unique'],
  ['MFA-03', 'NFR-01', 'Opération sensible refusée sans enrôlement'],
  ['MFA-04', 'NFR-01', 'Aucune clé de chiffrement TOTP par défaut en production (SEC-08)'],
  ['PRI-01', 'PRC-01', 'Prix daté et sourcé (identifiant interne du module prices)'],
  ['PRI-02', 'PRC-02', 'Série de prix avec méthode et échantillon'],
  ['PRI-03', 'PRC-03', 'Marché sans relevé récent signalé, jamais interpolé'],
  ['WEA-02', 'WX-01', 'Donnée météo datée et sourcée'],
  ['WEA-03', 'WX-01', 'Alertes météo explicables'],
  ['TRA-02', 'TRP-01', 'Distance approximative, libellés seuls'],
  ['TRA-03', 'TRP-01', 'Pas de livraison sans preuve'],
  ['PREC-02', 'SOIL-15', 'Aucune zone sans données'],
  ['PREC-03', 'SOIL-15', 'Rapport de précision non validé par défaut'],
  ['COOPG-01', 'COOP-10', 'Seules les productions des membres consentants sont agrégées'],
  ['COOPG-02', 'COOP-10', 'Répartition figée et traçable de l’offre groupée'],
  ['COOPG-03', 'COOP-10', 'Confirmation de l’offre groupée'],
  ['INVH-01', 'INV-03', 'Matching investisseur explicable, sans score'],
  ['INVH-02', 'INV-02', 'Suivre / ne plus suivre un projet de façon idempotente'],
  ['INVH-03', 'PRJ-04', 'Mise en relation sans coordonnées avant acceptation'],
  ['INVH-04', 'PRJ-04', 'Seul le porteur du projet statue sur une mise en relation'],
  ['API-05', 'DATA-10', 'API publique : régions sous le k-anonymat retirées'],
  ['API-06', 'DATA-10', '/farmers refuse de publier sous le seuil de k-anonymat'],
  ['API-07', 'API-02', '/market-prices conserve date et source de chaque prix'],
  ['TND-01', 'PRC-10', 'On ne répond pas à son propre appel d’offres'],
  ['TRACE-01', 'TRC-02', 'Un lot rappelé refuse tout nouvel événement'],
  ['LOT-01', 'TRC-01', 'Journal de lot append-only'],
  ['LOT-02', 'TRC-02', 'Lot rappelable, statut terminal'],
  ['LOT-03', 'TRC-01', 'Vue publique limitée aux champs publiés'],
  ['LOT-04', 'TRC-01', 'Champs sensibles non publiables'],
  ['REP-01', 'RPT-01', 'Rapport d’avancement'],
  ['REP-02', 'RPT-02', 'Rapport d’impact avec provenance par indicateur'],
  ['REP-03', 'RPT-03', 'Rapport publié immuable et consolidé'],
  ['PRE-01', 'PREC-01', 'Zones de management calculées depuis des sources datées'],
  ['PRE-02', 'PREC-02', 'Aucune zone sans donnée : refus explicite'],
  ['PRE-03', 'PREC-03', 'Validation humaine d’un rapport de précision'],
  ['TEN-01', 'PRC-10', 'Appel d’offres publié, réponse scellée'],
  ['TEN-02', 'PRC-10', 'Réponse non modifiable après dépôt'],
  ['TEN-03', 'PRC-10', 'Adjudication : une réponse retenue, les autres rejetées'],
];

const results = REQUIREMENTS.map((requirement) => {
  const impl = citations(srcText, requirement.id);
  const proof = citations(testText, requirement.id);
  const moduleRoutes = routeFiles.filter((file) => file.includes(`modules/${requirement.module}/`));
  const gaps = [];
  if (impl.length === 0) gaps.push('aucune implémentation citant l’identifiant');
  if (proof.length === 0) gaps.push('aucune preuve de test citant l’identifiant');
  if (moduleRoutes.length === 0 && !TRANSVERSAL_MODULES.has(requirement.module)) {
    gaps.push('aucun fichier de routes dans le module');
  }

  return {
    ...requirement,
    impl: impl.slice(0, 3),
    proof: proof.slice(0, 3),
    routes: moduleRoutes.length,
    gaps,
  };
});


/* ─── Garde-fou : aucun identifiant cité dans le dépôt ne doit être orphelin ─── */
const catalogued = new Set([...REQUIREMENTS.map((r) => r.id), ...ALIASES.map(([alias]) => alias)]);
const corpus = [
  ...srcText,
  ...testText,
  ...['README.md', 'docs/API.md', 'docs/ACCEPTANCE.md']
    .map((file) => path.join(root, file))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ file: path.relative(root, file), source: fs.readFileSync(file, 'utf8') })),
];
const seen = new Map();
for (const { file, source } of corpus) {
  for (const match of source.matchAll(/(^|[^A-Z0-9])([A-Z]{2,5}-[0-9]{2})\b/g)) {
    const id = match[2];
    if (!seen.has(id)) seen.set(id, new Set());
    seen.get(id).add(file);
  }
}
const orphans = [...seen.entries()].filter(([id]) => !catalogued.has(id)).map(([id, files]) => ({ id, files: [...files] }));

const total = results.length;
const covered = results.filter((r) => r.gaps.length === 0).length;
const byVersion = [1, 2, 3, 4, 5].map((version) => {
  const list = results.filter((r) => r.v === version);
  return { version, total: list.length, covered: list.filter((r) => r.gaps.length === 0).length };
});

const mdIndex = process.argv.indexOf('--md');
const mdPath = mdIndex > -1 ? process.argv[mdIndex + 1] : null;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, covered, byVersion, results }, null, 2));
} else {
  const lines = [
    '# Matrice de traçabilité CDC → code → preuve',
    '',
    `> Généré par \`npm run docs:requirements\` — **${covered}/${total}** exigences couvertes.`,
    '',
    '| Version | Exigences | Couvertes |',
    '|---|---|---|',
    ...byVersion.map((v) => `| V${v.version} | ${v.total} | ${v.covered} |`),
    '',
    '',
    ...(orphans.length
      ? ['## Identifiants non catalogués', '', '| Réf. | Fichiers |', '|---|---|', ...orphans.map((o) => `| ${o.id} | ${o.files.slice(0, 3).join(', ')} |`), '']
      : []),
    '## Alias et sous-cas', '',
    '| Alias | Exigence canonique | Portée |', '|---|---|---|',
    ...ALIASES.map(([alias, canonical, note]) => `| ${alias} | ${canonical} | ${note} |`),
    '',
    '| Réf. | V | Exigence | Implémentation | Preuve | État |',
    '|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | V${r.v} | ${r.title} | ${r.impl[0] ? `\`${r.impl[0]}\`` : '—'} | ${
          r.proof[0] ? `\`${r.proof[0]}\`` : '—'
        } | ${r.gaps.length === 0 ? '✅' : `⚠️ ${r.gaps.join(' ; ')}`} |`,
    ),
  ];
  if (mdPath) {
    const target = path.join(root, mdPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${lines.join('\n')}\n`);
    console.error(`Matrice écrite : ${mdPath} (${covered}/${total} exigences)`);
  } else {
    console.log(lines.join('\n'));
  }
  console.error(`\n${covered}/${total} exigences couvertes.`);
  if (orphans.length) console.error(`Identifiants non catalogués : ${orphans.map((o) => o.id).join(', ')}`);
  if (covered !== total) {
    console.error('Écarts :');
    for (const result of results.filter((r) => r.gaps.length)) {
      console.error(`  ✗ ${result.id} — ${result.gaps.join(' ; ')}`);
    }
  }
}

process.exit(covered === total && orphans.length === 0 ? 0 : 1);
