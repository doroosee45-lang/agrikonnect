import type { ImageSourcePropType } from 'react-native';
import { tr } from '@/i18n';

export interface ServiceCatalogItem {
  id: string;
  title: string;
  summary: string;
  description: string;
  image: ImageSourcePropType;
  imageAlt: string;
  features: string[];
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { id: 'traceabilite', get title() { return tr('ui.tracabiliteEtOrigine'); }, get summary() { return tr('ui.unQrCodeParLotUne'); }, get description() { return tr('ui.suivezLesProductionsDepuisLaParcelle'); }, image: require('../../assets/hero/tracabilite-lot.jpg'), get imageAlt() { return tr('ui.productionAgricolePreteAEtreTracee'); }, get features() { return [tr('ui.codeQrEtFichePubliquePour'), tr('ui.historiqueHorodateDesOperationsEtControles'), tr('ui.origineDeclareeDistingueeDeLaProvenance'), tr('ui.donneesPubliquesSansExpositionDesInformations')]; } },
  { id: 'marche', get title() { return tr('ui.marcheEtCommandes'); }, get summary() { return tr('ui.publiezTrouvezDesAcheteursEtSuivez'); }, get description() { return tr('ui.laPlaceDeMarcheMetEn_98ba6'); }, image: require('../../assets/hero/marche.jpg'), get imageAlt() { return tr('ui.produitsAgricolesProposesSurUnMarche'); }, get features() { return [tr('ui.annoncesDeVenteEtDemandesD'), tr('ui.offresEtCommandesSuiviesEtapePar'), tr('ui.prixEnregistreLorsDeLaValidation'), tr('ui.stocksFacturesTransportEtLitiges')]; } },
  { id: 'investissement', get title() { return tr('ui.investissementEtProjets'); }, get summary() { return tr('ui.desProjetsDocumentesDuDepotAu'); }, get description() { return tr('ui.lesPorteursPresententLeursProjetsEt_9b09c'); }, image: require('../../assets/hero/investissement-projet.jpg'), get imageAlt() { return tr('ui.projetAgricoleEtPartenairesDeFinancement'); }, get features() { return [tr('ui.portefeuilleEtFichesDetailleesDeProjets'), tr('ui.dataRoomAvecAccesJournalises'), tr('ui.dueDiligenceStructureeEtSuiviDes'), tr('ui.rapportsDeProgresEtDImpact')]; } },
  { id: 'donnees-marche', get title() { return tr('ui.donneesDeMarche'); }, get summary() { return tr('ui.prixVolumesEtTendancesAvecLeurs'); }, get description() { return tr('ui.consultezDesIndicateursAgricolesAgregesAvec'); }, image: require('../../assets/hero/terres-aeriennes.jpg'), get imageAlt() { return tr('ui.zonesAgricolesObserveesDepuisLeCiel'); }, get features() { return [tr('ui.prixDatesUnitesMarchesEtSources'), tr('ui.seriesDePrixEtIndicateursDe'), tr('ui.agregatsAnonymisesAvecSeuilKAnonymat'), tr('ui.catalogueDeDonneesEtExportsStructures')]; } },
  { id: 'cooperatives', get title() { return tr('ui.cooperatives'); }, get summary() { return tr('ui.organisezLesMembresEtRassemblezLes'); }, get description() { return tr('ui.lesOrganisationsAgricolesGerentLeursMembres'); }, image: require('../../assets/hero/cooperative.jpg'), get imageAlt() { return tr('ui.producteursReunisAuSeinDUne'); }, get features() { return [tr('ui.profilDOrganisationEtVerification'), tr('ui.invitationsEtGestionDesMembres'), tr('ui.volumesDeProductionConsolides'), tr('ui.offresGroupeesEtAppelsDOffres')]; } },
  { id: 'assistance-ia', get title() { return tr('ui.assistanceIa'); }, get summary() { return tr('ui.analysezCulturesEtDocumentsAvecRelais_51f7d'); }, get description() { return tr('ui.leCopiloteAideAExaminerDes_e3eed'); }, image: require('../../assets/hero/technologie-capteurs.jpg'), get imageAlt() { return tr('ui.technologieNumeriqueUtiliseeDansUneExploitation_8c432'); }, get features() { return [tr('ui.analyseDeCulturesEtDeDocuments'), tr('ui.historiqueDesAnalysesEtSuiviD'), tr('ui.referencesEtLimitesPresentees'), tr('ui.escaladePossibleVersUnAgronome')]; } },
  { id: 'inspection-sols', get title() { return tr('ui.inspectionEtDiagnosticDesSols'); }, get summary() { return tr('ui.comprenezLEtatDuSolEt'); }, get description() { return tr('ui.rassemblezEvaluationsPedologiquesObservationsDeT'); }, image: require('../../assets/hero/sol-analyse.jpg'), get imageAlt() { return tr('ui.inspectionAgronomiqueDuSolDansUne'); }, get features() { return [tr('ui.evaluationsDuSolEtObservationsDe'), tr('ui.parametresRelevesEtProvenanceDesMesures'), tr('ui.cartesPedologiquesLorsqueDisponibles'), tr('ui.diagnosticIndicatifAvecLimitesClairementSignalee')]; } },
  { id: 'fermes-productions', get title() { return tr('ui.fermesCulturesEtProductions'); }, get summary() { return tr('ui.gerezParcellesCulturesSaisonsEtRendements'); }, get description() { return tr('ui.centralisezLesInformationsDesExploitationsParcel'); }, image: require('../../assets/hero/champs-manioc.jpg'), get imageAlt() { return tr('ui.culturesVivrieresDansUneExploitationAgricole'); }, get features() { return [tr('ui.exploitationsEtParcellesCartographiees'), tr('ui.referentielDesCulturesEtSaisons'), tr('ui.productionsEtRendementsReels'), tr('ui.certificationsEtExportsDeDonnees')]; } },
  { id: 'agriculture-precision', get title() { return tr('ui.technologieEtAgricultureDePrecision'); }, get summary() { return tr('ui.combinezCartographieSatelliteEtCapteurs'); }, get description() { return tr('ui.lesOutilsGeospatiauxEtAppareilsConnectes'); }, image: require('../../assets/hero/technologie-capteurs.jpg'), get imageAlt() { return tr('ui.capteursEtOutilsNumeriquesPourLe'); }, get features() { return [tr('ui.cartographieDesParcellesEtDonneesGeographiques'), tr('ui.imagerieSatelliteEtIndicesDisponibles'), tr('ui.importDeDonneesDroneEtGeoradar'), tr('ui.mesuresIotAnomaliesEtRevueAgronome')]; } },
  { id: 'conseils-semis', get title() { return tr('ui.conseilsDeCultureEtCalendrierDe'); }, get summary() { return tr('ui.reperezQuoiSemerEtQuandSelon_82741'); }, get description() { return tr('ui.lesRecommandationsCulturalesSAppuientSur_98253'); }, image: require('../../assets/hero/recolte.jpg'), get imageAlt() { return tr('ui.cultureAgricoleSuivieAuFilDe'); }, get features() { return [tr('ui.periodesDeSemisDEntretienEt'), tr('ui.conseilsLiesAuxCulturesEtAux'), tr('ui.alertesMeteoEtAgronomiquesParParcelle'), tr('ui.sourcesCiteesEtRelectureHumaineSi')]; } },
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
