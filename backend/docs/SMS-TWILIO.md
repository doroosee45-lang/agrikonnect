# SMS via Twilio — envoi, consentement, suivi de remise

Le SMS est le canal d'alerte **primaire** du déploiement : en RDC, les données
mobiles sont rares et coûteuses, le SMS passe. Il est aussi **payant**. Ces deux
propriétés déterminent tout ce qui suit.

Sources : page Twilio « Democratic Republic of the Congo: SMS Guidelines »
(`https://www.twilio.com/en-us/guidelines/cd/sms`) et documentation « Secure
webhooks » / « Security », **consultées le 2026-10-24**. Les règles
télécoms évoluent sans préavis : à revérifier avant tout envoi réel.

---

## 0. Ce qui n'est pas vérifié

**Aucun SMS réel n'a été livré.** Tous les tests passent par un **faux serveur
HTTP** qui répond `queued` sans contacter aucun opérateur.

Ce que cela laisse entier, et qu'aucun test ne peut combler :

- le **routage réel** vers Vodacom, Airtel et Orange ;
- la **préservation effective** de l'identifiant d'expéditeur sur chaque réseau ;
- la **remise** sur des terminaux réels, y compris les téléphones basiques ;
- le **coût réel** par segment, qui dépend du contrat Twilio ;
- la **latence** d'acheminement, et donc l'utilité réelle d'une alerte.

Tant qu'un message réel n'a pas été reçu sur un téléphone en RDC, **l'envoi réel
n'est pas vérifié**. La route `POST /sms/test-send` existe précisément pour
cette recette : c'est le seul moyen de le prouver.

**Les écrans de consentement SMS sont vérifiés par compilation seulement.**
Deux écrans existent — `apps/web/src/pages/app/SmsConsent.tsx` (route
`/app/sms-consent`) et `apps/Mobile/src/app/notifications/sms-consent.tsx`
(route `/notifications/sms-consent`). Ils passent `tsc --noEmit` et sont bien
présents dans les bundles construits (`SmsConsent-*.js` côté web,
`sms-consent-*.js` côté mobile), ce qui prouve qu'ils sont compilés, typés et
embarqués.

**Cela ne prouve pas qu'ils fonctionnent.** Aucun navigateur ni simulateur n'a
piloté ces écrans : donner son accord, retirer son accord, lire l'état affiché
après un retrait, voir l'erreur d'un échec réseau — **rien de tout cela n'a été
observé**. Le comportement réel du bouton reste à vérifier à la main.

---

## 1. Règles RDC vérifiées dans la documentation Twilio

| Point | Ce que dit Twilio | Conséquence pour nous |
| --- | --- | --- |
| **SMS bidirectionnel** | **« No »** — non pris en charge en RDC | **Aucun « STOP » par SMS n'est possible.** La désinscription doit vivre dans l'application (§4). |
| Identifiant **alphanumérique** | Pris en charge **dynamiquement**, par les opérateurs comme par Twilio | Utilisable sans pré-inscription selon Twilio — mais voir §2. |
| Identifiant **préservé** | « Yes » | L'agriculteur voit `AGRIKONNECT`, pas un numéro anonyme. |
| Identifiant **numérique** | « Non pris en charge par le réseau **Airtel** : les messages soumis avec un identifiant numérique vers ses abonnés **ne sont pas remis** » | Interdit chez nous : `validateSenderId()` refuse tout identifiant sans lettre. |
| Long code domestique | « Not Supported » par Twilio | Inutilisable ; seul le long code international l'est. |
| Code court | « Not Supported » | Inutilisable. |
| **UCS-2** | Pris en charge | Les messages Unicode passent, mais coûtent plus (§5). |
| Concaténation | Prise en charge, mais « le point de coupure **varie selon l'encodage** » | Un message long peut se couper différemment selon l'opérateur : rester court. |
| Numéro fixe | Erreur **400 / code 21614**, message non facturé | Un numéro fixe est un échec identifiable, pas un silence. |
| MMS | « Converti en SMS avec URL intégrée » | Aucune pièce jointe : les alertes restent du texte. |

Twilio ajoute quatre recommandations de conformité : consentement préalable de
chaque destinataire, envoi de jour sauf urgence, prise en charge de HELP/STOP
**dans la langue du destinataire**, et respect des listes d'opposition.

> **Contradiction à trancher avant l'usage réel.** La page Twilio indique la
> pré-inscription comme **non applicable** (`---`) pour la RDC, l'alphanumérique
> étant disponible dynamiquement. Une source tierce (un agrégateur concurrent)
> rapporte en revanche une **pré-inscription exigée par Vodacom**. La
> contradiction n'est pas tranchée ici : elle est signalée, et la route
> `GET /sms/settings` la renvoie dans `preRegistrationNotice` pour qu'elle ne
> puisse pas être oubliée au moment du déploiement.

## 2. Identifiant d'expéditeur

`TWILIO_SENDER_ID`, défaut `AGRIKONNECT`. Vérifié par `validateSenderId()` :

- **11 caractères au plus** ;
- lettres ASCII, chiffres, espaces, et `+ - _ &` ;
- **au moins une lettre** — un identifiant numérique est refusé (Airtel ne le
  remet pas) ;
- les identifiants **génériques** (`INFO`, `InfoSMS`, `Verify`, `Notify`, …) sont
  signalés : Twilio recommande de les éviter en RDC, les opérateurs les bloquent.

`AGRIKONNECT` satisfait les quatre règles — vérifié par test.

## 3. Secrets

`TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` ne viennent **que** de
l'environnement. Les champs sont **vides** dans `.env.example`.

Trois garanties, toutes vérifiées par recette automatisée (rien de cela ne
nécessite de compte Twilio réel) :

- **jamais dans le code** : aucun littéral de secret dans `src/` ;
- **jamais dans une réponse** : `GET /sms/settings` renvoie `twilioConfigured:
  true` (un booléen), jamais la valeur. Un test vérifie que ni le jeton ni
  l'identifiant de compte n'apparaissent dans le corps de réponse ;
- **jamais dans les journaux** : l'en-tête `Authorization` n'est passé à aucun
  logger, et le numéro est tronqué dans les traces (`+243•••78`) parce qu'il
  identifie une personne.

`TWILIO_AUTH_TOKEN` est **aussi** la clé de signature des webhooks. Sa fuite ne
permettrait pas seulement d'envoyer des SMS à notre place : elle permettrait de
**forger des accusés de remise**, donc de faire croire qu'une alerte agronomique
a été lue alors que personne ne l'a reçue.

## 4. Consentement — et pourquoi il ne peut pas passer par le SMS

Twilio indique que le SMS bidirectionnel n'est **pas pris en charge en RDC**, et
sa documentation sur l'alphanumérique précise que le destinataire **ne peut pas
répondre** — pas même « STOP ».

Donc : **la désinscription ne peut pas être un mot-clé envoyé par SMS.** Elle vit
dans l'application :

| Route | Effet |
| --- | --- |
| `GET /sms/consent` | Liste les consentements, avec un rappel explicite que répondre au SMS n'a aucun effet |
| `POST /sms/consent` | Donne son consentement pour un usage (`ALERT`, `OTP`, …) |
| `DELETE /sms/consent` | **Désinscription.** Statut `WITHDRAWN`, date conservée |

Trois règles :

- **un retrait est conservé, pas supprimé.** Il faut pouvoir prouver à quelle
  date l'envoi a cessé d'être autorisé ;
- **le consentement est recopié dans chaque message** (`consentSnapshot`) : si
  l'agriculteur se désinscrit plus tard, on peut encore montrer sur quel accord
  cet envoi précis s'appuyait ;
- **redonner son consentement ne crée pas une seconde ligne** : un double clic
  dans l'application ne doit pas produire deux historiques.

La préférence de notification (`NotificationPreference`, canal `SMS`) est honorée
**en plus** du consentement : couper le canal et retirer son consentement sont
deux gestes différents, et les deux bloquent l'envoi.

### 4.1 L'écran de consentement

La désinscription n'existant nulle part ailleurs, l'écran qui la porte n'est pas
une page de réglages secondaire : **c'est le seul endroit où l'on peut cesser de
recevoir des SMS**. Il existe en web et en mobile.

| Écran | Route | Accès |
| --- | --- | --- |
| Web | `/app/sms-consent` | bouton « Alertes par SMS » sur `/app/notifications` |
| Mobile | `/notifications/sms-consent` | bouton « Alertes SMS » sur `/notifications` |

Les deux écrans montrent trois choses, dans cet ordre :

1. **l'accord lui-même** — un bouton qui donne ou retire l'accord, avec l'état
   courant, la date à laquelle il a été donné, et la date de retrait si le
   consentement a été retiré. Un retrait reste affiché plutôt que de
   disparaître : la personne doit voir que son geste a été enregistré ;
2. **comment se désinscrire** — le texte `optOutNotice` renvoyé par
   `GET /sms/consent`, qui dit noir sur blanc que **répondre au SMS n'a aucun
   effet**. Ce texte vient de l'API plutôt que d'être recopié dans chaque écran,
   pour que les deux disent exactement la même chose ;
3. **ce que l'accord couvre** — les alertes agronomiques sur le numéro
   enregistré, pas de publicité, retrait possible à tout moment avec effet
   immédiat.

Le numéro est affiché **avant** l'accord, et le bouton est désactivé s'il ne
peut pas servir. Un consentement donné sur un numéro inutilisable serait un
accord enregistré sur un canal mort : l'agriculteur verrait un bouton actif,
rien ne partirait, et rien ne le lui dirait.

| État du numéro | Écran | Bouton « Donner mon accord » |
| --- | --- | --- |
| absent ou vide | « Aucun numéro enregistré » + exemple `+243 81 234 5678` | **désactivé**, libellé « Numéro requis » |
| présent mais non E.164 | « Numéro au format invalide » + le numéro tel quel | **désactivé**, libellé « Numéro requis » |
| E.164 valide, non vérifié | le numéro, + avertissement « n'a pas encore été vérifié par code » | actif |
| E.164 valide, vérifié | le numéro, + « Numéro vérifié » | actif |

Le **retrait reste toujours possible**, même sans numéro valide. Bloquer la
désinscription parce que le numéro est malformé retiendrait la personne captive
d'un canal qu'elle veut quitter : seul « donner mon accord » est conditionné.

La règle E.164 est la même au caractère près dans les trois implémentations
(`backend/src/integrations/twilio.js`, `apps/web/src/lib/phone.ts`,
`apps/Mobile/src/lib/phone.ts`) : `^\+[1-9]\d{6,14}$`. Elle est gardée par
`tests/phoneE164Alignment.test.mjs`, qui lit le source des trois et exige
l'identité — une divergence entre l'écran et l'envoi ne serait visible nulle part
ailleurs. Le numéro jugé est bien celui que l'envoi utilisera : `sendAlertBatch`
envoie à `membership.user.phone`, et `publicUser()` expose `profile.phone`.

Trois choix à retenir :

- **l'accord est donné par usage, pas « aux SMS » en général.** L'écran gère
  `ALERT`. Un second usage (`OTP`) aura son propre accord, parce que consentir à
  recevoir un code de vérification n'est pas consentir à recevoir des alertes ;
- **la version du texte est enregistrée avec l'accord** (`noticeVersion`,
  actuellement `v1-2026-10`). Si le texte présenté change, l'accord donné sur
  l'ancienne version ne couvre plus rien : sans cette version, un accord passé
  resterait valide pour un texte que la personne n'a jamais lu ;
- **ce que le retrait fait, et ne fait pas.** L'écran dit : « Après le retrait,
  aucun nouveau SMS n'est envoyé. Un message déjà remis à l'opérateur ne peut
  pas être rappelé. » Promettre un rappel serait faux — une fois le message chez
  l'opérateur, plus personne ne le reprend.

> **Ces écrans sont vérifiés par compilation seulement** — voir §0.

> **Point ouvert.** Twilio recommande aussi de ne contacter les destinataires que
> pendant leurs heures de jour, sauf urgence. **Ce n'est pas implémenté** : le
> job d'alertes n'a pas de fenêtre horaire. Les alertes agronomiques sont
> justement le cas « sauf urgence », mais cela mérite une décision explicite
> plutôt qu'une absence de règle.

### 4.2 Le risque du numéro non vérifié — et une décision à confirmer

> **Décision reportée : à reprendre avant le premier déploiement réel avec des
> agriculteurs.**

#### Le risque

**Rien ne vérifie que le numéro enregistré appartient à la personne qui
l'enregistre.** `register()` accepte un `phone` et l'écrit tel quel ; personne ne
prouve que le téléphone sonne dans la poche de l'inscrit. Donc un consentement
donné dans l'application peut porter sur **le numéro d'un autre**.

Ce n'est pas un détail technique, ça a trois conséquences concrètes :

1. **Le consentement n'est pas celui du destinataire.** La règle que l'on
   appliquait — « pas d'envoi sans consentement » — est respectée en apparence et
   vidée de son sens : c'est une tierce personne qui reçoit le message, et elle
   n'a jamais rien accepté. L'écran de consentement (§4.1) ne règle pas ce point,
   il dit seulement sur quel numéro l'accord porte.
2. **Des données agronomiques partent chez un inconnu.** Le corps d'une alerte
   contient le nom de la parcelle, le paramètre, la valeur mesurée et la plage
   attendue (§5.2). Envoyer ça à un tiers, c'est publier l'état d'une
   exploitation à quelqu'un qui n'a aucun droit de le savoir.
3. **Le destinataire réel ne peut pas se désinscrire.** En RDC le SMS est à sens
   unique (§1) : il ne peut pas répondre « STOP », et il n'a pas de compte dans
   l'application. Il n'a **aucun** moyen de faire cesser les envois. C'est le cas
   le plus défavorable qui soit, à la fois pour la confiance et pour la
   conformité — Twilio exige un opt-in du destinataire, pas d'un tiers.

Le schéma porte déjà la colonne qu'il faut : `profiles.phone_verified_at`, posée
uniquement par `verifyPhone()`. L'écran de consentement affiche
« Ce numéro n'a pas encore été vérifié par code » quand elle est vide — c'est un
avertissement, **pas une protection**.

#### Ce qui existe déjà, et ce qui manque

La vérification par code **est déjà implémentée**, mais elle n'est reliée ni au
consentement SMS ni à l'envoi d'alertes. Il ne s'agit donc pas de la concevoir,
seulement de la brancher.

| Élément | État actuel | Où |
| --- | --- | --- |
| Code à **6 chiffres** | `generateOtp(6)`, `randomInt` | `src/shared/crypto.js:16` |
| **Expiration** | `OTP_TTL_MINUTES`, défaut **10 min** | `src/config/env.js:96` |
| **Tentatives** | **5** essais, puis code inutilisable | `auth.service.js:387` |
| **Plafond d'envois** | `OTP_MAX_SENDS_PER_HOUR`, défaut **5/h** par numéro | `src/config/env.js:97` |
| Stockage | hash SHA-256 du code, jamais en clair | `auth.service.js:356` |
| Consommation | `consumedAt` posé, un code ne sert qu'une fois | `auth.service.js:394` |
| Envoi | `sendSms()` via `SMS_PROVIDER` | `auth.service.js:362` |
| Effet | pose `phoneVerifiedAt` | `auth.service.js:398` |

Les quatre garde-fous demandés — code court, expiration, nombre de tentatives,
plafond d'envois — sont donc **tous déjà là**. Le plafond d'envois est celui qui
compte contre l'abus : sans lui, un attaquant peut faire envoyer des codes en
boucle à un numéro tiers, ce qui harcèle la victime **et** brûle le budget SMS.

**Ce qui manque, et qui n'est pas implémenté :**

- **l'écran de consentement ne propose pas la vérification.** Il affiche le
  numéro et dit s'il est vérifié, sans offrir le geste. Il faudrait un bouton
  « Vérifier ce numéro » qui appelle l'envoi de code, puis un champ de saisie ;
- **l'envoi d'alertes ne regarde pas `phoneVerifiedAt`.** `sendAlertSms()`
  vérifie le consentement, le numéro, les plafonds et la préférence — jamais si
  le numéro est vérifié ;
- **⚠ le code part par un autre chemin que les alertes.** `sendPhoneOtp` utilise
  `src/integrations/sms.js` et son `SMS_PROVIDER` générique, **pas**
  l'intégration Twilio de l'étape E. Conséquence : le code de vérification
  **n'apparaît pas dans `sms_messages`**, n'a pas de suivi de remise, ne compte
  pas dans les plafonds quotidiens et n'est pas soumis au consentement. Le
  message lui-même est propre — mesuré : 102 caractères, GSM-7, **1 segment**,
  `AGRIKONNECT` correctement orthographié — mais ce second chemin d'envoi n'est
  ni tracé ni plafonné. **À rapprocher des deux avant tout envoi réel.**

> **Ne pas faire :** envoyer un code à un numéro que la personne n'a pas encore
> déclaré. La vérification doit partir d'un numéro déjà enregistré par
> l'utilisateur, sinon l'application devient elle-même un outil de harcèlement.

#### ⚠ Décision à confirmer — les alertes réelles partent-elles aux numéros non vérifiés ?

Tant que la vérification n'est pas branchée, il faut trancher explicitement.
**Ce n'est pas implémenté dans un sens ni dans l'autre : aujourd'hui tout numéro
E.164 reçoit les alertes.**

| | **Option A — vérifiés seulement** | **Option B — non vérifiés aussi (état actuel)** |
| --- | --- | --- |
| Règle | envoi seulement si `phoneVerifiedAt` est renseigné | envoi dès qu'un consentement existe |
| Fuite vers un tiers | impossible | possible |
| Couverture au démarrage | **quasi nulle** | complète |
| Coût d'exploitation | il faut faire vérifier tout le monde | aucun |

**Combien de destinataires l'option A exclurait-elle ?**

`register()` ne pose **jamais** `phoneVerifiedAt` — seule `verifyPhone()` le
fait. Donc sur toute base issue d'inscriptions, **chaque numéro enregistré est
non vérifié**. Mesuré sur le harnais e2e (`scripts/measure-phone-verification.mjs`,
base vide + 2 inscriptions dont une avec numéro) :

```
profils             : 2
avec un numéro      : 1 (50.0 %)
numéro vérifié      : 0 (0.0 %)
numéro NON vérifié  : 1 (50.0 %)
⇒ L'option A exclurait 100 % des destinataires.
```

**Ces chiffres viennent d'une base de test, pas de données réelles.** Aucune base
de production n'est accessible depuis cet environnement — la requête à lancer sur
la vraie base est :

```sql
SELECT
  COUNT(*)                                            AS profils,
  COUNT(*) FILTER (WHERE phone IS NOT NULL)           AS avec_numero,
  COUNT(*) FILTER (WHERE phone_verified_at IS NOT NULL) AS verifies,
  COUNT(*) FILTER (WHERE phone IS NOT NULL
                   AND phone_verified_at IS NULL)     AS non_verifies
FROM profiles;
```

Le ratio `non_verifies / avec_numero` est le taux d'exclusion de l'option A. Il
vaut **100 %** tant qu'aucune vérification n'a été faite — donc l'option A n'est
réaliste **qu'après** avoir branché la vérification, et probablement avec une
période de transition.

Une troisième voie, si ni A ni B ne convient : **A différée** — on envoie aux
numéros non vérifiés pendant une période annoncée, en affichant l'avertissement
dans l'écran, puis on bascule. C'est un compromis à trancher, pas une solution
par défaut.

**Comment l'exploitation le verrait.** Le journal de lot agrège déjà
`skippedByReason` (`smsDelivery.service.js:404`) : chaque destinataire retenu
incrémente un compteur par raison. Il suffirait d'ajouter `PHONE_UNVERIFIED` à
l'enum `SmsSkipReason` — le compteur apparaîtrait alors de lui-même dans
`POST /sms/batches` et `GET /sms/batches`, à côté de `NO_CONSENT`, `NO_PHONE`,
`DAILY_LIMIT`, `PREFERENCE_DISABLED` et `CONSENT_WITHDRAWN`. Sans ce compteur,
l'option A produirait un silence invisible : les alertes seraient calculées,
personne ne les recevrait, et rien dans les journaux ne le dirait. **C'est le
prérequis de l'option A, pas un accessoire.**

**En attente de votre décision. Rien n'est implémenté.**

## 5. Messages courts et passage en Unicode

Un SMS GSM-7 porte **160 caractères** par segment (153 en multi-segments). En
UCS-2, c'est **70** (67). **Un seul caractère hors GSM force l'UCS-2 pour tout le
message** : la facture double, et la coupure change.

**Résultat mesuré, contre-intuitif pour le français.** Sont au jeu GSM de base :
`é è ù ì ò à` et `Ç` **majuscule**. **N'y sont pas** :

| Caractère | Exemple | Conséquence |
| --- | --- | --- |
| `ç` **minuscule** | « ça » | UCS-2 |
| `ô` | « bientôt » | UCS-2 |
| `î` `ï` `ê` `â` `û` `ë` | « maître », « maïs » | UCS-2 |
| `’` apostrophe typographique | « l’alerte » | UCS-2 |
| `« »` guillemets français | « semer » | UCS-2 |
| `…` points de suspension | « attendre… » | UCS-2 |
| `œ` | « œil » | UCS-2 |

Vérifié caractère par caractère par test. La règle de rédaction qui en découle :
**apostrophe droite `'`, guillemets droits `"`, trois points `...`, et éviter
`ô`/`î`/`ç`** — ou accepter de payer deux segments.

`analyseMessage()` renvoie `encoding`, `segments`, `characterCount` **et la liste
des caractères fautifs** : on ne devine pas ce qui a fait basculer le message, on
le nomme. Ces valeurs sont enregistrées avec chaque envoi.

### 5.1 Ce qui a été mesuré dans ce dépôt

Les gabarits d'alerte utilisaient le tiret cadratin `—` comme séparateur,
partout. **Chacun de ces messages partait donc en UCS-2, sur 3 ou 4 segments.**
Personne ne s'en était aperçu, parce que rien ne le mesurait.

Deux autres fauves, trouvés en mesurant :

- **`°` n'est pas au jeu GSM 03.38.** L'unité des alertes de température est
  `°C` : sans substitution, **chaque alerte de température** basculait en UCS-2.
  `toGsm7()` le remplace par `deg`.
- **`RANGE_LABELS` contient « température de l’air »** avec une apostrophe
  typographique, et son libellé le plus long — « salinité du sol (conductivité
  électrique) » — fait **41 caractères**. Ces libellés sont partagés avec
  l'interface web, qui n'a aucune raison de s'en priver : ils sont donc
  assainis et tronqués **à la frontière du SMS**, pas modifiés à la source.

### 5.2 Les gabarits réécrits

| Avant | Après |
| --- | --- |
| 3 à 4 segments, UCS-2 | **1 segment, GSM-7** |
| `AGRIKONNET — Seuil dépassé. …` | `AGRIKONNET : seuil dépassé. …` |
| `[40 ; 70] %` | `40 à 70 %` |
| `Prévision vérifiée meilleure que la persistance.` | `Batt la persistance.` |
| nom de parcelle integral | **tronqué à 18 caractères** |

Les crochets ont disparu pour une raison précise : `[` et `]` sont au jeu
**étendu** GSM, donc comptés **double**.

**Le titre n'est pas concerné** : il sert à l'in-app et à l'email, jamais au SMS.
Il conserve son `—`. Cette frontière est fixée par un test, pour qu'elle ne soit
pas « corrigée » par erreur dans un sens ou dans l'autre.

### 5.3 Le test qui garde la règle — `tests/alertMessageGsm.test.mjs`

28 tests. Deux niveaux, parce qu'un seul ne suffirait pas :

- **analyse du code source** : les littéraux des **corps** de
  `buildAlertMessage` sont extraits du fichier et analysés. Un `—` réintroduit
  fait échouer le test. Vérifié : en réintroduisant un `—`, **6 tests échouent** ;
  restauré, 28 passent. Les littéraux des **titres** sont exclus, sinon le test
  échouerait en permanence et ne servirait à rien ;
- **sortie réelle** : 4 gabarits × réel/simulé avec des entrées propres, puis 5
  cas **hostiles** (nom de parcelle de 41 caractères avec apostrophe
  typographique, unité en degrés, référence longue, libellé d'appareil avec
  `—`), plus le **pire cas combiné** borné à 158/160 — si la marge fond, le test
  le dit avant qu'un nom de parcelle un peu long ne fasse déborder le message.

Deux garde-fous contre la dérive inverse : raccourcir ne doit pas vider le
message. Des assertions vérifient que **la valeur observée, la plage attendue, le
nom de la parcelle, l'appareil et le seuil** restent cités, et qu'un message
simulé reste marqué `[SIMULÉ]`.

`toGsm7()` distingue deux catégories, et le test le fixe :

- les **signes typographiques** ont un équivalent ASCII fidèle (`’` → `'`,
  `« »` → `"`, `—` → `-`, `…` → `...`, `œ` → `oe`) ;
- les **lettres accentuées hors du jeu** n'en ont pas : `contrôle` devient
  `controle`, ce qui est une **faute d'orthographe**, pas une translittération.
  D'où la règle — rédiger les gabarits sans ces lettres, et ne laisser le filet
  intervenir que sur les valeurs qu'on ne contrôle pas.

`Ç` majuscule, lui, est au jeu : il n'est pas touché.

## 6. Suivi de remise

**Une soumission acceptée n'est pas une remise.** Twilio renvoie `queued` : c'est
une file d'attente chez lui. Seul l'accusé du réseau, reçu plus tard par
webhook, dit `delivered`.

Les deux sont distingués dans `sms_messages` :

| Champ | Contenu |
| --- | --- |
| `status` | État normalisé : `QUEUED_LOCALLY`, `QUEUED`, `SENT`, `DELIVERED`, `UNDELIVERED`, `FAILED`, `UNKNOWN` |
| `rawStatus` | La valeur brute reçue, **même non reconnue** |
| `statusHistory` | `{ status, rawStatus, at, source }[]` — chaque transition horodatée |
| `providerMessageId` | La clé de rapprochement avec le webhook |

Deux règles :

- **un statut terminal ne recule pas.** Un `sent` arrivé après un `delivered`
  est ignoré (`ALREADY_TERMINAL`) : sinon un accusé tardif effacerait la preuve
  de remise ;
- **un état inconnu reste inconnu.** Twilio peut ajouter une valeur sans
  préavis ; la deviner — la traiter comme « remis » ou comme « échoué » — serait
  une affirmation sans preuve. Elle est conservée telle quelle en `UNKNOWN`.

Un accusé pour un message **inconnu** renvoie 404 et est journalisé : c'est soit
un message d'un autre environnement, soit une tentative de forger un statut.

## 7. Signature des webhooks

Le webhook écrit l'état de remise. Sans vérification, **n'importe qui peut
marquer une alerte « remise » alors que l'agriculteur n'a rien reçu**. L'URL est
publique par construction.

Algorithme Twilio : URL exacte + paramètres triés (clé+valeur, sans séparateur),
**HMAC-SHA1** avec l'`AuthToken`, Base64, dans l'en-tête `X-Twilio-Signature`.
Pour un corps JSON, Twilio ajoute `bodySHA256` (SHA-256 hexadécimal du corps
**brut**) à l'URL.

Ce qui est refusé, et testé :

| Cas | Réponse |
| --- | --- |
| En-tête absent | **403**, journalisé |
| Signature calculée avec un autre jeton | **403** |
| Signature valable mais **paramètre modifié** (`sent` → `delivered`) | **403** |
| Signature valable mais **URL différente** | **403** |
| Corps JSON modifié malgré un `bodySHA256` correct | **403** |
| `bodySHA256` falsifié | **403** |
| `TWILIO_AUTH_TOKEN` absent | **503** — la configuration manque, ce n'est pas une fraude |
| Signature valide, message inconnu | **404** |
| Signature valide | **200**, statut appliqué |

Deux pièges traités :

- **l'URL fait partie du matériel signé.** Derrière un mandataire qui termine le
  TLS, `req.protocol` vaut `http` alors que Twilio a signé `https` : un seul
  octet d'écart et **toutes** les validations échouent. La reconstruction honore
  `X-Forwarded-Proto` / `X-Forwarded-Host`, et `TWILIO_WEBHOOK_BASE_URL` permet
  d'imposer l'URL exacte déclarée dans la console — plus sûr encore ;
- **le port par défaut** est accepté avec ou sans, comme dans la bibliothèque
  officielle.

Les erreurs de signature renvoient **403 sans détail** : dire ce qui ne va pas
aiderait à forger.

> **Écart assumé.** Twilio recommande d'utiliser son SDK plutôt que
> d'implémenter soi-même la validation. Le SDK n'est pas installé — l'ajouter
> pour un `POST` ferait entrer une dépendance lourde dans un projet qui n'en
> compte que douze. Le calcul est donc fait ici, mais il est **testé contre des
> vecteurs construits indépendamment** avec `node:crypto`. Si le SDK est installé
> un jour, `validateTwilioSignature` doit être remplacée par
> `twilio.validateRequest`, et les tests doivent continuer à passer tels quels.

## 8. Garde-fous de coût

| Garde-fou | Variable | Défaut |
| --- | --- | --- |
| SMS par agriculteur et par jour | `SMS_DAILY_LIMIT_PER_FARMER` | **5** |
| SMS par organisation et par jour | `SMS_DAILY_LIMIT_PER_ORGANIZATION` | 500 |
| Délai de renotification | `ALERT_RENOTIFY_HOURS` | 24 — **existant, non modifié** |

Le comptage porte sur **tous les messages soumis, y compris les échecs** : un
message refusé par l'opérateur a malgré tout été soumis, et un plafond qui ne
compterait que les remises laisserait une boucle d'erreurs envoyer sans limite.

Un envoi retenu renvoie **422** et non 500 : c'est un comportement attendu, pas
une panne. La raison est dans `skipReason` — `NO_CONSENT`, `CONSENT_WITHDRAWN`,
`DAILY_LIMIT`, `PREFERENCE_DISABLED`, `NO_PHONE`.

**Le délai de renotification existant n'est pas réimplémenté ici.** Ce module
refuse un doublon ; il ne décide pas du calendrier des alertes, qui reste dans
`alerts.service.shouldRenotify`.

### Journal de lot

Chaque exécution du job d'alertes écrit une ligne dans `sms_batch_logs` :
`candidates`, `sent`, `skipped`, `failed`, `totalSegments`, et surtout
**`skippedByReason`** — le détail par raison. « Aucun consentement » et « plafond
atteint » n'appellent pas la même correction ; sans le détail, les deux se
confondent en un seul nombre.

## 9. Configuration

| Variable | Rôle |
| --- | --- |
| `SMS_PROVIDER` | `console` \| `twilio` \| `africastalking` \| `webhook` |
| `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` | **Secrets.** Vides dans `.env.example` |
| `TWILIO_SENDER_ID` | Identifiant alphanumérique |
| `TWILIO_API_BASE_URL` | Défaut `https://api.twilio.com`. **Les tests la pointent vers un faux serveur** : c'est la seule façon d'exercer l'envoi sans compte réel |
| `TWILIO_STATUS_CALLBACK_URL` | Accusé de remise, à déclarer dans la console |
| `TWILIO_WEBHOOK_BASE_URL` | URL publique du webhook, pour la signature |
| `TWILIO_REQUEST_TIMEOUT_MS` | Défaut 10 000 |

Le fournisseur reste derrière l'interface existante `sendSms()` : le code métier
ne sait pas qui envoie. Remplacer Twilio par un agrégateur local ne touche
aucune route.

## 10. Routes

| Route | Accès | Effet |
| --- | --- | --- |
| `GET /sms/settings` | authentifié | Réglages, **sans secret**, + le point à vérifier sur la pré-inscription |
| `GET /sms/consent` | `sms.consent` | Consentements + rappel que le canal est à sens unique |
| `POST /sms/consent` | `sms.consent` | Donne son consentement |
| `DELETE /sms/consent` | `sms.consent` | **Désinscription** |
| `GET /sms/messages` | `sms.read` | Historique, filtrable par statut et par lot |
| `GET /sms/messages/:id` | `sms.read` | Détail + historique des statuts |
| `GET /sms/batches` | `sms.read` | Journaux de lots |
| `POST /sms/test-send` | **`sms.send` — administrateurs seulement** | Envoi de recette |
| `POST /webhooks/twilio/status` | **signature Twilio** | Accusé de remise |

`POST /sms/test-send` est réservé aux administrateurs : un envoi de recette coûte
de l'argent réel et peut viser n'importe quel numéro. Le plafond quotidien ne
suffit pas à en faire une route ouverte à tout compte.

## 11. Tests

Comptes séparés ; `npm test` exécute les deux familles.

### 11.1 Unitaires purs — `tests/twilioSms.test.mjs`

34 tests, **sans réseau, sans base** :

- segmentation GSM-7 (160/153) et UCS-2 (70/67), frontière exacte ;
- **un seul caractère hors GSM fait basculer tout le message** ; les caractères
  français fautifs sont nommés un par un (`ç`, `ô`, `î`, `’`, `« »`, `…`, `œ`) ;
- à longueur égale, l'UCS-2 coûte plus de segments que le GSM-7 ;
- identifiant d'expéditeur : longueur, lettres obligatoires, symboles,
  génériques refusés, absent refusé ;
- numéro E.164 ;
- **signature** : vecteurs construits avec `node:crypto` indépendamment de
  l'implémentation — tri des paramètres, paramètre modifié, URL différente,
  jeton différent, paramètre ajouté, port par défaut, signature vide ;
- **corps JSON** : `bodySHA256` intact, corps modifié, hachage falsifié ;
- reconstruction d'URL, y compris derrière un mandataire.

### 11.2 Bout en bout — `tests/e2e/smsTwilio.e2e.test.mjs`

19 tests, **base PostgreSQL réelle + faux serveur HTTP Twilio** :

- les réglages sont exposés **sans aucun secret** (jeton et identifiant de
  compte absents du corps de réponse) ;
- **sans consentement, aucune requête ne part** vers le fournisseur ;
- l'envoi part avec l'identifiant **alphanumérique** et l'authentification
  Basic correcte ;
- un message Unicode est annoncé comme coûtant plus ;
- webhook **sans signature**, **forgée**, **paramètre modifié** → 403 ;
- accusé signé → `DELIVERED`, historique conservé ;
- accusé pour un message inconnu → 404 ;
- un statut terminal ne recule pas ;
- **le plafond quotidien retient l'envoi** (3 envoyés sur 5 demandés) ;
- le consentement retiré coupe l'envoi, puis le redonner le rouvre sans créer
  une seconde ligne ;
- un producteur ne peut pas déclencher d'envoi de recette (403) ;
- les envois d'une autre organisation sont invisibles ;
- un refus du fournisseur est enregistré comme `FAILED` et reste consultable ;
- un webhook JSON est validé par `bodySHA256` sur le corps brut.

## 11.3 Le job d'alertes passe par le lot

`dispatchAlert()` (`src/modules/alerts/alerts.service.js`) ne remet plus le canal
`SMS` à `notify()`. Les destinataires dotés d'un numéro sont remis à
`sendAlertBatch()`, qui applique consentement, plafond et journal.

**Pourquoi ce détour.** Le chemin générique des notifications ne connaît aucune
des trois règles que le SMS est seul à devoir respecter. Y laisser le SMS
l'aurait fait échapper au consentement — alors que le canal est à sens unique et
qu'aucun « STOP » ne peut rattraper un envoi non consenti.

L'in-app et l'email restent sur leur chemin : gratuits, sans consentement à
prouver, déjà dédupliqués. **Un refus de SMS ne fait donc pas disparaître
l'alerte** — vérifié par test.

`SMS` ne figure dans `channelsSent` que si au moins un message a été
**effectivement soumis** : un envoi retenu par un garde-fou n'est pas un canal
employé.

Un échec du lot SMS est journalisé sans faire échouer l'alerte.

### Tests — `tests/e2e/alertSmsJob.e2e.test.mjs`

4 tests, base réelle + faux serveur Twilio, déclenchés par **le job lui-même**
(`runJob('recommendations.monitor')`), pas par un appel direct au service :

- un franchissement mesuré envoie **un** SMS à Twilio, vers le destinataire qui a
  consenti, avec l'identifiant alphanumérique et la valeur observée dans le
  texte ;
- le destinataire **sans consentement ne reçoit rien**, et le journal de lot
  porte `{ NO_CONSENT: 1 }` ;
- l'email et l'in-app partent **dans tous les cas** ;
- après retrait du consentement, plus aucun envoi — et le journal distingue
  `CONSENT_WITHDRAWN` de `NO_CONSENT`.

## 12. Reste à faire

- **recevoir un SMS réel** en RDC et le consigner : c'est la seule preuve qui
  manque à l'envoi ;
- **trancher la pré-inscription** auprès de Twilio (contradiction §1) ;
- **fenêtre horaire d'envoi** (recommandation Twilio, non implémentée) ;
- **écran de suivi de remise** : `GET /sms/messages` et `GET /sms/batches`
  n'ont toujours aucun écran. L'écran de consentement, lui, existe (§4.1) mais
  n'est vérifié que par compilation ;
- **faire piloter l'écran de consentement par un navigateur et un simulateur** :
  donner l'accord, le retirer, constater l'état après retrait — rien de cela n'a
  été observé ;

