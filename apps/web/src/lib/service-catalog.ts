import { tr } from '@/i18n';
export interface ServiceCatalogItem {
  id: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  imageAlt: string;
  icon: string;
  features: string[];
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: 'traceabilite', get title() { return tr('ui.tracabiliteEtOrigine'); }, icon: '◈',
    get summary() { return tr('ui.unQrCodeParLotUne'); },
    get description() { return tr('ui.suivezLesProductionsDepuisLaParcelle'); },
    image: new URL('../assets/hero/tracabilite-lot.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.lotDeProductionAgricolePretA'); },
    get features() { return [tr('ui.codeQrEtFichePubliquePour'), tr('ui.historiqueHorodateDesOperationsEtControles'), tr('ui.origineDeclareeDistingueeDeLaProvenance'), tr('ui.informationsDeProductionConsultablesSansExposer')]; },
  },
  {
    id: 'marche', get title() { return tr('ui.marcheEtCommandes'); }, icon: '↗',
    get summary() { return tr('ui.publiezTrouvezDesAcheteursEtSuivez'); },
    get description() { return tr('ui.laPlaceDeMarcheMetEn'); },
    image: new URL('../assets/hero/marche.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.produitsAgricolesProposesSurUnMarche'); },
    get features() { return [tr('ui.annoncesDeVenteEtDemandesD'), tr('ui.offresLieesAuxBesoinsEtCommandes'), tr('ui.instantaneDuPrixLorsDeLa'), tr('ui.gestionDesStocksFacturesTransportEt')]; },
  },
  {
    id: 'investissement', get title() { return tr('ui.investissementEtProjets'); }, icon: '↗',
    get summary() { return tr('ui.desProjetsAgricolesDocumentesDuDepot'); },
    get description() { return tr('ui.lesPorteursPresententLeursProjetsEt'); },
    image: new URL('../assets/hero/investissement-projet.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.projetAgricoleEtPartenairesDeFinancement'); },
    get features() { return [tr('ui.portefeuilleEtFichesDetailleesDeProjets'), tr('ui.dataRoomAvecAccesEtConsultations'), tr('ui.dueDiligenceStructureeEtSuiviDes'), tr('ui.rapportsDeProgresEtDImpact')]; },
  },
  {
    id: 'donnees-marche', get title() { return tr('ui.donneesDeMarche'); }, icon: '▥',
    get summary() { return tr('ui.prixVolumesEtTendancesAvecLeurs'); },
    get description() { return tr('ui.consultezLesIndicateursAgricolesAgregesAvec'); },
    image: new URL('../assets/hero/terres-aeriennes.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.zonesAgricolesObserveesDepuisLeCiel'); },
    get features() { return [tr('ui.prixDatesMarchesUnitesEtSources'), tr('ui.seriesDePrixEtIndicateursDe'), tr('ui.agregatsAnonymisesSoumisAuSeuilDe'), tr('ui.catalogueEtProduitsDeDonneesAvec')]; },
  },
  {
    id: 'cooperatives', get title() { return tr('ui.cooperatives'); }, icon: '♧',
    get summary() { return tr('ui.organisezLesMembresEtRassemblezLes'); },
    get description() { return tr('ui.lesOrganisationsAgricolesDisposentDOutils'); },
    image: new URL('../assets/hero/cooperative.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.producteursReunisAuSeinDUne'); },
    get features() { return [tr('ui.profilDOrganisationEtVerification'), tr('ui.invitationsGestionEtImportDesMembres'), tr('ui.volumesDeProductionConsolides'), tr('ui.offresGroupeesCommandesEtAppelsD')]; },
  },
  {
    id: 'assistance-ia', get title() { return tr('ui.assistanceIa'); }, icon: '✳',
    get summary() { return tr('ui.analysezCulturesEtDocumentsAvecRelais'); },
    get description() { return tr('ui.leCopiloteAideAExaminerDes'); },
    image: new URL('../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.technologieNumeriqueUtiliseeDansUneExploitation'); },
    get features() { return [tr('ui.analyseDeCulturesEtDeDocuments'), tr('ui.historiqueDesAnalysesEtSuiviDe'), tr('ui.referencesEtLimitesClairementPresentees'), tr('ui.possibiliteDEscaladeVersUnAgronome')]; },
  },
  {
    id: 'inspection-sols', get title() { return tr('ui.inspectionEtDiagnosticDesSols'); }, icon: '⌁',
    get summary() { return tr('ui.comprenezLEtatDuSolEt'); },
    get description() { return tr('ui.rassemblezLesEvaluationsPedologiquesObservations'); },
    image: new URL('../assets/hero/sol-analyse.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.inspectionAgronomiqueDuSolDansUne'); },
    get features() { return [tr('ui.evaluationsDuSolEtObservationsDe'), tr('ui.lectureDesParametresDisponiblesEtDe'), tr('ui.cartesPedologiquesEtZonesInterpoleesLorsqu'), tr('ui.diagnosticIndicatifAvecLimitesEtBesoin')]; },
  },
  {
    id: 'fermes-productions', get title() { return tr('ui.fermesCulturesEtProductions'); }, icon: '♧',
    get summary() { return tr('ui.gerezParcellesCulturesSaisonsEtRendements'); },
    get description() { return tr('ui.centralisezLesInformationsSurLesExploitations'); },
    image: new URL('../assets/hero/champs-manioc.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.culturesVivrieresDansUneExploitationAgricole'); },
    get features() { return [tr('ui.exploitationsEtParcellesCartographiees'), tr('ui.referentielDeCulturesEtCalendrierDes'), tr('ui.productionsRendementsReelsEtRetoursDe'), tr('ui.certificationsEtExportsDeDonnees')]; },
  },
  {
    id: 'agriculture-precision', get title() { return tr('ui.technologieEtAgricultureDePrecision'); }, icon: '⌖',
    get summary() { return tr('ui.combinezCartographieSatelliteEtCapteursAgricoles'); },
    get description() { return tr('ui.desOutilsGeospatiauxEtDesAppareils'); },
    image: new URL('../assets/hero/technologie-capteurs.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.capteursEtOutilsNumeriquesPourLe'); },
    get features() { return [tr('ui.donneesGeographiquesEtCartesDeParcelles'), tr('ui.imagerieSatelliteEtIndicesDeVegetation'), tr('ui.importDeDonneesDroneEtGeoradar'), tr('ui.mesuresIotAnomaliesEtRevuePar')]; },
  },
  {
    id: 'conseils-semis', get title() { return tr('ui.conseilsDeCultureEtCalendrierDe'); }, icon: '◷',
    get summary() { return tr('ui.reperezQuoiSemerEtQuandSelon'); },
    get description() { return tr('ui.lesRecommandationsCulturalesSAppuientSur'); },
    image: new URL('../assets/hero/recolte.jpg', import.meta.url).href,
    get imageAlt() { return tr('ui.cultureAgricoleSuivieAuFilDe'); },
    get features() { return [tr('ui.periodesDeSemisDEntretienEt'), tr('ui.conseilsLiesAuxCulturesEtA'), tr('ui.alertesMeteoEtAgronomiquesRattacheesAux'), tr('ui.recommandationsSourceesEtRelectureHumaineSi')]; },
  },
];

export const SERVICE_DOMAINS = [
  { get title() { return tr('ui.identiteComptesEtAcces'); }, get text() { return tr('ui.inscriptionConnexionMfaVerificationDesCoordonnee'); } },
  { get title() { return tr('ui.exploitationAgricole'); }, get text() { return tr('ui.fermesParcellesCulturesDiagnosticDeSol'); } },
  { get title() { return tr('ui.geospatialTeledetectionEtIot'); }, get text() { return tr('ui.cartographieAnalysesPedologiquesImagerieSatellit'); } },
  { get title() { return tr('ui.marcheEtCommandes'); }, get text() { return tr('ui.annoncesDemandesDAchatOffresCommandes'); } },
  { get title() { return tr('ui.communicationEtAlertes'); }, get text() { return tr('ui.messagerieNotificationsCanauxEMailEt'); } },
  { get title() { return tr('ui.intelligenceEtDonnees'); }, get text() { return tr('ui.analysesIaMeteoPrixDeMarche'); } },
  { get title() { return tr('ui.investissement'); }, get text() { return tr('ui.projetsPortefeuilleDataRoomDiligenceReporting'); } },
  { get title() { return tr('ui.internationalEtMarchesPublics'); }, get text() { return tr('ui.appelsDOffresCataloguePublicDe'); } },
  { get title() { return tr('ui.administrationModerationEtConfiance'); }, get text() { return tr('ui.verificationDesProducteursModerationSignalements'); } },
  { get title() { return tr('ui.espacePublic'); }, get text() { return tr('ui.carteInteractiveAnnuaireDeProducteursEt'); } },
];
