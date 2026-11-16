# Appels audio (LiveKit Cloud) — backend

État : **étape 1 (appels, backend) et étape 2 (push, backend) livrées, désactivées
par défaut.** Clients web et mobile : étapes suivantes (§8.3 et §8.4). Aucune
migration appliquée hors base de test, aucun déploiement ni activation générale.

## 1. Principes

- **Audio uniquement** : ni caméra, ni vidéo, ni partage d'écran, ni données.
- **Supabase Auth** reste l'unique authentification ; **PostgreSQL** l'unique
  source de vérité. **LiveKit Cloud transporte l'audio** et ne décide de rien.
- Toutes les autorisations sont décidées **côté serveur** à partir de l'identité
  Supabase vérifiée et des relations réelles (conversation, adhésions actives).
  Le client ne fournit **jamais** de nom de salle, de rôle, de statut ni de liste
  de participants autorisés : seulement la conversation et les personnes à inviter.
- **Aucun enregistrement, aucune transcription.** Le transport est chiffré
  (TLS / DTLS-SRTP) ; ce n'est **pas** un chiffrement de bout en bout : l'infra
  LiveKit a accès au flux.

## 2. Activation — règle de priorité unique

Le module est actif **si et seulement si les trois conditions** sont réunies :

| # | Condition | Où | Défaut |
|---|---|---|---|
| 1 | `CALLS_ENABLED=true` | variable d'environnement (hébergeur) | `false` |
| 2 | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` renseignés | variables d'environnement | vides |
| 3 | réglage `modules.appels` ≠ `false` | administration (palier 1) | actif |

- `CALLS_ENABLED=false` **l'emporte toujours** (interrupteur d'infrastructure).
- `modules.appels=false` coupe le module **sans redéploiement** (coupure rapide).
- Pas de contradiction silencieuse : `GET /calls/config` renvoie `enabled` et la
  liste `reasons` (`CALLS_ENABLED_FALSE`, `LIVEKIT_NOT_CONFIGURED`,
  `MODULE_DISABLED_BY_ADMIN`) ; au démarrage, `CALLS_ENABLED=true` sans LiveKit
  est signalé dans les journaux. Module inactif → `503 CALLS_UNAVAILABLE`.

Autres réglages : `CALL_TOKEN_TTL_SECONDS` (300), `CALL_RING_TIMEOUT_SECONDS` (45),
`CALL_MAX_PARTICIPANTS` (8, hôte compris).

## 3. Règles d'autorisation (service `src/modules/calls/calls.service.js`)

- L'appel naît dans une **conversation existante, `OPEN`**, dont l'organisation
  active de l'appelant est participante (bloquée/archivée → 409).
- Appelant **et chaque invité** : membres **ACTIFS** d'une organisation
  participante non supprimée, compte **ACTIF** (sinon 403 `INVITEE_NOT_ELIGIBLE`).
- Conférence : l'appelant **choisit** les invités parmi ces membres. Personne ne
  rejoint sans **invitation + vérification serveur + acceptation**.
- Un appel n'est visible que de ses participants (404 sinon).
- **Jeton LiveKit** : uniquement pour un participant ayant **accepté** (l'hôte
  dès la création), appel en cours ; admissibilité **revérifiée** à l'acceptation
  et à chaque jeton (conversation bloquée, adhésion retirée entre-temps).
- Écritures : compte vérifié exigé (`requireVerifiedForWrites`), permissions
  `calls.start` / `calls.join` (mêmes acteurs que la messagerie).

## 4. Jetons LiveKit (`src/integrations/livekit.js`)

Signés côté serveur avec le SDK officiel `livekit-server-sdk` (version épinglée) :
identité = identifiant Supabase ; durée `CALL_TOKEN_TTL_SECONDS` ; droits :
`roomJoin` sur **la** salle, `canPublishSources=[MICROPHONE]`, `canSubscribe`,
et **refus** de `canPublishData`, `roomAdmin`, `roomCreate`, `roomList`,
`roomRecord`, `ingressAdmin`, `hidden`, `recorder`, `agent`,
`canUpdateOwnMetadata`. Salle créée par le serveur (`maxParticipants`,
fermeture si vide) en mode « meilleur effort ».

## 5. Cycle de vie et concurrence

```
RINGING ─▶ ACTIVE ─▶ ENDED
   ├──▶ CANCELLED (hôte)   ├──▶ DECLINED (tous refusent)   └──▶ MISSED (sonnerie expirée)
Participant : INVITED ─▶ ACCEPTED ─▶ JOINED ⇄ LEFT ; INVITED ─▶ DECLINED | MISSED | CANCELLED
```

- Chaque transition est une mise à jour **conditionnelle** (état de départ +
  `version`) : deux requêtes simultanées ne peuvent pas appliquer deux
  transitions incompatibles ; la perdante répond de façon idempotente ou en 409.
- **Expiration** : paresseuse (à chaque lecture/action, fonctionne même avec
  `JOBS_ENABLED=false`) + tâche `calls.expireRinging` (chaque minute).
- **Création idempotente** : même appelant, même conversation, mêmes invités,
  sonnerie en cours → même appel (`replayed: true`).
- Fin automatique quand il reste moins de deux présents.

## 6. API et événements

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/v1/calls/config` | état d'activation (sans secret) |
| GET | `/api/v1/calls` | appels en cours de l'utilisateur |
| POST | `/api/v1/calls` | `{ conversationId, inviteeUserIds[] }` → `{ call, livekit:{url, token, expiresInSeconds} }` |
| GET | `/api/v1/calls/:id` | détail (participant seulement) |
| POST | `/api/v1/calls/:id/accept` | accepter → jeton |
| POST | `/api/v1/calls/:id/decline` | refuser |
| POST | `/api/v1/calls/:id/cancel` | annuler (hôte, pendant la sonnerie) |
| POST | `/api/v1/calls/:id/leave` | quitter |
| POST | `/api/v1/calls/:id/end` | terminer pour tous (hôte) |
| POST | `/api/v1/calls/:id/token` | nouveau jeton (rejoindre / reconnexion) |
| POST | `/api/v1/webhooks/livekit` | webhook LiveKit (signature) |

Temps réel (bus Socket.IO existant, salons `user:<id>`) : `call:incoming`,
`call:updated`. Notifications (service existant `notify`) : `call.incoming`,
`call.missed` (`IN_APP`). **Attention** : `REALTIME_ENABLED=false` en production
aujourd'hui → invitations non poussées en direct tant que le temps réel n'est pas
activé (journalisé au démarrage).

## 7. Webhook LiveKit

- URL à déclarer dans le projet LiveKit : `https://<api>/api/v1/webhooks/livekit`.
- Parseur **brut** dédié (`app.js`), posé **avant** le parseur JSON global
  (LiveKit envoie `application/webhook+json`) ; plafond 64 Ko.
- Vérification officielle `WebhookReceiver.receive` (JWT + SHA-256 du corps).
- **Déduplication durable** : `call_events` (unicité `source` + `externalId`),
  inscrite **dans la même transaction** que l'effet. `IdempotencyKey` ne suffit
  pas (expiration 24 h, conçue pour rejouer des réponses HTTP).
- Événements traités : `participant_joined`, `participant_left`, `room_finished`.
  Un participant non admis est **ignoré** (et journalisé), jamais promu.
- Journal : identifiants seulement — ni corps, ni en-tête `Authorization`, ni jeton.

## 8. Push et sonnerie application fermée

Une **notification générique ne suffit pas** à un appel entrant fiable : il
faut PushKit + CallKit sur iOS et un message FCM de données prioritaire avec
écran d'appel natif sur Android, donc des **builds natifs** (§8.4).

### 8.1 Backend (étape 2 — livré, désactivé)

- **Registre** `push_devices` (migration `20261116010000_push_devices`, RLS) :
  fournisseur `FCM` | `APNS` | `APNS_VOIP`, jeton unique par fournisseur,
  identifiant d'installation, révocation. API `/api/v1/me/push-devices`
  (`GET`, `POST`, `DELETE /:id`) : chacun ne gère que ses appareils ; jeton
  jamais renvoyé en clair (`tokenSuffix`) ; rotation (même installation → ancien
  jeton révoqué) ; transfert de propriétaire si un autre compte réenregistre le
  jeton ; plafond de 10 appareils actifs.
- **Canal `PUSH` de `notify()`** (aucun système parallèle) : préférences
  utilisateur respectées ; push envoyé seulement pour une notification
  nouvelle (déduplication).
- **Envoi** (`src/integrations/push.js`, bibliothèque standard uniquement) :
  FCM HTTP v1 (OAuth RS256 du compte de service) et APNs HTTP/2 (jeton ES256,
  renouvelé à 50 min). Jetons refusés définitivement (FCM 404/`UNREGISTERED`,
  APNs 410/`BadDeviceToken`/`DeviceTokenNotForTopic`) → **révoqués**.

| Genre | Android (FCM) | iOS jeton VoIP | iOS jeton classique |
|---|---|---|---|
| `APPEL_ENTRANT` | **données**, priorité HIGH, TTL = sonnerie | **VoIP** (`<bundle>.voip`, prio 10) | alerte **seulement** si l'installation n'a pas de jeton VoIP |
| `APPEL_TERMINE` (décroché/refusé ailleurs, annulé, fini, manqué) | données, priorité HIGH | **jamais** (interdit sans appel CallKit) | `background` (prio 5), au mieux |
| `NOTIFICATION` (appel manqué…) | notification + données | jamais | alerte |

- **Charge utile minimale** : `type`, `genre`, `callId`, `conversationId`,
  `kind`, `callerId`, `callerName` (affiché par l'écran d'appel natif, y compris
  sur l'écran verrouillé — à valider avec le porteur), `ringExpiresAt`. Jamais de
  nom de salle ni de jeton LiveKit : le client appelle `POST /calls/:id/accept`.
- **Variables** (noms seulement) : `PUSH_ENABLED` (défaut `false`),
  `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `APNS_TEAM_ID`,
  `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT`
  (`sandbox` | `production`). Contradiction (`PUSH_ENABLED=true` sans
  fournisseur complet) signalée au démarrage ; `GET /calls/config` expose
  `push: { android, iosVoip }` sans secret.
- **Limites connues** : arrêt de sonnerie iOS application fermée au mieux (la
  file `background` n'est pas garantie) → l'application doit, au réveil par
  VoIP, vérifier l'état par `GET /calls/:id` et terminer l'appel CallKit si
  l'appel n'est plus `RINGING`. Pas de file d'attente de réessai (envoi direct,
  « au mieux ») : à revoir si le volume l'exige.

### 8.2 Prérequis comptes (porteur, hors dépôt)

- **Firebase** : projet, application Android (identifiant de paquet), compte de
  service avec rôle d'envoi FCM → `FCM_*` saisis dans l'hébergeur.
- **Apple Developer** : App ID avec capacités *Push Notifications* et
  *Background Modes → Voice over IP*, clé APNs (.p8) → `APNS_*` saisis dans
  l'hébergeur. `sandbox` pour les builds de développement.

### 8.3 Mobile (Expo, étape 4 — livré, désactivé)

Code : `apps/Mobile/src/features/calls/`, entrée `apps/Mobile/index.js`,
configuration `apps/Mobile/app.config.ts`.

**Activation (double verrou).** Rien ne se charge sans les deux :
1. build natif produit avec `EXPO_PUBLIC_NATIVE_CALLS=true` — c'est ce drapeau
   qui ajoute les plugins natifs dans `app.config.ts` ; sans lui la
   configuration est strictement celle d'`app.json` et **Expo Go reste
   utilisable** (les appels y sont simplement masqués) ;
2. `GET /calls/config` → `enabled: true` (règle du §2).

Les modules natifs sont chargés paresseusement et protégés (`native.ts`) : en
Expo Go, sur le web ou sans le drapeau, toutes les fonctions renvoient `null`.

**Dépendances (versions exactes, publiées depuis au moins deux semaines)** :
`livekit-client` 2.23.0, `@livekit/react-native` 3.1.0,
`@livekit/react-native-webrtc` 150.1.1, `@livekit/react-native-expo-plugin`
1.1.0, `@config-plugins/react-native-webrtc` 15.0.2, `react-native-callkeep`
4.6.1, `@config-plugins/react-native-callkeep` 14.0.2,
`react-native-voip-push-notification` 3.3.3, `@react-native-firebase/app` et
`/messaging` 26.4.1, `expo-dev-client` 58.0.18.

| Élément | Fichier | État |
|---|---|---|
| Audio LiveKit (micro seul, session audio native) | `useCalls.ts` | écrit, **non exécuté sur appareil** |
| Bandeau d'appel (répondre, refuser, micro, raccrocher, erreurs) | `CallOverlay.tsx` | écrit, typé |
| Bouton « Appel audio » + choix des invités (`/calls/eligible`) | `CallButton.tsx` | écrit, typé |
| Jetons push → `POST /me/push-devices`, retrait à la déconnexion | `pushDevices.ts`, `store/auth.ts` | écrit, **non exécuté sur appareil** |
| Android application fermée : FCM *data* → écran d'appel natif (ConnectionService via CallKeep) | `background.ts`, `systemCall.ts` | écrit, **non exécuté sur appareil** |
| Choix des jetons, lecture des push, UUID CallKit | `pushPlan.ts` | **testé** (`npm test`) |
| iOS application fermée : PushKit → CallKit | — | **raccord natif à écrire** (ci-dessous) |

**iOS — raccord natif restant (bloquant pour l'iOS application fermée).**
Apple impose de signaler **chaque** push VoIP à CallKit dans le délégué
PushKit natif, avant de rendre la main ; sinon iOS termine l'application et
cesse de livrer les push VoIP. Ce signalement ne peut pas être fait depuis
JavaScript. Il faut un petit plugin de configuration (ou module Expo) qui, dans
l'AppDelegate : enregistre `PKPushRegistry` au démarrage, et dans
`pushRegistry(_:didReceiveIncomingPushWith:for:completion:)` appelle
`RNCallKeep.reportNewIncomingCall(...)` avec l'UUID dérivé de `callId`
(même algorithme que `uuidDepuisAppel`) puis
`RNVoipPushNotificationManager.didReceiveIncomingPush(...)`. Ce code doit être
compilé et testé sur un build EAS iOS ; il n'a pas été écrit à l'aveugle.
**Garde-fou** : tant que le build n'est pas construit avec
`EXPO_PUBLIC_IOS_VOIP_READY=true`, l'application ne déclare **aucun** jeton
`APNS_VOIP` ; le serveur utilise alors le repli « alerte » APNs (pas de
sonnerie CallKit application fermée sur iOS, mais aucun risque de blocage).

**Comptes et fichiers (porteur, hors dépôt)** : projet Firebase (fichiers
`google-services.json` / `GoogleService-Info.plist` fournis à EAS en variables
de type fichier `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST`), clé APNs
(.p8) côté serveur seulement, compte Apple Developer avec capacité Push.
Android 14+ : justification Play Store de `USE_FULL_SCREEN_INTENT`.

### 8.4 Web (étape 3 — livré, désactivé)

Code : `apps/web/src/features/calls/`. Bouton dans `pages/app/Conversation.tsx`,
bandeau global dans `AppLayout`.

- `livekit-client` 2.23.0 chargé **à la demande** (chunk `vendor-livekit`,
  ≈ 140 ko gzip, téléchargé seulement en rejoignant un appel).
- Audio seulement (`setMicrophoneEnabled`), aucune caméra.
- Sonnerie générée (Web Audio) quand l'onglet est ouvert ; le navigateur peut
  la bloquer tant que la page n'a pas reçu d'interaction.
- Temps réel : client Socket.IO `call:incoming` / `call:updated` ; comme
  `REALTIME_ENABLED=false` en production aujourd'hui, **repli par
  interrogation de `GET /calls` toutes les 15 s** (onglet visible). Une
  invitation peut donc apparaître avec jusqu'à 15 s de retard sans temps réel.
- Pas de sonnerie onglet fermé (Web Push hors périmètre).
- Tests : `apps/web/tests/calls-machine.test.ts` (12 tests, vitest).

### 8.5 Tests clients requis (sur appareils réels)

| Scénario | Android | iOS |
|---|---|---|
| Appel entrant, application au premier plan | ✓ | ✓ |
| Appel entrant, arrière-plan | ✓ | ✓ |
| Appel entrant, application **tuée** / téléphone verrouillé | ✓ | ✓ (CallKit) |
| Décroché sur un appareil → les autres arrêtent de sonner | ✓ | ✓ (au mieux) |
| Appelant annule pendant la sonnerie | ✓ | ✓ |
| Sonnerie expirée → appel manqué + notification | ✓ | ✓ |
| Refus de la permission micro → message clair, aucun appel ouvert | ✓ | ✓ |
| Coupure réseau / passage 4G↔Wi-Fi pendant l'appel → reconnexion | ✓ | ✓ |
| Bluetooth / écouteurs / haut-parleur | ✓ | ✓ |
| Mode économie d'énergie, constructeurs (Tecno, Infinix, Samsung…) | ✓ | — |
| Jeton révoqué (désinstallation) → révocation en base | ✓ | ✓ |
| Appel en cours + appel GSM entrant | ✓ | ✓ |

## 9. Réseau au Kwilu

**Aucune mesure disponible.** Avant tout pilote : essais terrain (plusieurs
opérateurs, heures, téléphones réels), mesure d'établissement d'appel, coupures,
qualité perçue, consommation de données. Prévoir le repli TURN/TLS (443) proposé
par LiveKit pour les réseaux qui bloquent l'UDP. **Aucune région ni aucun coût
LiveKit n'est présumé** sans ces données.

## 10. Configuration manuelle (pilote uniquement)

1. Créer un projet LiveKit **de test** (distinct de la production).
2. Saisir dans l'hébergeur (jamais dans le dépôt) : `LIVEKIT_URL`,
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. Déclarer l'URL du webhook (§7) dans le projet LiveKit.
4. Appliquer les migrations `20261116000000_audio_calls` et
   `20261116010000_push_devices` (manuellement, jamais dans la commande de
   build), sur un environnement de test d'abord — **après validation du porteur**.
5. Activer le temps réel (`REALTIME_ENABLED=true`) — prérequis de la sonnerie.
6. Push : saisir `FCM_*` / `APNS_*` (§8.2) puis `PUSH_ENABLED=true` pour le
   pilote ; vérifier `GET /calls/config` → `push`.
7. `CALLS_ENABLED=true` pour le pilote seulement ; coupure : `modules.appels=false`
   (immédiat) ou `CALLS_ENABLED=false` (redéploiement).

## 11. Tests

- `tests/calls.test.mjs` : transitions, priorité d'activation, droits audio-only,
  jeton réel signé/vérifié, entrée client stricte, câblage.
- `tests/e2e/calls.e2e.test.mjs` : PostgreSQL embarqué + LiveKit simulé —
  autorisations, concurrence, refus/annulation/manqué/fin, webhooks signés,
  rejeu, notifications, RLS.
- `tests/push.test.mjs` : jetons OAuth RS256 / APNs ES256 vérifiables (clés
  générées), messages FCM, requêtes APNs (VoIP, alerte, arrière-plan), plan
  d'envoi par appareil, révocation, configuration, entrée stricte.
- `tests/e2e/push.e2e.test.mjs` : transport FCM/APNs simulé — enregistrement
  masqué, appel entrant (FCM données + VoIP), arrêt de sonnerie sans VoIP,
  préférence respectée, révocation 404/410, appel manqué, rotation et transfert.
- `npm run check:migrations` : RLS et absence de privilèges sur les nouvelles tables.
- **Reportés** (secrets de test indisponibles) : LiveKit Cloud réel (salle,
  webhook, qualité audio), envois FCM et APNs réels, tous les tests §8.5.
