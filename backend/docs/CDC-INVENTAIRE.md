# INVENTAIRE DES EXIGENCES DU CAHIER DES CHARGES (V1 → V5)

Source : cahier des charges AGRIKONNECT AFRICA v2.0 (18 septembre 2026) — document
général §1–18 + cahiers détaillés V1, V2, V3, V4, V5, chacun avec son « Annexe A —
socle commun ».

Ce fichier est la **référence de l'audit** : `npm run check:cdc` le lit et vérifie
que **chaque identifiant** listé ici possède une entrée dans le catalogue
(`scripts/check-requirements.mjs`) ou, pour la famille NFR, une ligne dans
`docs/NFR.md`. Un identifiant du CDC sans couverture fait échouer le contrôle.

Les identifiants `NFR-*` sont numérotés **par version** dans le CDC : ils sont donc
préfixés ici (`V1:NFR-01`, `V2:NFR-01`, …) pour lever l'ambiguïté.

## Exigences transverses — Annexe A.4.1 (SEC)

| Réf. | Intitulé |
|---|---|
| SEC-01 | Helmet, CORS restrictif, rate limiting renforcé (login, OTP, reset) |
| SEC-02 | Validation stricte serveur, injection rejetée, sanitation |
| SEC-03 | Jetons d'accès courts + refresh rotatifs, hachés, révocables |
| SEC-04 | Hachage fort des mots de passe, politique raisonnable |
| SEC-05 | Vérification téléphone (OTP) et email, anti brute force |
| SEC-06 | Fichiers : type MIME réel, taille max, renommage, compression |
| SEC-07 | Documents privés : stockage privé + URL signées courtes |
| SEC-08 | Secrets uniquement en variables d'environnement |
| SEC-09 | Journal d'audit immuable des actions sensibles |
| SEC-10 | Audit de dépendances en CI |
| SEC-11 | Chiffrement en transit et au repos |
| SEC-12 | Coordonnées exactes contrôlées, position publique approximative |

## V1 — AGRIKONNECT FARM

| Réf. | Prio | Intitulé |
|---|---|---|
| AUTH-01 | M | Inscription en étapes |
| AUTH-02 | M | Connexion email ou téléphone + mot de passe |
| AUTH-03 | M | Vérification téléphone par OTP, email par lien |
| AUTH-04 | M | Mot de passe oublié / réinitialisation (jeton unique, expirant) |
| AUTH-05 | M | Refresh rotatifs, déconnexion, révocation de sessions |
| AUTH-06 | M | Choix de la langue et du pays à l'inscription |
| AUTH-07 | S | Inscription assistée par un agent terrain, consentement tracé |
| PROF-01 | M | Fiche producteur complète |
| PROF-02 | M | Visibilité par champ, contacts masqués par défaut |
| PROF-03 | S | Indicateur de complétude du profil |
| PROF-04 | S | Compteur de vues agrégé |
| FARM-01 | M | Créer/modifier/archiver une exploitation |
| FARM-02 | M | Galerie photos avec légende et ordre |
| FARM-03 | S | Plusieurs exploitations par organisation |
| FARM-04 | S | Contrôle de cohérence superficie totale / somme des parcelles |
| PLOT-01 | M | CRUD parcelle avec statut cultural |
| PLOT-02 | M/S | Point GPS, polygone, superficie calculée |
| PLOT-03 | M | Historique cultural par campagne |
| PLOT-04 | M | Archivage logique, historique conservé |
| PLOT-05 | S | Validation géographique dans le pays déclaré |
| CROP-01 | M | Catalogue de cultures administré |
| CROP-02 | S | Fiche agronomique enrichie |
| CROP-03 | C | Demande d'ajout d'une culture non listée |
| PROD-01 | M | Enregistrement de production |
| PROD-02 | M | Unités et conversions par référentiel |
| PROD-03 | M | Tableau de bord par agrégations |
| PROD-04 | M | Production déclarée, modification historisée |
| COOP-01 | M | Création d'une coopérative |
| COOP-02 | M | Gestion des membres |
| COOP-03 | S | Import CSV avec rapport d'erreurs et doublons |
| COOP-04 | M | Vue consolidée |
| COOP-05 | M | Propriété des données conservée par le membre |
| PUB-01 | M | Page publique façon mini-site |
| PUB-02 | M | Slug unique avec redirection de l'ancien |
| PUB-03 | M | QR code PNG/SVG |
| PUB-04 | M | Partage + Open Graph |
| PUB-05 | S | SEO et noindex des profils non vérifiés |
| PUB-06 | S | Formulaire de contact sans révéler les coordonnées |
| MAP-01 | M | Carte des exploitations et coopératives publiques |
| MAP-02 | M | Filtres pays/province/culture/type/coopérative |
| MAP-03 | M | Clusters et chargement par emprise |
| MAP-04 | M | Positions publiques approximatives |
| VER-01 | M | Statuts de vérification distincts |
| VER-02 | M | Dépôt de documents en stockage privé |
| VER-03 | M | File de revue admin avec motif, notification, audit |
| VER-04 | M | Provenance affichée séparément |
| VER-05 | M | Aucun score global, liste de critères |
| SOIL-01 | M | Profil de sol par parcelle avec source, date, méthode, confiance |
| SOIL-02 | M | Saisie des résultats de laboratoire + pièce jointe |
| SOIL-03 | M | Historique cultural pluriannuel en frise |

### V1:NFR — exigences non fonctionnelles de V1

| Réf. | Cible |
|---|---|
| V1:NFR-01 | 10 000 utilisateurs, 100 concurrents, 50 000 parcelles, charge 3× |
| V1:NFR-02 | API p95 < 500 ms sur les lectures courantes |
| V1:NFR-03 | LCP < 2,5 s, poids initial maîtrisé |
| V1:NFR-04 | Images redimensionnées/WebP, upload ≤ 5 Mo, reprise |
| V1:NFR-05 | SEO pages publiques ≥ 90, sitemap, Open Graph |
| V1:NFR-06 | Accessibilité WCAG 2.1 AA sur les parcours principaux |
| V1:NFR-07 | Disponibilité 99,5 % |
| V1:NFR-08 | Sauvegardes quotidiennes, RPO ≤ 24 h, RTO ≤ 4 h |
| V1:NFR-09 | Sécurité Annexe A.4.1, audit de dépendances, test d'intrusion |
| V1:NFR-10 | Appareils bas de gamme et connexions instables |
| V1:NFR-11 | Logs structurés avec identifiant de corrélation |

## V2 — AGRIKONNECT MARKET

| Réf. | Prio | Intitulé |
|---|---|---|
| MKT-01 | M | Annonces complètes (produit, quantité, prix, disponibilité) |
| MKT-02 | M | Catégories du marché |
| MKT-03 | M | Recherche avancée, tri, pagination |
| MKT-04 | M | Cycle de vie de l'annonce et expiration automatique |
| MKT-05 | M | Modération tracée |
| MKT-06 | S | Stock mis à jour selon les commandes confirmées |
| REQ-01 | M | Publication d'une demande d'achat |
| REQ-02 | M | Matching déterministe et explicable |
| REQ-03 | M | Notification aux producteurs compatibles, anti-spam |
| REQ-04 | M | Réponse chiffrée à une demande |
| REQ-05 | M | Aucune coordonnée avant accord |
| MSG-01 | M | Conversations liées à un objet, temps réel, pièces jointes |
| MSG-02 | M | Statuts envoyé/lu, reprise par curseur |
| MSG-03 | M | Blocage et signalement d'un interlocuteur |
| NOTIF-01 | M | Notifications multi-canaux avec préférences |
| NOTIF-02 | M | Événement central, déduplication |
| ORD-01 | M | Commande avec snapshot des conditions |
| ORD-02 | S | Négociation avant acceptation |
| ORD-03 | M | Historique des statuts, acteurs, dates |
| ORD-04 | M | Aucun paiement opéré, statut déclaratif |
| ORD-05 | S | Litige et arbitrage |
| STK-01 | M | Journal de mouvements, solde dérivé |
| STK-02 | S | Alertes stock faible et péremption |
| TRP-01 | S | Transport lié à une commande, preuve de livraison |
| BIL-01 | M | Documents PDF numérotés séquentiellement, multi-devises |
| BIL-02 | M | Devises et taux datés et sourcés |
| COOP-10 | M | Offre groupée et répartition traçable |
| SOIL-04 | M | Bibliothèque de règles versionnée, workflow de validation |
| SOIL-05 | M | Compatibilité culture/parcelle avec raisons et données |
| SOIL-06 | M | Rotation proposée avec justification et alternatives |
| SOIL-07 | S | Plan agricole pluriannuel |
| SOIL-08 | M | Avertissement systématique si confiance faible |
| SOIL-09 | M | Explication « pourquoi ? » |

### V2:NFR

| Réf. | Cible |
|---|---|
| V2:NFR-01 | Recherche p95 < 800 ms sur 100 000 annonces |
| V2:NFR-02 | Messagerie p95 < 2 s, reprise sans perte |
| V2:NFR-03 | Notifications < 30 s, déduplication, plafond |
| V2:NFR-04 | Aucune survente (concurrence) |
| V2:NFR-05 | Numérotation séquentielle sans trou, PDF reproductible |
| V2:NFR-06 | Disponibilité 99,5 %, dégradation sans cache |
| V2:NFR-07 | Anti-abus : limites, signalement, blocage |
| V2:NFR-08 | Aucun contact avant accord, pièces jointes privées |
| V2:NFR-09 | Mobile Android bas de gamme, mode léger |
| V2:NFR-10 | Chaque transition et modération auditée |

## V3 — AGRIKONNECT INTELLIGENCE

| Réf. | Prio | Intitulé |
|---|---|---|
| SYNC-01 | M | Base locale mobile |
| SYNC-02 | M | Synchronisation incrémentale bidirectionnelle idempotente |
| SYNC-03 | M | Résolution de conflits (LWW ou fusion métier) |
| SYNC-04 | M | État de synchronisation visible |
| SYNC-05 | M | Reprise d'upload des photos |
| AI-01 | M | Assistant conversationnel contextualisé avec limites |
| AI-02 | M | Analyse de photo avec confiance et escalade |
| AI-03 | S | Génération assistée de documents validée par l'utilisateur |
| AI-04 | M | Journalisation des requêtes/sorties avec consentement |
| AI-05 | M | Garde-fous : pas de dosage, pas de promesse de rendement |
| AI-06 | M | Abstraction fournisseur, budgets et quotas |
| WX-01 | M | Météo sourcée et horodatée, alertes contextualisées |
| PRC-01 | M | Prix agricoles avec marché, date, source |
| PRC-02 | M | Aucun prix universel, zone et date visibles |
| PRC-03 | M | Sources jamais mélangées sans étiquette |
| TRC-01 | M | Lot avec identifiant AK-{PAYS}-{ANNÉE}-{SÉQ} et QR |
| TRC-02 | M | Chaîne d'événements append-only |
| TRC-03 | S | Page publique de lot limitée aux champs autorisés |
| CERT-01 | M | Certifications, expiration, statut de vérification |
| USSD-01 | S | Menus USSD via agrégateur, comptes liés au numéro |
| WA-01 | S | WhatsApp Business API avec opt-in |
| GEO-01 | S | Couches satellitaires et séries temporelles par parcelle |
| IOT-01 | S | Appareils, ingestion authentifiée, seuils d'alerte |
| DRN-01 | C | Import de levés drone par opérateur déclaré |
| SOIL-10 | S | Import satellite, tendances, confiance |
| SOIL-11 | S | Analyse de photos = estimation visuelle uniquement |
| SOIL-12 | S | Capteurs avec étalonnage et qualité |
| SOIL-13 | C | Intégration laboratoire partenaire par API |
| SOIL-14 | C | Rendement en fourchette, jamais garanti |

### V3:NFR

| Réf. | Cible |
|---|---|
| V3:NFR-01 | Synchronisation idempotente, aucune duplication au rejeu |
| V3:NFR-02 | Parcours essentiels hors ligne, état visible |
| V3:NFR-03 | IA texte p95 < 10 s, image p95 < 30 s |
| V3:NFR-04 | Seuils de qualité IA avant mise en production |
| V3:NFR-05 | Budgets IA mensuels et alertes |
| V3:NFR-06 | Ingestion IoT tolérante aux doublons et au désordre |
| V3:NFR-07 | USSD : session courte, menus ≤ 4 niveaux |
| V3:NFR-08 | Base locale chiffrée, effacement à la déconnexion |
| V3:NFR-09 | Minimisation des données transmises à l'IA, consentement |
| V3:NFR-10 | Disponibilité 99,5 %, dégradation sans fournisseur |

## V4 — AGRIKONNECT INVEST

| Réf. | Prio | Intitulé |
|---|---|---|
| PRJ-01 | M | Fiche projet complète |
| PRJ-02 | M | Cycle de vie du projet |
| PRJ-03 | M | Déclaré vs vérifié séparés, aucune garantie |
| PRJ-04 | S | Génération assistée du plan, brouillon éditable |
| INV-01 | M | Profil investisseur vérifié |
| INV-02 | M | Exploration, filtres, projets suivis, demandes de contact |
| INV-03 | S | Matching explicable investisseur ↔ projet |
| DR-01 | M | Data room fermée par défaut, accès accordé, URL signées, filigrane, journal |
| DR-02 | M | Révocation et expiration des accès |
| DD-01 | S | Checklist de due diligence attribuée à des professionnels |
| SOIL-15 | C | Zonage de parcelle et recommandations par zone |

### V4:NFR

| Réf. | Cible |
|---|---|
| V4:NFR-01 | MFA obligatoire, sessions courtes, détection d'anomalies |
| V4:NFR-02 | Documents chiffrés, URL signées ≤ 5 min, journal append-only |
| V4:NFR-03 | Test d'intrusion externe avant mise en production |
| V4:NFR-04 | Conservation des journaux d'accès, horodatage fiable |
| V4:NFR-05 | Disponibilité 99,5 %, sauvegardes chiffrées, restauration testée |
| V4:NFR-06 | Ouverture de document p95 < 3 s, recherche p95 < 800 ms |
| V4:NFR-07 | Conformité : mentions, avertissements, consentements, droits |
| V4:NFR-08 | Chaque changement de statut et décision audité |
| V4:NFR-09 | Accessibilité WCAG 2.1 AA sur les parcours V4 |

## V5 — AGRIKONNECT GLOBAL

| Réf. | Prio | Intitulé |
|---|---|---|
| GLB-01 | M | Entité Country (devises, langues, découpage, unités, conformité) |
| GLB-02 | M | Ouverture d'un pays par configuration, sans changer le code |
| GLB-03 | M | Résidence des données selon exigences locales |
| GLB-04 | — | Pays candidats |
| API-01 | M | API versionnée : clés, OAuth, quotas, logs, facturation |
| API-02 | M | Données agrégées avec seuil anti ré-identification |
| API-03 | M | Gouvernance : contrat, finalités, retrait |
| I18N-01 | M | Internationalisation fr/en/pt et formats locaux |
| I18N-02 | M | Multi-devises, taux datés et sourcés, conversion figée |
| I18N-03 | M | Unités locales et conversions |
| EXP-01 | S | Workflow d'export étape par étape |
| EXP-02 | S | Documents d'export générés et suivis |
| EXP-03 | S | Partenaires logistiques |
| PRC-10 | M | Appels d'offres internationaux |
| AI-10 | S | Copilote global avec les garde-fous V3 |
| DATA-10 | M | Tableaux de bord agrégés avec seuils |
| SOIL-16 | C | Agrégation anonymisée par territoire |

### V5:NFR

| Réf. | Cible |
|---|---|
| V5:NFR-01 | Disponibilité 99,9 % API principale, SLO distinct API publique |
| V5:NFR-02 | Multi-zones, plan de reprise, exercices |
| V5:NFR-03 | p95 < 500 ms, CDN pour le public |
| V5:NFR-04 | Résidence des données par pays, isolation par countryCode |
| V5:NFR-05 | Audits, rotation des clés API, test d'intrusion annuel |
| V5:NFR-06 | Registre des traitements, contrats de finalité |
| V5:NFR-07 | Observabilité par pays |
| V5:NFR-08 | Suivi des coûts par pays et par client API |
| V5:NFR-09 | Chaînes externalisées, formats locaux |
| V5:NFR-10 | Revue juridique par pays avant activation |
