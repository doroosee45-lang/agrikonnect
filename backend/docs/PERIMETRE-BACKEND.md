# Périmètre du backend

**Ce document dit ce qui est fait, ce qui n'a pas été fait, et ce qui ne peut
pas être fait ici.**

Il existe parce qu'un backend qui démarre sans erreur ne prouve pas qu'il est
complet. Chaque section nomme l'état réel, pas l'intention.

> ## Jamais testé avec un vrai compte Twilio ni un vrai téléphone
>
> Toute la chaîne SMS — envoi, segmentation, accusés de remise, correspondance
> des codes d'erreur, signature des webhooks — est couverte par des recettes
> automatisées qui parlent à un **faux serveur HTTP local**. Ces recettes
> prouvent que le code fait ce qu'il annonce ; elles ne prouvent **pas** qu'un
> message traverse un opérateur congolais.
>
> Aucun compte Twilio réel n'a été utilisé. Aucun téléphone n'a reçu de message.
> Tant que la procédure de `docs/SMS-OTP-TEST-REEL.md` n'a pas été menée à son
> terme, le canal SMS **n'est pas validé en conditions réelles** et ne doit pas
> être présenté comme tel.

---

## 1. Ce qui est fait

### Authentification et comptes

- Inscription, connexion, jetons de session, rôles (`profiles` + `Membership`),
  garde `organizationId` sur toutes les routes métier.
- Vérification du numéro de téléphone par code OTP : envoi, durée de vie,
  tentatives, plafond horaire, vérification. Durcis depuis :
  format **E.164 vérifié avant tout envoi** (un numéro mal formé soumis à
  Twilio est refusé **et facturé**), **double plafond horaire** — par numéro
  *et* par utilisateur, le premier seul ne bornant rien contre un compte qui
  vise des numéros différents —, **numéro confirmé = numéro du profil**, et un
  numéro déjà rattaché à un autre compte renvoie **409** au lieu d'une erreur
  interne. Durée de vie, tentatives et plafonds **inchangés**.
  Couvert par `tests/e2e/otpVerification.e2e.test.mjs` (10).
- MFA par application d'authentification, codes de secours, MFA par e-mail.
  **Non vérifié avec une vraie application d'authentification** : la recette
  simule l'OTP TOTP, elle ne prouve pas l'interopérabilité avec Google
  Authenticator ou Authy.

### Données métier

- 44 modules, **385 routes**, 8 modèles géospatiaux, calendriers culturaux par
  province (**Équateur et Bandundu uniquement**).
- Plages agronomiques (`CropAgronomicRange`) avec un type de source explicite :
  « A choisir », « Agronome », « Publication », « Pilote ». **Une importation ne
  produit jamais une plage validée** : seule la route de validation explicite le
  peut.
- Moteur de recommandation : sans plage validée, il refuse d'évaluer le critère
  (« critère non évalué ») et étiquette toute recommandation issue de plages
  provisoires comme **indicative**.

### Alertes

- Alertes de seuil, de prévision et de silence de capteur, unifiées dans un seul
  modèle ; ré-notification après 24 h ; filtres et métadonnées exposés.
- **Escalade à deux niveaux** (`ALERT_ESCALATION_*`) : une alerte `NEW` ou
  `READ` non traitée après le délai est renvoyée aux rôles d'escalade. Le délai
  court depuis `notifiedAt` et **non** depuis la dernière re-notification —
  sinon une re-notification repousserait l'escalade indéfiniment. La
  réservation est **atomique avant l'envoi** : deux exécutions concurrentes ne
  produisent qu'une seule escalade. Un échec d'envoi ramène l'alerte au niveau 1
  pour réessai. `HANDLED` n'escalade pas.
  Couvert par `tests/e2e/alertEscalation.e2e.test.mjs` (9).
- Journal de lot SMS : candidat, envoyé, **retenu avec sa raison**, échoué,
  segments.

### Envoi SMS

- Garde-fous, dans l'ordre : numéro absent → **numéro non vérifié** →
  consentement → préférence de notification → **fenêtre de silence** → plafond
  quotidien. Un envoi retenu ne consomme **pas** de quota : le contrôle est
  placé avant le compteur quotidien.
- **Fenêtre de silence** (`SMS_QUIET_*`) : aucune alerte ne part la nuit. La
  plage traverse minuit, le fuseau est configurable, un fuseau inconnu **fait
  échouer l'envoi** plutôt que de retomber sur l'heure du serveur. Les **OTP ne
  sont jamais retenus** — un code bloqué la nuit rendrait la connexion
  impossible.
- **`PHONE_UNVERIFIED`** : une alerte ne part que vers un numéro confirmé par
  son titulaire (`phoneVerifiedAt`), et seulement si ce numéro est bien celui du
  profil. Le canal est à sens unique en RDC — aucun « STOP » par SMS n'est
  possible — donc une alerte partie vers un mauvais numéro ne peut pas être
  rattrapée.
- Le **code OTP passe par le même chemin** : enregistrement dans `sms_messages`,
  plafond quotidien, suivi de remise. Sa durée de vie, son nombre de tentatives
  et son plafond horaire sont **inchangés**.
- Intégration Twilio : identifiant alphanumérique, authentification Basic jamais
  journalisée, webhook à signature vérifiée, accusés de remise.
- **Correspondance des erreurs Twilio** : les codes 20003, 21211, 21608, 21612,
  21614, 30003, 30005, 30006, 30007 et 63016 donnent un message en français avec
  la cause probable et l'action à mener, stocké dans `sms_messages.errorMessage`
  et renvoyé par `/sms/test-send`. Un échec définitif n'est pas rejoué.
- **Validation de configuration au démarrage** : `SMS_PROVIDER=twilio` avec un
  secret manquant, un SID qui ne commence pas par `AC`, ou un identifiant
  d'expéditeur non conforme **empêche le démarrage**. Une URL de rappel en
  `localhost` avertit sans bloquer.
- **`npm run sms:verifier-config`** : interroge le compte Twilio en lecture seule
  (identifiants, compte d'essai ou payant, solde, numéros, RDC autorisée, URL de
  rappel) sans envoyer de SMS, et sans jamais afficher un secret.

**Jamais testé avec un vrai compte Twilio ni un vrai téléphone.**

### Dépôt géospatial

- Réception au statut `RECEIVED`, détection de format par signature magique,
  empreinte anti-doublon, clé de stockage construite côté serveur, nom assaini.
- **Quota de dépôt transactionnel.** Le contrôle précédent lisait la somme
  stockée puis créait la ligne : deux dépôts concurrents lisaient la même somme
  et passaient tous les deux. Le compteur est maintenant incrémenté **dans la
  transaction du dépôt**, ce qui verrouille la ligne et sérialise les dépôts
  concurrents. Couvert par un test de concurrence réel
  (`tests/e2e/geospatialQuota.e2e.test.mjs`).

### Surface de l'API et routes sans appelant

Les **385 routes** ont été interrogées **sans jeton** sur le serveur démarré.
Une seule famille répond 2xx : les 11 routes publiques assumées (racine,
documentation, `/health`, vitrine `/public/*`, référentiels dont la permission
est `EVERYONE`, et `POST /auth/resend-verification` qui répond 200 même pour une
adresse inconnue afin de ne pas révéler les comptes existants). Les 355 autres
exigent un jeton (401), 4 refusent par permission (403), 10 renvoient une
validation (422). **Aucun 5xx.**

La carte complète des 385 statuts est figée dans
`tests/e2e/fixtures/surface-anonyme.json` et rejouée à chaque exécution par
`tests/e2e/surfacePublique.e2e.test.mjs` : une route ajoutée sans
`authenticate`, ou une permission élargie par erreur, fait échouer la suite.
Deux contre-épreuves vérifient que ce garde-fou mord réellement.

Les **108 routes sans appelant client** sont classées une par une, avec la
preuve, dans **`docs/ROUTES-SANS-APPELANT.md`**. Aucune n'a été supprimée.

---

## 2. État réel des anciens « hors périmètre »

Six éléments figuraient ici comme absents. **Cinq sont désormais implémentés et
couverts par des recettes** ; le sixième était **mal décrit**. Le tableau dit ce
qui est vrai aujourd'hui, avec la preuve.

| Élément | État réel | Preuve |
|---|---|---|
| **Adaptateurs satellite** | ⚠️ **La ligne précédente était fausse.** `src/integrations/satellite.js` contient **quatre** fournisseurs (`sentinelhub`, `earthengine`, `webhook`, `simulated`), dont trois font de vrais appels `fetch` avec jeton Bearer, plus `requireRealConfig`, une normalisation stricte et des reprises. Le mode simulé est séparé et interdit en production. **Ce qui manque vraiment :** `sentinelhub` et `earthengine` envoient le **même contrat générique** vers la même `SATELLITE_API_URL` — aucun des deux ne parle le protocole réel de son fournisseur (API statistique Sentinel Hub, Earth Engine). | Lecture du fichier ; aucun appel réel exécuté faute d'identifiants. |
| **Traitement des fichiers géospatiaux** | **Implémenté.** Lecture des en-têtes uniquement, aucun pixel décodé, idempotence par réservation atomique, empreinte revérifiée, `force=true` explicite, erreur enregistrée au lieu d'un 500. Jamais lancé à la réception : le dépôt rend `201` au statut `RECEIVED`. | `geospatialProcessing.service.js`, `tests/e2e/geospatialUpload.e2e.test.mjs` |
| **Envoi multipart** | **Implémenté et exécuté.** Authentification avant toute lecture de corps, plafond appliqué **pendant** la lecture du flux, aucun parseur Express sur ce chemin, routes fixes déclarées avant `/:id`. | `src/shared/multipart.js`, `tests/multipartS3.test.mjs` (22), `tests/e2e/geospatialUpload.e2e.test.mjs` (11) |
| **Stockage objet compatible S3** | **Pilote écrit et vérifié en unité, jamais exercé contre un vrai stockage.** La signature SigV4 reproduit à l'octet le vecteur officiel AWS `get-vanilla` et le hash de requête canonique « GET Object ». Aucun bucket réel n'a reçu d'octet. | `src/shared/storage.js` (`creerStockageS3`), `tests/multipartS3.test.mjs` |
| **Alertes à deux niveaux** | **Implémenté.** Réservation atomique avant envoi, délai compté depuis `notifiedAt`, retour au niveau 1 en cas d'échec, `HANDLED` non escaladé, isolation par organisation. | `alertEscalation.service.js`, `tests/e2e/alertEscalation.e2e.test.mjs` (9) |
| **Fenêtre horaire des SMS** | **Implémenté**, configurable, traversée de minuit gérée, fuseau inconnu **refusé** plutôt que remplacé par l'heure du serveur. Ne s'applique qu'aux alertes : **les OTP ne sont jamais retenus.** | `src/shared/quietHours.js`, `tests/quietHours.test.mjs` (9) |

### Ce qui reste absent, pour de bon

- **Aucun appel satellite réel n'a été exécuté**, faute de fournisseur et
  d'identifiants. Les deux contrats spécifiques restent à écrire.
- **Aucun octet n'est jamais parti vers un bucket S3 réel.**
- **Aucun SMS réel n'a été livré.**

### Limitations connues, assumées

- **`/sms/test-send` échappe au contrôle du numéro vérifié.** C'est la seule
  exception, elle est réservée aux administrateurs (`sms.send`), et son rôle est
  justement de sonder un opérateur sur un numéro arbitraire. Toute alerte réelle
  passe par `sendAlertBatch`, qui ne lève pas cette garde.
- **Aucune résolution du fuseau par destinataire.** La RDC couvre deux fuseaux
  (Kinshasa UTC+1, Lubumbashi UTC+2) ; `Profile` n'a pas de champ `timezone` et
  seul `Country` en porte un. Toute la RDC est donc traitée au fuseau configuré
  dans `SMS_DEFAULT_TIMEZONE`. C'est documenté dans le code, pas caché.
- **Un OTP sans locataire résolu part hors journal.** `sms_messages` exige une
  organisation ; si aucune adhésion ne peut être résolue, l'envoi a lieu quand
  même — refuser un code de vérification bloquerait l'accès au compte — et un
  avertissement est journalisé. En pratique `register()` crée toujours une
  adhésion, donc ce chemin ne devrait pas être atteint.
- **`client_max_body_size 2m`** dans la configuration de production documentée
  **casserait un dépôt de 64 Mo**. À relever avant tout déploiement réel.
- Le plafond de débit fournisseur en production (30/min) n'a jamais été exercé.

---

## 3. Ce qui dépend de l'utilisateur

Rien de ce qui suit ne peut être fait depuis cet environnement.

### Plages validées par un agronome

Le formulaire agronome **n'a pas été rempli**. Il n'existe donc **aucune plage
validée** dans le système, et **toutes les recommandations restent indicatives**.
Ce n'est pas un défaut de code : c'est l'absence d'une décision métier que seul
un agronome peut prendre. Le statut « indicatif » restera partout tant que la
validation explicite n'aura pas été faite, route par route, province par
province.

### SMS réel

**Aucun SMS réel n'a été livré.** Toutes les recettes utilisent un fournisseur
simulé ou un faux serveur HTTP. Restent à vérifier avec un vrai compte et un
vrai téléphone en RDC :

- la remise effective par Airtel, Vodacom et Orange ;
- la préservation de l'identifiant alphanumérique ;
- la réception des accusés de remise sur le webhook public ;
- **un écart de documentation à trancher** : la page officielle Twilio indique
  que la pré-inscription d'identifiant alphanumérique n'est **pas requise** en
  RDC, alors que des sources tierces la disent requise pour Vodacom. À vérifier
  avant l'usage réel.
- les identifiants numériques ne sont **pas** pris en charge par Airtel : seul
  l'alphanumérique est fiable.

### Essai sur Supabase réel

Toute la recette tourne sur un PostgreSQL embarqué. Avec un Supabase réel
restent à vérifier : l'authentification de bout en bout, les e-mails réellement
reçus (le corps des e-mails n'est pas vérifiable ici), le comportement de la
clé `service_role`, et les migrations appliquées dans l'ordre sur une base
réelle.

---

## 4. Ce qui n'est pas vérifié du tout

À lire comme une liste de dettes, pas comme un avertissement de forme.

- **Aucun écran n'a été rendu par un navigateur ou un simulateur.** Cartes,
  filtres, compteurs, pastilles, mention « provisoire », états vides,
  pagination, gestes mobiles et `accessibilityRole` : le code TypeScript compile,
  rien n'a été vu.
- Les contrastes de couleurs sont **calculés**, pas mesurés sur écran.
- Le démarrage complet (`scripts/demarrer-local.sh`) n'a jamais été exécuté de
  bout en bout.
- Le QR code mobile n'est pas vérifié.
- 104 routes n'ont aucun appelant côté client.
- Les captures d'écran de référence (P1) n'existent pas : toute affirmation
  d'absence de régression visuelle reste une affirmation non prouvée.
