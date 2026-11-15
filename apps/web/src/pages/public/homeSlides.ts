import { tr } from '@/i18n';
﻿export const HOME_SLIDES = [
  {
    image: new URL('../../assets/hero/champs-manioc.jpg', import.meta.url).href,
    get titre() { return tr('ui.tracabiliteAgricoleMarchesEtInvestissementEn'); },
    get sousTitre() { return tr('ui.chaqueLotPorteSonOrigineChaque'); },
    ctaHref: '/auth/register',
    get ctaLabel() { return tr('ui.creerUnCompteGratuit'); },
  },
  {
    image: new URL('../../assets/hero/cooperative.jpg', import.meta.url).href,
    get titre() { return tr('ui.lesCooperativesAuCUrDes'); },
    get sousTitre() { return tr('ui.reunissezVosProductionsNegociezCollectivementEt'); },
    ctaHref: '/public/cooperatives',
    get ctaLabel() { return tr('ui.decouvrirLesCooperatives'); },
  },
  {
    image: new URL('../../assets/hero/marche.jpg', import.meta.url).href,
    get titre() { return tr('ui.opportunitesDeMarche'); },
    get sousTitre() { return tr('ui.publiezVosAnnoncesRecevezDesOffres'); },
    ctaHref: '/public/tenders',
    get ctaLabel() { return tr('ui.voirLesOpportunites'); },
  },
  {
    image: new URL('../../assets/hero/terres-aeriennes.jpg', import.meta.url).href,
    get titre() { return tr('ui.cartographieAgricole'); },
    get sousTitre() { return tr('ui.localisezVosExploitationsSurUneCarte'); },
    ctaHref: '/public/map',
    get ctaLabel() { return tr('ui.ouvrirLaCarte'); },
  },
  {
    image: new URL('../../assets/hero/sol-analyse.jpg', import.meta.url).href,
    get titre() { return tr('ui.analyseDesSolsEtConseilsAgronomes'); },
    get sousTitre() { return tr('ui.determinezLaConvenanceDeVosParcelles'); },
    ctaHref: '/auth/register',
    get ctaLabel() { return tr('ui.commencerLAnalyse'); },
  },
  {
    image: new URL('../../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    get titre() { return tr('ui.technologieAuServiceDesExploitations'); },
    get sousTitre() { return tr('ui.capteursDetectionsDAnomaliesEtAlertes'); },
    ctaHref: '/auth/register',
    get ctaLabel() { return tr('ui.equiperMonExploitation'); },
  },
  {
    image: new URL('../../assets/hero/tracabilite-lot.jpg', import.meta.url).href,
    get titre() { return tr('ui.tracabiliteDeLaParcelleAuMarche'); },
    get sousTitre() { return tr('ui.chaqueLotRecoitUnQrCode'); },
    ctaHref: '/public/lots/demo',
    get ctaLabel() { return tr('ui.voirUnLotExemple'); },
  },
  {
    image: new URL('../../assets/hero/investissement-projet.jpg', import.meta.url).href,
    get titre() { return tr('ui.investisseursEtProjetsAgricoles'); },
    get sousTitre() { return tr('ui.deposezUnProjetDeDeveloppementTrouvez'); },
    ctaHref: '/public/projects',
    get ctaLabel() { return tr('ui.deposerUnProjet'); },
  },
  {
    image: new URL('../../assets/hero/elevage.jpg', import.meta.url).href,
    get titre() { return tr('ui.filieresAnimalesEtElevage'); },
    get sousTitre() { return tr('ui.suivezVosCheptelsEnregistrezLesProductions'); },
    ctaHref: '/auth/register',
    get ctaLabel() { return tr('ui.gererMonElevage'); },
  },
  {
    image: new URL('../../assets/hero/recolte.jpg', import.meta.url).href,
    get titre() { return tr('ui.recoltesEtProductionsAgricoles'); },
    get sousTitre() { return tr('ui.declarezVosRendementsComparezLesAux'); },
    ctaHref: '/auth/register',
    get ctaLabel() { return tr('ui.declarerMaRecolte'); },
  },
] as const;

