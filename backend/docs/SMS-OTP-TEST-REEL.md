# Tester les SMS et l'OTP avec un vrai téléphone

**Ce document décrit une procédure à exécuter hors de cet environnement.** Rien
de ce qui suit n'a été réalisé ici : aucun SMS réel n'a été livré, aucun retour
fournisseur n'a été observé. Les recettes automatisées utilisent un fournisseur
simulé ou un faux serveur HTTP. Cette page dit exactement quoi faire, quoi
envoyer, et quoi regarder pour transformer « le code est écrit » en « le SMS est
arrivé ».

Tant qu'aucune étape ci-dessous n'a été menée à son terme, **le parcours réel
n'est pas validé** et ne doit pas être présenté comme tel.

---

## 0. Prérequis

### Variables d'environnement

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<auth-token>          # sert AUSSI à signer les webhooks
TWILIO_SENDER_ID=AGRIKONNECT            # 11 caractères max, au moins une lettre
SMS_ALERT_PURPOSE=ALERT
SMS_DEFAULT_TIMEZONE=Africa/Kinshasa
SMS_QUIET_HOURS_ENABLED=true            # à laisser activé pour un test de nuit
SMS_QUIET_START=21:00
SMS_QUIET_END=06:00
```

`TWILIO_SENDER_ID` : l'identifiant alphanumérique est limité à **11 caractères**,
ASCII, chiffres et espaces, avec **au moins une lettre** — jamais de chiffres
seuls. Les identifiants **numériques ne sont pas pris en charge par Airtel**.
`validateSenderId` refuse un identifiant non conforme avant l'envoi.

### Webhook d'accusé de remise

Le webhook doit être **public et en HTTPS** : Twilio doit pouvoir l'appeler
depuis Internet. En local, il faut donc un tunnel. Deux solutions sont décrites
ci-dessous, avec les commandes exactes pour **Windows** (PowerShell ou invite de
commandes — les deux outils sont des exécutables, aucun shell particulier n'est
requis).

> **Honnêtement :** ces commandes n'ont **pas été exécutées** dans
> l'environnement où ce dépôt a été préparé, qui est Linux et sans accès sortant.
> Elles sont écrites d'après la documentation des deux outils. Ce qui **est**
> vérifié par une recette automatisée, c'est que le backend utilise bien l'URL
> configurée pour valider la signature
> (`tests/e2e/twilioWebhookUrl.e2e.test.mjs`) : une signature calculée sur l'URL
> publique est acceptée, une signature calculée sur l'URL locale est refusée.

#### Option A — ngrok

```powershell
# Installation (au choix)
winget install --id Ngrok.Ngrok
# ou : choco install ngrok
# ou : scoop install ngrok

# Un compte gratuit est requis : copier le jeton depuis https://dashboard.ngrok.com
ngrok config add-authtoken <TON_JETON_NGROK>

# Ouvrir un tunnel vers le backend local (port 4000)
ngrok http 4000
```

ngrok affiche alors une ligne `Forwarding  https://abcd-1234.ngrok-free.app -> http://localhost:4000`.
**C'est cette URL qu'il faut copier.**

Dans `.env` :

```bash
TWILIO_WEBHOOK_BASE_URL=https://abcd-1234.ngrok-free.app
TWILIO_STATUS_CALLBACK_URL=https://abcd-1234.ngrok-free.app/api/v1/webhooks/twilio/status
```

Attention : avec un compte gratuit, **l'URL change à chaque redémarrage** du
tunnel. Il faut alors mettre à jour `.env` **et** la console Twilio, puis
redémarrer le backend. Un domaine réservé (compte payant) évite cette contrainte.

#### Option B — cloudflared (pas de compte requis pour un tunnel rapide)

```powershell
# Installation (au choix)
winget install --id Cloudflare.cloudflared
# ou : choco install cloudflared

# Tunnel rapide : aucune authentification, aucune configuration
cloudflared tunnel --url http://localhost:4000
```

cloudflared affiche `Your quick Tunnel has been created! Visit it at
https://quelque-chose-de-long.trycloudflare.com`. Copier cette URL.

Dans `.env` :

```bash
TWILIO_WEBHOOK_BASE_URL=https://quelque-chose-de-long.trycloudflare.com
TWILIO_STATUS_CALLBACK_URL=https://quelque-chose-de-long.trycloudflare.com/api/v1/webhooks/twilio/status
```

#### Puis, dans la console Twilio

Sur le numéro émetteur, renseigner **Messaging → Status Callback** avec :

```
https://<ton-tunnel>/api/v1/webhooks/twilio/status
```

#### Vérifier que tout est cohérent

```powershell
npm run sms:verifier-config
```

La commande affiche l'URL de rappel retenue et l'URL exacte à coller chez
Twilio. Si l'URL pointe encore vers `localhost`, un avertissement le dit — le
démarrage n'est pas bloqué, mais aucun accusé de remise n'arrivera.

Deux pièges connus :

- derrière un proxy, il faut honorer `X-Forwarded-Proto` et `X-Forwarded-Host`,
  sinon l'URL reconstruite pour la vérification de signature est fausse et
  **toutes** les signatures échouent ;
- si le corps arrive en JSON, Twilio ajoute `bodySHA256` : la signature se
  calcule alors sur le **corps brut**, jamais sur une resérialisation.

### Vérifier la configuration avant d'envoyer

```bash
npm run sms:verifier-config
```

Cette commande interroge le compte Twilio en **lecture seule** — elle n'envoie
aucun SMS — et affiche :

- si les identifiants sont acceptés ;
- si le compte est un **essai** (Trial) ou payant : décisif, car un compte
  d'essai ne joint que les numéros vérifiés ;
- le solde, si l'API le renvoie ;
- les numéros du compte (sur un compte d'essai, les seuls joignables) ;
- si la **République démocratique du Congo** fait partie des destinations
  autorisées — la faute la plus fréquente sur un compte neuf, qui fait échouer
  chaque envoi en `63016` ;
- l'URL de rappel retenue, et l'URL exacte à coller dans la console Twilio.

Le code de sortie vaut **1** si quelque chose empêche l'envoi. Les secrets
n'apparaissent jamais dans la sortie, même tronqués : le jeton n'est pas imprimé,
et le SID l'est tronqué (`AC01…cdef`).

```powershell
npm run email:verifier-config
```

Même principe pour l'e-mail : la clé est testée en lecture seule, et la commande
vérifie que le domaine de `EMAIL_FROM` est bien vérifié chez Resend ou SendGrid —
sans cela, l'envoi est refusé en 403 et l'utilisateur ne reçoit jamais son lien.

### Le démarrage refuse une configuration qui ne peut pas fonctionner

Depuis cette version, `SMS_PROVIDER=twilio` avec un secret manquant **empêche le
démarrage** au lieu de démarrer sans bruit. Les cas bloquants :

| Cas | Message |
| --- | --- |
| `TWILIO_ACCOUNT_SID` absent | nomme la variable et où la trouver |
| SID qui ne commence pas par `AC` | signale la cause probable : l'Auth Token collé à la place |
| `TWILIO_AUTH_TOKEN` absent | rappelle qu'il sert aussi à signer les webhooks |
| `TWILIO_SENDER_ID` absent ou non conforme | redonne les règles (11 caractères, une lettre au moins) |
| `TWILIO_FALLBACK_FROM` non E.164 | nomme le format attendu |
| `EMAIL_PROVIDER=resend` ou `sendgrid` sans `EMAIL_API_KEY` | explique que l'inscription restera bloquée |

Les cas **non bloquants**, signalés par un avertissement :

- `TWILIO_WEBHOOK_BASE_URL` ou `TWILIO_STATUS_CALLBACK_URL` en `localhost` —
  Twilio ne peut pas rappeler une adresse locale, mais c'est un choix légitime en
  développement ;
- aucune URL de rappel configurée ;
- `TWILIO_FALLBACK_FROM` renseigné — le repli numérique est rappelé, avec la
  limite Airtel.

Pour démarrer localement sans fournisseur, utiliser `SMS_PROVIDER=console` et
`EMAIL_PROVIDER=console` : les messages s'écrivent dans les journaux.

### Vérifier que le serveur tourne

```bash
curl -s localhost:4000/api/v1/health
```

Si `SMS_PROVIDER` vaut encore `console`, les SMS s'écrivent dans les journaux au
lieu de partir. C'est le défaut le plus fréquent.

---

## 1. Parcours OTP complet

C'est le parcours à mener en premier : il ne dépend ni du consentement ni des
préférences de notification, et il prouve à la fois l'envoi, la réception du
code et la confirmation sur le profil.

### 1.1 Créer un compte

```bash
BASE=http://localhost:4000/api/v1
MON_NUMERO=+243XXXXXXXXX          # ton numéro réel, format E.164

curl -s -X POST "$BASE/auth/register" \
  -H 'content-type: application/json' \
  -d "{
    \"accountType\": \"FARMER\",
    \"firstName\": \"Test\",
    \"lastName\": \"Reel\",
    \"email\": \"test-reel@example.com\",
    \"password\": \"MotDePasse!2026\",
    \"countryCode\": \"CD\",
    \"locale\": \"fr\",
    \"phone\": \"$MON_NUMERO\"
  }"
```

### 1.2 Se connecter

```bash
JETON=$(curl -s -X POST "$BASE/auth/login" \
  -H 'content-type: application/json' \
  -d '{"identifier":"test-reel@example.com","password":"MotDePasse!2026"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["session"]["accessToken"])')
```

### 1.3 Demander le code

```bash
curl -s -X POST "$BASE/auth/send-otp" \
  -H "authorization: Bearer $JETON" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$MON_NUMERO\"}"
```

**Le SMS doit arriver sur le téléphone.** La réponse contient `expiresInMinutes`,
qui est la durée de vie réelle configurée, et — **hors production seulement** —
`devCode`. En production ce champ est absent : le code ne sort jamais de la
base.

À observer :

- délai de réception réel ;
- l'identifiant d'expéditeur affiché (préservé ou remplacé ?) ;
- la longueur du message et son découpage (le code tient sur un segment).

### 1.4 Confirmer le numéro

```bash
curl -s -X POST "$BASE/auth/verify-phone" \
  -H "authorization: Bearer $JETON" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$MON_NUMERO\",\"code\":\"123456\"}"
```

Réponse attendue : `{"verified": true}`. Le profil porte alors
`phoneVerifiedAt`.

### 1.5 Ce qu'il faut aussi vérifier, et qui échoue volontairement

| Essai | Requête | Réponse attendue |
|---|---|---|
| Code rejoué | même `verify-phone` une seconde fois | refus (code à usage unique) |
| Numéro mal formé | `send-otp` avec `0810000000` | **422**, et **rien ne part chez Twilio** |
| Code expiré | attendre la fin de la durée de vie | refus |
| 5 codes erronés | 5 × `verify-phone` avec un faux code | **429** au-delà du 5ᵉ |
| Autre numéro que celui du profil | `send-otp` puis `verify-phone` sur un 2ᵉ numéro | **422** « Le code ne correspond pas au numéro du profil » |
| Numéro d'un autre compte | vérifier un numéro déjà rattaché | **409** |
| 6ᵉ demande dans l'heure | `send-otp` répété | **429** — plafonds par numéro **et** par utilisateur |

Chacun de ces comportements est couvert par une recette automatisée
(`tests/e2e/otpVerification.e2e.test.mjs`, 10 tests). Ce que la recette ne peut
**pas** prouver, c'est que le message traverse réellement le réseau congolais.

### 1.6 Cohérence base ↔ journaux

Après l'envoi, vérifier que la base raconte la même histoire que le téléphone :

```bash
curl -s "$BASE/sms/messages?limit=5" -H "authorization: Bearer $JETON"
```

La réponse a la forme `{"data":{"items":[…],"total":n},"meta":{…}}`. Un
enregistrement `sms_messages` doit exister, avec `purpose: "OTP"`, un statut qui
évolue (`QUEUED_LOCALLY` → `SENT` → `DELIVERED` une fois l'accusé reçu), et
**jamais** le code en clair.

---

## 2. Envoi d'alerte vers un numéro arbitraire

`POST /sms/test-send` est la **seule** route exemptée du contrôle du numéro
vérifié. Elle est réservée aux administrateurs (permission `sms.send`) et sert
précisément à sonder un opérateur sur un numéro arbitraire.

```bash
curl -s -X POST "$BASE/sms/test-send" \
  -H "authorization: Bearer $JETON_ADMIN" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$MON_NUMERO\",\"body\":\"Test AGRIKONNECT — ignorer.\",\"purpose\":\"ALERT\"}"
```

Corps limité à 480 caractères ; au-delà d'un segment, la réponse annonce le
nombre de segments (160 en GSM-7, 70 en UCS-2 — un accent fait basculer tout le
message en UCS-2).

### Le garde-fou qu'il ne faut PAS contourner

Pour tester une **alerte réelle** — c'est-à-dire le chemin `sendAlertBatch` —
il faut que le numéro soit **vérifié**, que le **consentement** soit donné et
que la **préférence de notification** soit activée. Lever ces garde-fous pour
aller plus vite invaliderait le test : ce sont précisément eux qu'il s'agit de
vérifier.

```bash
# 1. vérifier le numéro (parcours §1)

# 2. donner son consentement SMS pour l'usage « ALERT »
curl -s -X POST "$BASE/sms/consent" \
  -H "authorization: Bearer $JETON" -H 'content-type: application/json' \
  -d '{"purpose":"ALERT"}'
# → 201 « Consentement SMS enregistré ». Permission requise : sms.consent.
# La désinscription est `DELETE /sms/consent` avec le même corps.

# 3. activer le canal SMS dans les préférences de notification
curl -s -X PUT "$BASE/notifications/preferences" \
  -H "authorization: Bearer $JETON" -H 'content-type: application/json' \
  -d '{"preferences":[{"type":"ALERT","channel":"SMS","enabled":true}]}'
# → « Préférences enregistrées ». Permission requise : notifications.write.
# `preferences` est un TABLEAU d'objets {type, channel, enabled} ; `channel`
# vaut IN_APP, EMAIL, PUSH ou SMS.

# 4. provoquer une alerte réelle, ou attendre la tâche planifiée
```

Un envoi retenu apparaît dans `GET /sms/batches` avec sa **raison** dans
`skippedByReason` : `NO_PHONE`, `PHONE_UNVERIFIED`, `NO_CONSENT`,
`CONSENT_WITHDRAWN`, `PREFERENCE_DISABLED`, `QUIET_HOURS`, `DAILY_LIMIT`.

> Les deux étapes de déverrouillage ci-dessus ont été **exécutées** contre une
> base réelle : `POST /sms/consent` rend **201**, `PUT
> /notifications/preferences` rend **200**, et `POST /sms/test-send` appelé avec
> un jeton de producteur rend **403 « Permission requise : sms.send »** — la
> restriction administrateur est effective, pas seulement documentée. Ce qui n'a
> **pas** été exécuté, c'est l'envoi réel : aucun fournisseur n'est configuré
> ici.

**Un envoi retenu ne consomme pas de quota quotidien** : la fenêtre de silence
est contrôlée avant le compteur.

### Tester la fenêtre de silence pour de vrai

Régler `SMS_QUIET_START`/`SMS_QUIET_END` pour que l'heure **locale à Kinshasa**
tombe dans la plage, envoyer une alerte, et vérifier :

- la réponse `{"sent": false, "skipReason": "QUIET_HOURS"}` ;
- `skippedByReason.QUIET_HOURS` dans le lot ;
- **aucun SMS sur le téléphone** ;
- l'OTP continue de partir à la même heure — c'est le comportement voulu.

Un fuseau inconnu (`SMS_DEFAULT_TIMEZONE=Mars/Olympus`) fait **échouer** l'envoi
avec « Fuseau horaire inconnu » plutôt que de retomber sur l'heure du serveur.

---

## 3. Accusés de remise

Après un envoi, Twilio rappelle `POST /api/v1/webhooks/twilio/status`. La
signature `X-Twilio-Signature` est vérifiée avec `TWILIO_AUTH_TOKEN` : c'est
l'authentification de ce webhook, il n'y a pas de jeton.

À vérifier :

- le message passe à `DELIVERED` dans `sms_messages` ;
- une requête **non signée** est refusée (c'est couvert par
  `tests/e2e/surfacePublique.e2e.test.mjs`) ;
- un statut terminal ne **recule** pas (`DELIVERED` → `SENT` est ignoré).

---

## 4. Erreurs à reconnaître

Chaque code ci-dessous produit un message **en français**, stocké dans
`sms_messages.errorMessage` et renvoyé par `POST /sms/test-send`, au format
`[code] résumé. Cause : … Action : …`. La colonne « rejoué » indique si le
backend retente l'envoi : un échec définitif n'est pas rejoué, parce que chaque
tentative ajoute du délai et peut être facturée.

| Code | Ce que ça veut dire | Rejoué |
|---|---|---|
| **20003** | Identifiants Twilio refusés. | non |
| **21211** | Numéro destinataire invalide. | non |
| **21608** | Numéro non vérifié sur un compte d’essai Twilio. | non |
| **21612** | Le canal SMS n’est pas autorisé vers ce numéro. | non |
| **21614** | Le numéro destinataire n’accepte pas les SMS. | non |
| **30003** | Le message a expiré sans être remis. | oui |
| **30005** | Défaillance de l’opérateur destinataire. | oui |
| **30006** | Ligne fixe ou opérateur injoignable. | non |
| **30007** | L’opérateur a bloqué le message. | non |
| **63016** | La destination est interdite par les permissions géographiques du compte. | non |

Codes supplémentaires, reconnus mais sans explication détaillée : `21408`
(SMS non activé pour cette région), `30004` (contenu refusé), `30008` (erreur
d'opérateur inconnue), `21617` (corps trop long), `30018` et `30040`
(identifiant alphanumérique non pré-inscrit ou non pris en charge). Pour ceux-là,
le motif brut transmis par Twilio est conservé dans le message.

Un code **non prévu** n'est pas avalé : il est stocké tel quel dans
`sms_messages.errorCode`, et le motif du fournisseur est conservé. C'est vérifié
par une recette (`tests/e2e/twilioErrors.e2e.test.mjs`).

| Autre cas | Cause | Réaction |
|---|---|---|
| Signature refusée côté webhook | `AuthToken` différent de celui du compte, ou URL reconstruite fausse derrière un proxy | Aligner le jeton ; renseigner `TWILIO_WEBHOOK_BASE_URL` |
| Aucun accusé de remise | URL de rappel en `localhost`, ou non déclarée chez Twilio | Tunnel public + `TWILIO_STATUS_CALLBACK_URL` |

Les refus du fournisseur sont enregistrés comme **échec** dans `sms_messages`
avec leur code et leur raison, pas avalés silencieusement.

---

## 5. Écart de documentation à trancher

La page officielle Twilio indique que la pré-inscription d'un identifiant
alphanumérique n'est **pas requise** en RDC (+243, MCC 630). Des sources tierces
la disent au contraire requise pour **Vodacom (63001)**, et signalent que chez
**Orange** l'identifiant peut être remplacé par un code court.

**À vérifier opérateur par opérateur avant l'usage réel.** Si l'identifiant est
remplacé à la livraison, le message arrive quand même mais sous un autre nom —
ce que seul un essai réel révèle.

Autre contrainte confirmée : le canal est **à sens unique** en RDC. Aucun
« STOP » ni « HELP » par réponse n'est possible. La désinscription doit passer
par un autre mécanisme, ce que le consentement et les préférences de
notification assurent côté applicatif.

---

## 6. Ce que cette procédure ne prouve pas

Même une fois menée à bien, elle ne prouve pas :

- la livraison sur **les trois** opérateurs (Airtel, Vodacom, Orange) — il faut
  un numéro de chacun ;
- le comportement sous **charge** (le plafond fournisseur de 30/min en
  production n'a jamais été exercé) ;
- la **reprise** après une panne de Twilio ;
- l'interopérabilité du MFA TOTP avec une vraie application d'authentification.
