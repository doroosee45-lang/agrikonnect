# AGRIKONNECT AFRICA — état du dépôt

**Date de l'archive :** 28 octobre 2026
**Contenu :** l'état réel du dépôt. Rien de ce qui est écrit ici n'est enjolivé : ce qui n'est
pas fait est écrit comme non fait.

Le travail sur les couleurs (palier P1) est terminé et documenté **en annexe A** : il n'occupe
plus le corps du document, qui porte sur l'installation et l'état réel.

---

## 1. Ce que contient cette archive

Trois applications, plus les documents de travail.

| Dossier | Ce que c'est | Ce que ça fait |
| --- | --- | --- |
| `backend/` | API Node.js / Express, JavaScript (ESM) | Sert toutes les données : comptes et rôles, parcelles, productions, lots, commandes d'export, places de marché, recommandations agronomiques, alertes de capteurs, prévisions, données géospatiales. Base PostgreSQL via Prisma. Authentification Supabase. |
| `apps/web/` | Application web React 18 + Vite, TypeScript | L'interface sur ordinateur : site public, espaces agriculteur / agronome / exportateur / investisseur / administrateur. **162 pages** (162 routes déclarées dans `src/App.tsx`). |
| `apps/Mobile/` | Application mobile Expo / React Native, TypeScript | La même application sur téléphone, avec Expo Router. **209 écrans.** |
| `scripts/` | Outillage de livraison | `demarrer-local.sh` (dont `--diagnostic`), `verifier-livraison.py` (contrôle de l'archive, avec `--selftest`), `construire-livraison.sh`, le générateur de captures avant/après et les instantanés de l'état pré-P1. |
| `backend/docs/COMPTE-RENDU-*.md` | Comptes rendus d'étape | **Ce qui a été fait, comment c'est testé, et surtout ce qui n'a été vu à l'écran par personne.** À lire avant de conclure qu'un écran fonctionne : `COMPTE-RENDU-ECRAN3-ALERTES.md` §6. |
| `design-tokens.json` | Documentation des couleurs | L'échelle de couleurs réellement présente dans le code, avec les écarts par rapport à la référence du programme. |

Le **backend** ne contient aucune donnée : ni dump, ni base, ni jeu de test. Seules les
**migrations** (16 dossiers dans `backend/prisma/migrations/`) sont fournies — elles créent la
structure de la base, pas son contenu. Les deux dernières ajoutent la raison de non-envoi SMS
`PHONE_UNVERIFIED` et le compteur transactionnel du quota de dépôt géospatial.

---

## 2. Installer et lancer

### 2.1 Prérequis

| Outil | Version | Vérifier avec |
| --- | --- | --- |
| Node.js | **20 ou plus** (exigé par `backend/package.json`) | `node -v` |
| npm | 10 ou plus | `npm -v` |
| PostgreSQL | 14 ou plus | `psql --version` |
| Python 3 | pour le service géospatial optionnel `backend/geoai/` | `python3 --version` |

> **PostGIS n'est pas nécessaire.** Les géométries sont stockées en `Json` dans le schéma
> Prisma : aucune colonne de type `geometry`, aucune fonction PostGIS dans les migrations.
> Un PostgreSQL ordinaire suffit.

### 2.2 Le backend

```bash
cd backend
npm install
cp .env.example .env
```

Ouvrir `.env` et renseigner les variables de la section 3 ci-dessous. **Au minimum** :
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.

Puis créer la structure de la base et démarrer :

```bash
npx prisma generate
npm run prisma:deploy     # applique les 16 migrations
npm run dev               # démarre avec rechargement automatique
```

Le backend écoute sur le **port 4000** (variable `PORT` dans `.env`).
Pour un démarrage sans rechargement : `npm start`.

> `npm run prisma:deploy` applique les migrations telles quelles — c'est la commande pour une base
> existante ou neuve. `npm run prisma:migrate` est réservé au développement quand on crée de
> nouvelles migrations.

### 2.3 L'application web

```bash
cd apps/web
npm install
cp .env.example .env
```

Renseigner `VITE_API_BASE_URL` avec l'adresse du backend (`http://localhost:4000` en local).

```bash
npm run dev      # développement, http://localhost:5173
npm run build    # build de production dans dist/
npm run verify   # vérification de types + build
```

### 2.4 L'application mobile

```bash
cd apps/Mobile
npm install
cp .env.example .env
```

Renseigner `EXPO_PUBLIC_API_BASE_URL`. **Attention :** depuis un téléphone physique,
`localhost` ne désigne pas votre ordinateur. Utilisez l'adresse réseau local de la machine qui
fait tourner le backend, par exemple `http://192.168.1.20:4000`. Le téléphone et l'ordinateur
doivent être sur le même réseau.

```bash
npm start        # démarre Expo, affiche un QR code
```

**Sur le téléphone :** installer l'application **Expo Go** (App Store / Play Store), puis scanner
le QR code affiché dans le terminal. Pour un simulateur : `npm start` puis appuyer sur `i`
(simulateur iOS, nécessite Xcode sur macOS) ou `a` (émulateur Android, nécessite Android Studio).

### 2.5 Une commande unique pour tout lancer

**Il n'y en a pas.** Cette archive ne contient pas de `package.json` à la racine : les trois
applications s'installent et se lancent séparément. Il faut donc trois terminaux ouverts :

```bash
# terminal 1
cd backend && npm run dev
# terminal 2
cd apps/web && npm run dev
# terminal 3
cd apps/Mobile && npm start
```

---

## 3. Les variables d'environnement

Toutes les variables sont listées dans `backend/.env.example` (**73 variables**),
`apps/web/.env.example` (2) et `apps/Mobile/.env.example` (2). **Aucune valeur n'est inventée
ici** : ce qui doit être renseigné est marqué « à renseigner ».

### 3.1 Indispensables pour démarrer

| Variable | À quoi ça sert |
| --- | --- |
| `PORT` | Port d'écoute du backend. `4000` par défaut. |
| `DATABASE_URL` | **À renseigner.** Chaîne de connexion PostgreSQL. Sans elle, rien ne démarre. |
| `SUPABASE_URL` | **À renseigner.** Adresse du projet Supabase qui gère l'authentification. |
| `SUPABASE_ANON_KEY` | **À renseigner.** Clé publique Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | **À renseigner.** Clé de service Supabase. **Ne jamais l'exposer côté client.** |
| `JWT_SECRET` | **À renseigner.** Secret de signature des jetons de session. |

### 3.2 Stockage et documents

| Variable | À quoi ça sert |
| --- | --- |
| `SUPABASE_BUCKET_PRIVATE` | Nom du panier de stockage privé pour les documents. |
| `SUPABASE_BUCKET_PUBLIC` | Nom du panier public, si utilisé. |

### 3.3 Capteurs et matériel

| Variable | À quoi ça sert |
| --- | --- |
| `IOT_*` | Connexion aux passerelles de capteurs, protocoles, seuils. |
| `LORAWAN_MQTT_URL` / `_USERNAME` / `_PASSWORD` | **À renseigner si LoRaWAN est utilisé.** Accès au broker MQTT. |
| `IOT_SILENCE_HOURS` | Durée au-delà de laquelle un capteur muet est considéré comme silencieux. |
| `SIMULATION_ENABLED` | Active le matériel simulé. À laisser désactivé hors test. |

### 3.4 Satellite et agronomie

| Variable | À quoi ça sert |
| --- | --- |
| `SATELLITE_PROVIDER` / `SATELLITE_API_URL` / `SATELLITE_API_KEY` | **À renseigner si l'imagerie satellite est utilisée.** |
| `SATELLITE_ACQUISITION_ENABLED` / `SATELLITE_REFRESH_HOURS` | Active l'acquisition et sa périodicité. |
| `SATELLITE_CLOUD_REJECT_PCT` | Pourcentage de nuages au-delà duquel une image est rejetée. |
| `AGRONOMIC_DATASET` | Jeu de données agronomiques utilisé. |
| `RECOMMENDATION_ENGINE_VERSION` | Version du moteur de recommandation. |
| `ANOMALY_DETECTION_ENABLED` | Active la détection d'anomalies de capteurs. |

### 3.5 Alertes

| Variable | À quoi ça sert |
| --- | --- |
| `ALERT_RENOTIFY_HOURS` | Délai avant de relancer une alerte non traitée. |
| `JOBS_ENABLED` | Active les tâches planifiées. **Doit être à `true` pour que les alertes partent.** |

### 3.6 SMS (Twilio)

| Variable | À quoi ça sert |
| --- | --- |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | **À renseigner si l'envoi réel de SMS est voulu.** |
| `TWILIO_SENDER_ID` | Identifiant expéditeur alphanumérique, 11 caractères maximum. |
| `TWILIO_API_BASE_URL` / `TWILIO_STATUS_CALLBACK_URL` / `TWILIO_WEBHOOK_BASE_URL` | Adresses d'API et de rappel. |
| `TWILIO_REQUEST_TIMEOUT_MS` | Délai d'attente des requêtes. |
| `SMS_DAILY_LIMIT_PER_FARMER` / `SMS_DAILY_LIMIT_PER_ORGANIZATION` | Plafonds d'envoi quotidiens. |
| `SMS_ALERT_PURPOSE` | Objet déclaré des SMS d'alerte. |

> **État du SMS :** le fournisseur est choisi (Twilio) et l'intégration est écrite. Le parcours
> de vérification du numéro est implémenté : envoi du code, vérification, et raison de non-envoi
> `PHONE_UNVERIFIED` pour toute alerte visant un numéro non confirmé. Le code de vérification
> passe par le même chemin gardé que les alertes, **sans changement de sa durée de vie, de son
> nombre de tentatives ni de son plafond horaire**. Ce qui reste à faire avec un compte réel est
> dans `backend/docs/PERIMETRE-BACKEND.md`.

### 3.7 Côté web et mobile

| Variable | Où | À quoi ça sert |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `apps/web/.env` | **À renseigner.** Adresse du backend. |
| `VITE_REALTIME_URL` | `apps/web/.env` | **À renseigner si le temps réel est utilisé.** |
| `EXPO_PUBLIC_API_BASE_URL` | `apps/Mobile/.env` | **À renseigner.** Adresse du backend, joignable depuis le téléphone. |
| `EXPO_PUBLIC_REALTIME_URL` | `apps/Mobile/.env` | **À renseigner si le temps réel est utilisé.** |

> Les variables `EXPO_PUBLIC_*` sont **intégrées dans le bundle de l'application** : n'y mettre
> aucun secret.

### 3.8 Quatre variables laissées commentées, et pourquoi

Dans `backend/.env.example`, ces quatre lignes sont **commentées** :

```
# EMAIL_WEBHOOK_URL=
# SMS_WEBHOOK_URL=
# TWILIO_STATUS_CALLBACK_URL=
# TWILIO_WEBHOOK_BASE_URL=
```

Le schéma de configuration les valide comme **URL**. Une variable présente mais vide n'est pas
considérée comme absente : c'est une chaîne vide, qui échoue à la validation et **empêche le
démarrage**. Laisser la ligne commentée rend la variable réellement absente, ce que le schéma
accepte.

**Ne les décommenter que si le service correspondant est utilisé**, et leur donner alors une URL
valide.

De la même façon, `SUPABASE_URL`, `DATABASE_URL` et `DIRECT_URL` contiennent des marques
`<project-ref>` et `<password>` : **elles doivent être remplacées** par vos vraies valeurs avant
le démarrage, sinon la validation échoue avec un message explicite.

---

## 4. État réel du projet

> **Le périmètre du backend est décrit en détail dans `backend/docs/PERIMETRE-BACKEND.md`** :
> ce qui est fait, ce qui est hors périmètre par choix, et ce qui dépend de vous. Cette
> section ne répète pas ce document.

### 4.1 Ce qui n'a pas été vérifié

À lire avant de se fier à l'apparence de l'application :

- **Aucun écran n'a été vu rendu.** Les écrans web et mobile sont vérifiés **par compilation
  uniquement** : le compilateur de types passe, le build passe. Cela prouve que le code est
  correct, pas que l'écran est beau ni lisible.
- **Les contrastes sont calculés, pas mesurés sur un rendu.** Les ratios cités dans les documents
  viennent de la formule WCAG appliquée aux valeurs de couleur. Un navigateur pourrait révéler un
  cas que le calcul ne voit pas : opacité héritée, superposition d'images, filtre, dégradé.
- **Le rendu mobile n'a pas été testé sur appareil.** Ni sur téléphone physique, ni sur
  simulateur.
- **Aucun test de bout en bout navigateur n'existe** dans ce dépôt.

### 4.2 Ce qui est vérifié

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript — web (162 pages) | passe |
| Compilation TypeScript — mobile (209 écrans) | passe |
| Build de production — web | passe |
| Vérification mobile (types + ESLint + export) | passe |
| Les 10 contrôles de cohérence du backend | passent |
| Contrat d'API : **385 routes**, 277 appels clients, 0 appel sans route, **108 routes sans appelant classées une par une** | passe |
| Surface publique : les 385 routes interrogées **sans jeton**, 11 publiques assumées, **aucun 5xx** | passe |
| Contre-épreuves (5 motifs réintroduits volontairement) | **5/5** concluantes |
| Tests unitaires purs du backend | **947** |
| Tests de bout en bout du backend | **285** |
| **Total** | **1 232** |
| Dérive de schéma Prisma (`npm run check:migrations`) | **aucune** — le contrôle échoue désormais vraiment s'il y en a une |

> `npm test` exécute **les deux** catégories : il gobe tout `tests/`, y compris `tests/e2e/`.
> Le total de 1 232 comprend donc les 285 tests de bout en bout. Pour les séparer :
> `npm run test:e2e` ne lance que ceux-là.
>
> **Correction apportée au passage.** `check-migrations.mjs` posait `process.exitCode = 1`
> en cas de dérive, mais sortait quand même 0 : l'arrêt de la base embarquée remet le
> code à zéro après coup. Le contrôle affichait donc « ❌ DRIFT détecté » et `verify`
> enchaînait comme si de rien n'était. Il pose maintenant `process.exit(1)` après
> l'arrêt, et les deux issues ont été mesurées (dérive ⇒ 1, aucune dérive ⇒ 0).
> Une dérive réelle a été trouvée et corrigée dans la foulée : l'index
> `threshold_alerts_org_level_status_idx` était créé par la migration
> `20261028000003` mais absent du schéma ; il est déclaré dans `schema.prisma` avec
> son nom explicite (`map:`), sans migration supplémentaire.

Les tests de bout en bout tournent contre un **PostgreSQL embarqué** et un fournisseur SMS
**simulé**. Aucun SMS réel n'est livré, aucun navigateur ne pilote les écrans.

### 4.3 Ajouts de la passe « compléter le backend »

Ce qui a été **implémenté et testé** depuis l'archive précédente :

- **Fenêtre de silence SMS** (`SMS_QUIET_*`) : aucune alerte ne part la nuit, plage traversant
  minuit, fuseau configurable, **fuseau inconnu refusé** plutôt que remplacé par l'heure du
  serveur. Les **OTP ne sont jamais retenus**. Un envoi retenu ne consomme pas de quota.
- **Escalade des alertes à deux niveaux** (`ALERT_ESCALATION_*`) : réservation atomique avant
  envoi (deux exécutions concurrentes ne produisent qu'une escalade), délai compté depuis
  `notifiedAt` et non depuis la dernière re-notification, retour au niveau 1 en cas d'échec.
- **OTP durci** : format E.164 vérifié **avant** tout envoi (un numéro mal formé soumis à Twilio
  est refusé **et facturé**), double plafond horaire (par numéro **et** par utilisateur), numéro
  confirmé = numéro du profil, numéro déjà pris ⇒ **409** au lieu d'une erreur interne.
- **Dépôt géospatial** : téléversement multipart jusqu'à 64 Mo avec plafond appliqué **pendant**
  la lecture du flux, lecture des en-têtes sans décoder de pixels, idempotence par réservation
  atomique, pilote **S3** dont la signature SigV4 reproduit à l'octet le vecteur officiel AWS.
- **Audit des 385 routes** : chaque route interrogée sans jeton, carte des statuts figée en
  référence, garde-fou qui fait échouer la suite si une route est exposée par erreur.

Recettes de bout en bout ajoutées : `alertEscalation` (9), `otpVerification` (10),
`surfacePublique` (8), `twilioWebhookUrl` (4), `twilioErrors` (8).

### 4.4 Démarrer avec Twilio sans toucher au code

- **La configuration est vérifiée au démarrage.** `SMS_PROVIDER=twilio` avec un secret
  manquant, un SID qui ne commence pas par `AC`, un identifiant d'expéditeur non conforme,
  ou `EMAIL_PROVIDER=resend` sans `EMAIL_API_KEY` **empêchent le démarrage**, avec un message
  qui nomme la variable. Une URL de rappel en `localhost` **avertit sans bloquer**.
- **`npm run sms:verifier-config`** interroge le compte Twilio en **lecture seule** — aucun
  SMS envoyé — et affiche : identifiants valides ou non, compte d'essai ou payant, solde,
  numéros du compte, RDC autorisée ou non, URL de rappel à coller chez Twilio. **Aucun secret
  n'apparaît**, même tronqué.
- **`npm run email:verifier-config`** fait de même pour Resend et SendGrid, et vérifie que le
  domaine de `EMAIL_FROM` est bien vérifié chez le fournisseur.
- **Les 10 codes d'erreur Twilio** (20003, 21211, 21608, 21612, 21614, 30003, 30005, 30006,
  30007, 63016) donnent un message en français avec la **cause probable** et **l'action à
  mener**, stocké dans `sms_messages.errorMessage` et renvoyé par `/sms/test-send`. Un échec
  définitif n'est plus rejoué trois fois.
- **Aucun repli silencieux sur un numéro expéditeur.** Sans `TWILIO_FALLBACK_FROM`, un refus de
  l'alphanumérique reste un refus, journalisé. Les identifiants numériques ne sont pas remis
  par Airtel en RDC.
- **Les envois Resend et SendGrid sont réels.** C'étaient des brouillons qui renvoyaient
  `delivered: false` sans appeler l'API : ajouter une commande qui valide leur clé aurait été
  trompeur.

> **Jamais testé avec un vrai compte Twilio ni un vrai téléphone.** Tout passe par un faux
> serveur HTTP local. La procédure pour un essai réel, y compris les tunnels ngrok et
> cloudflared sous Windows, est dans `backend/docs/SMS-OTP-TEST-REEL.md`.

---

## 5. Limites connues

Honnêtement, dans l'ordre de ce qui se voit le plus :

1. **L'or est devenu brun partout.** L'ancienne couleur d'accent était un or doux (`#D6A64F`). La
   palette AGRIKONNECT AFRICA ne contient aucun or : son accent est une terre cuite. Partout où
   l'application affichait de l'or, elle affiche maintenant de la terre — brun-orangé franc en
   texte et en trait, plus clair en surface. C'est le changement le plus visible du palier, sur
   les deux applications.
2. **Le texte d'erreur est un peu moins contrasté.** Il passe de 6,62:1 à 5,91:1. Toujours
   au-dessus du seuil d'accessibilité de 4,5:1, donc pas de défaut — mais le mouvement est une
   baisse. La couleur `#b91c1c` est imposée par la charte.
3. **243 emojis servent encore d'icônes côté web.** Ils ne sont pas remplacés par des icônes
   vectorielles. C'est une passe ultérieure.
4. **Les polices Expo sont conservées côté mobile.** `Inter` et `Space Grotesk` y sont déjà
   chargées et n'ont pas été retirées. Côté web, rien n'était chargé : la pile de polices système
   est utilisée.
5. **Le bouton « gold » de l'application mobile est devenu vert.** Un bouton principal ordinaire
   est toujours vert foncé dans la nouvelle charte ; la terre est réservée aux appels à l'action
   du parcours partenaire et investisseur.
6. **Les fonds de puce ont changé de famille.** Cinq blancs cassés presque identiques ont été
   remplacés par des teintes franches et distinguables. Toutes les puces de l'application
   changent d'aspect.

---

## 6. Ce qu'il reste à faire avant une mise en production

### 6.1 À voir de ses yeux

- **Produire et regarder les captures** (section 6). Tant que ce n'est pas fait, personne n'a vu
  l'application rendue avec la nouvelle palette.
- **Vérifier l'application mobile sur un appareil réel**, au moins sur les écrans principaux.
- **Tester l'accessibilité en situation** : navigation au clavier, lecteur d'écran, mode
  « mouvement réduit ». Les cibles tactiles ont été portées à 44 px (web) et 48 pt (mobile), mais
  cela n'a pas été vérifié sur appareil.

### 6.2 Les paliers non commencés

- **P2 — Typographie et rythme.** Tailles de texte, hauteurs de ligne, espacements verticaux.
- **P3 — Composants partagés.** Un même composant pour les cartes, champs, boutons et badges, au
  lieu de variantes recopiées.
- **P4 — Mouvement et accessibilité.** Durées, courbes, et respect systématique du mode
  « mouvement réduit ».

### 6.3 Dans le code

- **Remplacer les 243 emojis** servant d'icônes côté web par des icônes vectorielles.
- **Le canal SMS est choisi (Twilio) mais n'a jamais servi en réel.** L'intégration est écrite
  et couverte par une recette qui parle à un faux serveur : routage réel, préservation de
  l'identifiant alphanumérique et accusés de remise sur webhook public restent à vérifier avec
  un vrai compte et un vrai téléphone en RDC.
- **La fenêtre horaire d'envoi des SMS est implémentée mais désactivée par défaut**
  (`SMS_QUIET_HOURS_ENABLED=false`). L'activer en production est une décision à prendre : elle
  retient les alertes nocturnes, qui repartent au passage suivant.
- **Aucune résolution du fuseau par destinataire.** La RDC couvre deux fuseaux (Kinshasa UTC+1,
  Lubumbashi UTC+2) ; `Profile` n'a pas de champ `timezone`. Toute la RDC est traitée au fuseau
  de `SMS_DEFAULT_TIMEZONE`.
- **Les contrats des fournisseurs satellite ne sont pas spécifiques.** `sentinelhub` et
  `earthengine` envoient aujourd'hui le **même contrat générique** vers la même URL : aucun des
  deux ne parle le protocole réel de son fournisseur. Les appels réels existent (jeton Bearer,
  reprises), mais ils n'aboutiront pas sans ce travail.
- **Le pilote de stockage S3 n'a jamais écrit un octet dans un vrai bucket.** Sa signature est
  vérifiée contre les vecteurs officiels AWS, ce n'est pas la même chose qu'un essai réel.
- **108 routes d'API n'ont aucun appelant côté client**, sur 385. Elles existent côté serveur,
  rien ne les appelle. **Aucune n'a été supprimée** : chacune est classée (back-office, appelant
  externe, métier sans écran, exploitation) avec la preuve, dans
  `backend/docs/ROUTES-SANS-APPELANT.md`. 12 sont des routes métier qu'un écran devrait
  consommer ; 8 d'entre elles n'ont encore aucune recette.
- **Les jeux de données agronomiques par province sont provisoires** et marqués comme tels. Ils
  demandent une validation par un agronome avant de servir à une décision réelle.

### 6.4 Avant de déployer

- **Renseigner toutes les variables** de la section 3, en particulier les secrets Supabase et
  `JWT_SECRET`.
- **Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`** côté client.
- **Mettre en place une sauvegarde de la base** avant la première migration en production.

---

## 7. Documents de travail inclus

| Fichier | Ce que c'est |
| --- | --- |
| `apps/web/HARMONISATION-PALIER-P1.md` | Le compte rendu du palier P1, au format imposé. |
| `apps/web/HARMONISATION-CONVERSION.md` | La table de conversion : chaque ancienne couleur, son jeton de remplacement, la décision et sa justification. 51 lignes. **Sa section C décrit une formule depuis remplacée** — les valeurs en vigueur sont dans le compte rendu et dans `design-tokens.json`. |
| `design-tokens.json` | L'échelle de couleurs réelle du dépôt, les rôles, les paires de puces avec leur contraste, et les 7 écarts avec la référence du programme. |
| `scripts/captures-p1.mjs` | Le générateur de captures avant / après. |
| `scripts/p1-avant/` | Les 10 instantanés de l'état pré-P1, utilisés par le script de captures. |
| `backend/docs/PERIMETRE-BACKEND.md` | **À lire en premier.** Ce qui est fait, ce qui ne l'est pas, et ce qui dépend de vous. La section 2 corrige l'erreur précédente sur les adaptateurs satellite. |
| `backend/docs/ROUTES-SANS-APPELANT.md` | Les **108 routes sans appelant client**, classées une par une avec la preuve (permission, garde, recette, statut anonyme). Aucune supprimée. |
| `backend/docs/SMS-OTP-TEST-REEL.md` | **La procédure pour tester avec votre vrai téléphone** : variables, commandes exactes, réponses attendues, erreurs à reconnaître. Tant qu'elle n'a pas été menée, le parcours réel n'est pas validé. |
| `backend/docs/` | La documentation technique du backend : déploiement, traçabilité, exigences, SMS. |

---

## Annexe A — Palier P1 (couleurs)

Travail **terminé**, conservé ici parce qu'il explique les documents de la section 7 et les
instantanés de `scripts/p1-avant/`. Il ne conditionne plus rien d'autre dans ce dépôt.

### A.1 Les quatre paliers

Le travail d'harmonisation de l'apparence est découpé en quatre paliers. **Un seul est fait.**

| Palier | État |
| --- | --- |
| **P1 — Couleurs** | **Terminé et mesuré.** 34 fichiers modifiés. Contrastes calculés selon WCAG 2.1. |
| **P2 — Typographie et rythme** | **NON COMMENCÉ.** |
| **P3 — Composants partagés** | **NON COMMENCÉ.** |
| **P4 — Mouvement et accessibilité** | **NON COMMENCÉ.** |

### A.2 Les captures avant / après

**NON PRODUITES.** L'environnement de développement ne dispose d'aucun navigateur. Le script qui
les génère est fourni et fonctionne — il doit être lancé sur votre machine (annexe A.3).

### A.3 Lancer les captures avant / après

**Une seule commande, à la racine de l'archive :**

```bash
node scripts/captures-p1.mjs
```

**Où regarder :** `captures/index.html` — les 8 écrans en vis-à-vis, l'état avant à gauche,
l'état après à droite.

Les écrans protégés (tableau de bord, administration) redirigent vers la page de connexion sans
session. Pour les capturer réellement :

```bash
CAPTURE_LOGIN=votre@email CAPTURE_PASSWORD=votremdp node scripts/captures-p1.mjs
```

**Ce qu'il faut sur votre machine :** Node 20 ou plus, et un navigateur. Le script installe
Playwright et Chromium automatiquement s'ils manquent.

**Le script n'écrit jamais dans le dépôt.** Il travaille sur une copie temporaire, vérifie
l'intégrité des fichiers par sommes de contrôle avant et après, et supprime sa copie à la fin.

Les 8 écrans capturés : accueil · tableau de bord · fiche producteur · formulaire d'inscription ·
liste de données · état d'erreur · administration · écran mobile.

> **L'écran 8 n'est pas un rendu React Native.** C'est le site web affiché à 390 pixels de large,
> comme repère de mise en page. Un vrai rendu mobile demande Expo Go ou un simulateur.

---
