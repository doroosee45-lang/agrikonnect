import { tr } from '@/i18n';
/**
 * Questions fréquentes.
 *
 * Chaque réponse décrit le comportement réel de la plateforme (routage,
 * règles de publication, k-anonymat, politique de contacts). Aucune réponse ne
 * promet une fonctionnalité absente du backend.
 */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Rubrique de classement (page FAQ complète). */
  topic: 'Données' | 'Comptes' | 'Échanges' | 'Technique';
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'provenance',
    topic: 'Données',
    get question() { return tr('ui.commentSavoirSiUnChiffreEst'); },
    get answer() { return tr('ui.chaqueValeurPorteUnMarqueurPour'); },
  },
  {
    id: 'verification',
    topic: 'Données',
    get question() { return tr('ui.queSignifieExactementVerifie'); },
    get answer() { return tr('ui.verifieParAgrikonnectSignifieQuUn'); },
  },
  {
    id: 'carte',
    topic: 'Données',
    get question() { return tr('ui.lesPositionsAfficheesSurLaCarte'); },
    get answer() { return tr('ui.nonVolontairementLesCoordonneesPublieesSont'); },
  },
  {
    id: 'statistiques',
    topic: 'Données',
    get question() { return tr('ui.commentSontCalculeesLesStatistiquesDe'); },
    get answer() { return tr('ui.ceSontDesMoyennesDeParametres'); },
  },
  {
    id: 'prix',
    topic: 'Données',
    get question() { return tr('ui.dOuViennentLesPrixDe'); },
    get answer() { return tr('ui.deRelevesDatesSaisisParDes'); },
  },
  {
    id: 'contacts',
    topic: 'Comptes',
    get question() { return tr('ui.pourquoiLesCoordonneesDesProducteursSont'); },
    get answer() { return tr('ui.parDefautTelephoneWhatsappEtE'); },
  },
  {
    id: 'compte',
    topic: 'Comptes',
    get question() { return tr('ui.fautIlUnComptePourConsulter'); },
    get answer() { return tr('ui.nonPourLesPagesPubliquesCarte'); },
  },
  {
    id: 'roles',
    topic: 'Comptes',
    get question() { return tr('ui.puisJeCreerUnCompteAdministrateur'); },
    get answer() { return tr('ui.nonLInscriptionEnLibreService'); },
  },
  {
    id: 'mfa',
    topic: 'Comptes',
    get question() { return tr('ui.laDoubleAuthentificationEstElleObligatoire'); },
    get answer() { return tr('ui.elleEstDisponiblePourTousLes'); },
  },
  {
    id: 'messagerie',
    topic: 'Échanges',
    get question() { return tr('ui.commentContacterUnVendeurSansConnaitre'); },
    get answer() { return tr('ui.depuisUneAnnonceLeBoutonDe'); },
  },
  {
    id: 'commande',
    topic: 'Échanges',
    get question() { return tr('ui.commentSeDerouleUneCommande'); },
    get answer() { return tr('ui.uneAnnonceOuUneDemandeD'); },
  },
  {
    id: 'ia',
    topic: 'Technique',
    get question() { return tr('ui.leDiagnosticDeSolEstIl'); },
    get answer() { return tr('ui.cEstUneAideALa'); },
  },
  {
    id: 'offline',
    topic: 'Technique',
    get question() { return tr('ui.lApplicationFonctionneTElleSans'); },
    get answer() { return tr('ui.lesEcransDejaConsultesRestentAffiches'); },
  },
  {
    id: 'api',
    topic: 'Technique',
    get question() { return tr('ui.existeTIlUneApiPour'); },
    get answer() { return tr('ui.ouiUneApiPubliqueACle'); },
  },
];
