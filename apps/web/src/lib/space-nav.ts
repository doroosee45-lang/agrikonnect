import { tr } from '@/i18n';
/*
 * Navigation des espaces metier : source unique, alimentee par les
 * ROUTES REELLES declarees dans src/App.tsx.
 *
 * Enrichie pour le modele Horizon :
 *  - arborescence optionnelle (`children`) avec rail vertical ;
 *  - bouton d'action rapide contextuel (`cta`) dans la barre superieure ;
 *  - activation corrigee sur `/investment` (racine investisseur).
 */
export interface LienEspace {
  to: string;
  label: string;
  icone?: string;
  badge?: string | number;
  children?: LienEspace[];
}

export interface GroupeEspace {
  titre: string;
  items: LienEspace[];
}

export interface CtaEspace {
  label: string;
  to: string;
}

export interface EspaceDef {
  id: string;
  titre: string;
  cta?: CtaEspace;
  groupes: GroupeEspace[];
}

export const ESPACES: EspaceDef[] = [
  {
    id: 'admin',
    get titre() { return tr('ui.administration'); },
    cta: { get label() { return tr('ui.gererLesComptes'); }, to: '/admin/users' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/admin/dashboard', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          {
            to: '/admin/monitoring',
            get label() { return tr('ui.supervisionOperations'); },
            icone: 'cible',
            children: [
              { to: '/admin/monitoring', get label() { return tr('ui.etatDesServices'); } },
              { to: '/admin/operations', get label() { return tr('ui.operationsModeration'); } },
              { to: '/admin/jobs', get label() { return tr('ui.tachesPlanifiees_8a786'); } },
              { to: '/admin/sync', get label() { return tr('ui.synchronisation'); } },
              { to: '/admin', get label() { return tr('ui.catalogueDesModules'); } },
            ],
          },
          {
            to: '/admin/farms',
            get label() { return tr('ui.reseauAgricole'); },
            icone: 'feuille',
            children: [
              { to: '/admin/farms', get label() { return tr('ui.exploitations'); } },
              { to: '/admin/plots', get label() { return tr('ui.parcelles'); } },
              { to: '/admin/productions', get label() { return tr('ui.productions'); } },
              { to: '/admin/lots', get label() { return tr('ui.lotsTracables'); } },
              { to: '/admin/farmers', get label() { return tr('ui.agriculteurs'); } },
              { to: '/admin/producers', get label() { return tr('ui.organisations'); } },
              { to: '/admin/cooperatives', get label() { return tr('ui.cooperatives'); } },
            ],
          },
          {
            to: '/admin/orders',
            get label() { return tr('ui.marcheCommerce'); },
            icone: 'panier',
            children: [
              { to: '/admin/orders', get label() { return tr('ui.commandes'); } },
              { to: '/admin/marketplace', get label() { return tr('ui.annoncesPubliees'); } },
              { to: '/admin/prices', get label() { return tr('ui.mercurialesPrix'); } },
              { to: '/admin/projects', get label() { return tr('ui.projetsAgricoles'); } },
              { to: '/admin/investors', get label() { return tr('ui.investisseurs'); } },
            ],
          },
          {
            to: '/admin/crops',
            get label() { return tr('ui.scienceReferentiels'); },
            icone: 'carte',
            children: [
              { to: '/admin/crops', get label() { return tr('ui.cultures'); } },
              { to: '/admin/agronomic-ranges', get label() { return tr('ui.plagesAgronomiques'); } },
              { to: '/admin/rules', get label() { return tr('ui.reglesCulturales'); } },
              { to: '/admin/devices', get label() { return tr('ui.capteursIot'); } },
              { to: '/admin/countries', get label() { return tr('ui.paysDevises'); } },
              { to: '/admin/ai-usage', get label() { return tr('ui.modelesUsageIa'); } },
            ],
          },
        ],
      },
      {
        get titre() { return tr('ui.gouvernanceSecurite'); },
        items: [
          {
            to: '/admin/users',
            get label() { return tr('ui.comptesRoles'); },
            icone: 'utilisateurs',
            children: [
              { to: '/admin/users', get label() { return tr('ui.tousLesUtilisateurs'); } },
              { to: '/admin/roles', get label() { return tr('ui.matriceDesRoles_bd794'); } },
              { to: '/admin/verifications', get label() { return tr('ui.fileDeVerification'); } },
              { to: '/admin/moderation', get label() { return tr('ui.litigesModeration'); } },
              { to: '/admin/reports', get label() { return tr('ui.signalements'); } },
            ],
          },
          {
            to: '/admin/security',
            get label() { return tr('ui.securiteAudit'); },
            icone: 'clef',
            children: [
              { to: '/admin/security', get label() { return tr('ui.politiqueDeSecurite'); } },
              { to: '/admin/audit', get label() { return tr('ui.journalDAudit_52309'); } },
              { to: '/admin/compliance', get label() { return tr('ui.conformitePays'); } },
              { to: '/admin/api-clients', get label() { return tr('ui.clientsApi'); } },
              { to: '/admin/data-products', get label() { return tr('ui.produitsDeDonnees'); } },
              { to: '/admin/partners', get label() { return tr('ui.partenaires'); } },
            ],
          },
          { to: '/admin/notifications', get label() { return tr('ui.diffusionsAlertes'); }, icone: 'cloche' },
          { to: '/admin/messages', get label() { return tr('ui.messagerie'); }, icone: 'message' },
          { to: '/admin/settings', get label() { return tr('ui.parametresSysteme'); }, icone: 'reglages' },
        ],
      },
    ],
  },
  {
    id: 'farmer',
    get titre() { return tr('ui.monExploitation'); },
    cta: { get label() { return tr('ui.nouvelleParcelle'); }, to: '/farmer/plots/create' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/farmer', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          {
            to: '/farmer/farms',
            get label() { return tr('ui.parcellaireRecoltes'); },
            icone: 'feuille',
            children: [
              { to: '/farmer/farms', get label() { return tr('ui.mesExploitations'); } },
              { to: '/farmer/plots', get label() { return tr('ui.mesParcelles'); } },
              { to: '/farmer/productions', get label() { return tr('ui.productionsDeclarees'); } },
              { to: '/farmer/soil', get label() { return tr('ui.analysesDeSol'); } },
              { to: '/farmer/lots', get label() { return tr('ui.lotsQrTracabilite'); } },
            ],
          },
          {
            to: '/farmer/export',
            get label() { return tr('ui.commerceProjets'); },
            icone: 'boite',
            children: [
              { to: '/farmer/export', get label() { return tr('ui.dossiersDExport'); } },
              { to: '/farmer/projects', get label() { return tr('ui.projetsDInvestissement'); } },
              { to: '/farmer/certifications', get label() { return tr('ui.certifications'); } },
            ],
          },
          {
            to: '/farmer/devices',
            get label() { return tr('ui.capteursTerrain'); },
            icone: 'appareils',
            children: [
              { to: '/farmer/devices', get label() { return tr('ui.sondesCapteursIot'); } },
              { to: '/farmer/alerts', get label() { return tr('ui.boiteDAlertes'); } },
              { to: '/farmer/surveys', get label() { return tr('ui.enquetesTerrain'); } },
              { to: '/farmer/sync', get label() { return tr('ui.synchronisationHorsLigne'); } },
              { to: '/farmer/conflicts', get label() { return tr('ui.conflitsDeSynchro'); } },
              { to: '/farmer/gallery', get label() { return tr('ui.galerieMedias'); } },
            ],
          },
        ],
      },
      {
        get titre() { return tr('ui.compteConformite'); },
        items: [
          { to: '/farmer/profile', get label() { return tr('ui.monProfil'); }, icone: 'personne' },
          { to: '/farmer/public-profile', get label() { return tr('ui.fichePublique'); }, icone: 'globe' },
          { to: '/farmer/verification', get label() { return tr('ui.verificationKyc'); }, icone: 'verification' },
          { to: '/farmer/settings', get label() { return tr('ui.parametres_ef8f0'); }, icone: 'reglages' },
        ],
      },
    ],
  },
  {
    id: 'organization',
    get titre() { return tr('ui.monOrganisation'); },
    cta: { get label() { return tr('ui.inviterUnMembre'); }, to: '/organization/invitations' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/organization', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          { to: '/organization/overview', get label() { return tr('ui.agregatsConsolides'); }, icone: 'couches' },
          {
            to: '/organization/members',
            get label() { return tr('ui.gestionDesMembres'); },
            icone: 'utilisateurs',
            children: [
              { to: '/organization/members', get label() { return tr('ui.repertoireMembres'); } },
              { to: '/organization/invitations', get label() { return tr('ui.invitationsEnCours'); } },
              { to: '/organization/import', get label() { return tr('ui.importCsvLot'); } },
            ],
          },
          {
            to: '/organization/farms',
            get label() { return tr('ui.reseauProduction'); },
            icone: 'feuille',
            children: [
              { to: '/organization/farms', get label() { return tr('ui.exploitationsMembres'); } },
              { to: '/organization/production', get label() { return tr('ui.syntheseDesRecoltes'); } },
            ],
          },
        ],
      },
      {
        get titre() { return tr('ui.navGroupGovernance'); },
        items: [
          { to: '/organization/profile', get label() { return tr('ui.profilOrganisation'); }, icone: 'personne' },
          { to: '/organization/settings', get label() { return tr('ui.parametres_ef8f0'); }, icone: 'reglages' },
          { to: '/organization/verification', get label() { return tr('ui.verificationOfficielle'); }, icone: 'verification' },
        ],
      },
    ],
  },
  {
    id: 'marche',
    get titre() { return tr('ui.marcheLogistique'); },
    cta: { get label() { return tr('ui.nouvelleAnnonce'); }, to: '/market/listings/new' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/market/app', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          {
            to: '/market/listings/new',
            get label() { return tr('ui.offresDemandes'); },
            icone: 'panier',
            children: [
              { to: '/market/listings/new', get label() { return tr('ui.publierUneAnnonce'); } },
              { to: '/market/requests', get label() { return tr('ui.demandesDAchat'); } },
              { to: '/market/requests/new', get label() { return tr('ui.nouvelleDemande'); } },
            ],
          },
          { to: '/market/transporters', get label() { return tr('ui.transporteurs'); }, icone: 'camion' },
          { to: '/market/reviews', get label() { return tr('ui.avisReputation'); }, icone: 'message' },
        ],
      },
      {
        get titre() { return tr('ui.execution'); },
        items: [
          { to: '/app/orders', get label() { return tr('ui.mesCommandes'); }, icone: 'facture' },
          { to: '/app/inventory', get label() { return tr('ui.stocksMouvements'); }, icone: 'boite' },
          { to: '/app/messages', get label() { return tr('ui.messagerie'); }, icone: 'message' },
        ],
      },
    ],
  },
  {
    id: 'investissement',
    get titre() { return tr('ui.portefeuilleInvestisseur'); },
    cta: { get label() { return tr('ui.catalogueProjets'); }, to: '/public/projects' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/investment', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          {
            to: '/investment/projects',
            get label() { return tr('ui.portefeuilleProjets'); },
            icone: 'dossier',
            children: [
              { to: '/investment/projects', get label() { return tr('ui.projetsSuivis'); } },
              { to: '/investment/requests', get label() { return tr('ui.accesDataRoom'); } },
            ],
          },
          { to: '/investment/profile', get label() { return tr('ui.profilInvestisseur'); }, icone: 'personne' },
          { to: '/investment/settings', get label() { return tr('ui.parametres_ef8f0'); }, icone: 'reglages' },
        ],
      },
    ],
  },
  {
    id: 'app',
    get titre() { return tr('ui.monEspace'); },
    cta: { get label() { return tr('ui.mesCommandes'); }, to: '/app/orders' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/app', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          {
            to: '/app/farms',
            get label() { return tr('ui.activiteAgricole'); },
            icone: 'feuille',
            children: [
              { to: '/app/farms', get label() { return tr('ui.exploitations'); } },
              { to: '/app/plots', get label() { return tr('ui.parcelles'); } },
              { to: '/app/productions', get label() { return tr('ui.productions'); } },
              { to: '/app/soil', get label() { return tr('ui.analysesDeSol'); } },
              { to: '/app/season-feedback', get label() { return tr('ui.bilanDeSaison'); } },
            ],
          },
          {
            to: '/app/orders',
            get label() { return tr('ui.commerceTransport'); },
            icone: 'camion',
            children: [
              { to: '/app/orders', get label() { return tr('ui.commandes'); } },
              { to: '/app/inventory', get label() { return tr('ui.inventaire'); } },
              { to: '/app/transport', get label() { return tr('ui.transportLivraisons'); } },
              { to: '/app/invoices', get label() { return tr('ui.factures'); } },
              { to: '/app/cooperative', get label() { return tr('ui.cooperative'); } },
              { to: '/app/cooperative/offers', get label() { return tr('ui.offresGroupees'); } },
              { to: '/app/cooperative/orders', get label() { return tr('ui.commandesGroupees'); } },
            ],
          },
        ],
      },
      {
        get titre() { return tr('ui.supportCompte'); },
        items: [
          { to: '/app/messages', get label() { return tr('ui.messagerie'); }, icone: 'message' },
          { to: '/app/notifications', get label() { return tr('ui.notifications'); }, icone: 'cloche' },
          { to: '/app/sms-consent', get label() { return tr('ui.consentementSms'); }, icone: 'appareils' },
          { to: '/app/agent', get label() { return tr('ui.espaceAgentTerrain'); }, icone: 'utilisateurs' },
          { to: '/app/profile', get label() { return tr('ui.monProfil'); }, icone: 'personne' },
          { to: '/app/verification', get label() { return tr('ui.verification_bb27a'); }, icone: 'verification' },
        ],
      },
    ],
  },
  {
    id: 'reviewer',
    get titre() { return tr('ui.expertiseVerification'); },
    cta: { get label() { return tr('ui.fileDeControle'); }, to: '/reviewer/missions' },
    groupes: [
      {
        get titre() { return tr('ui.menuPrincipal'); },
        items: [
          { to: '/reviewer/missions', get label() { return tr('ui.tableauDesMissions'); }, icone: 'verification' },
        ],
      },
      {
        get titre() { return tr('ui.navGroupTools'); },
        items: [
          { to: '/app/notifications', get label() { return tr('ui.notifications'); }, icone: 'cloche' },
          { to: '/app/profile', get label() { return tr('ui.profilExpert'); }, icone: 'personne' },
        ],
      },
    ],
  },
  {
    id: 'developers',
    get titre() { return tr('ui.portailDeveloppeurs'); },
    cta: { get label() { return tr('ui.gererMesCles'); }, to: '/developers/keys' },
    groupes: [
      {
        get titre() { return tr('ui.apiPubliqueV5'); },
        items: [
          { to: '/developers', get label() { return tr('ui.tableauDeBord'); }, icone: 'graphe' },
          { to: '/developers/keys', get label() { return tr('ui.clesApi'); }, icone: 'clef' },
          { to: '/developers/usage', get label() { return tr('ui.quotasConsommation'); }, icone: 'cible' },
          { to: '/developers/docs', get label() { return tr('ui.documentationOpenapi'); }, icone: 'livre' },
        ],
      },
    ],
  },
];

const ACTIVATION: { id: string; test: (chemin: string) => boolean }[] = [
  { id: 'admin', test: (c) => c === '/admin' || c.startsWith('/admin/') },
  { id: 'app', test: (c) => c === '/app' || c.startsWith('/app/') },
  { id: 'farmer', test: (c) => c === '/farmer' || c.startsWith('/farmer/') },
  { id: 'organization', test: (c) => c === '/organization' || c.startsWith('/organization/') },
  { id: 'reviewer', test: (c) => c === '/reviewer' || c.startsWith('/reviewer/') },
  { id: 'developers', test: (c) => c === '/developers' || c.startsWith('/developers/') },
  { id: 'marche', test: (c) => /^\/market\/(app|listings\/new|requests|reviews|transporters)/.test(c) },
  { id: 'investissement', test: (c) => c === '/investment' || /^\/investment\/(profile|projects|requests)/.test(c) },
];

export function resolveEspace(chemin: string): EspaceDef | null {
  const activation = ACTIVATION.find((entree) => entree.test(chemin));
  if (!activation) return null;
  return ESPACES.find((espace) => espace.id === activation.id) ?? null;
}
