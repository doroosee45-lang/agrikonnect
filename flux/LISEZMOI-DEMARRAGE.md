# AGRIKONNECT AFRICA — démarrage local

Ce document explique comment **installer, configurer et lancer** le projet sur
votre machine. Il est écrit pour être suivi dans l'ordre.

Pour l'état du projet, les limites connues et ce qui reste à faire, voir
`LISEZ-MOI.md`. Pour la cohérence entre les trois parties, voir
`COHERENCE-3-PARTIES.md`.

---

## 0. Premier lancement en 10 minutes

> **Vous n'avez ni Twilio ni fournisseur d'e-mail réel : tout reste en mode
> console.** Aucun SMS ni e-mail ne partira. Les liens de vérification et les
> alertes s'écrivent dans la **sortie du backend** — gardez ce terminal visible,
> cherchez `[EMAIL:console]` et `[SMS:console]`. C'est la seule façon de lire un
> lien de vérification.

Les étapes ci-dessous sont les **seules obligatoires**. Le reste de ce document
explique chaque point en détail ; vous pouvez y venir plus tard.

### Sur Windows : ce qui marche dans PowerShell, ce qui exige WSL ou Git Bash

**À lire avant toute commande si vous êtes sous Windows.**

Deux scripts de ce dépôt sont écrits en **bash** : `scripts/demarrer-local.sh` et
`scripts/construire-livraison.sh`. Ils **ne s'exécutent pas dans PowerShell ni
dans l'invite de commandes** — vous obtiendriez
`Le terme « bash » n'est pas reconnu` ou une erreur de syntaxe sur la première
ligne.

| Option | Verdict |
| --- | --- |
| **WSL2 (Ubuntu)** | **Recommandé.** Tout ce qui est écrit ici fonctionne tel quel, y compris `scripts/demarrer-local.sh`. PostgreSQL s'installe dans WSL. |
| **Git Bash** | `scripts/demarrer-local.sh` fonctionne, avec trois réserves ci-dessous. Suffisant pour lancer le projet. |
| **PowerShell / cmd** | Les scripts `.sh` ne fonctionnent **pas**. Toutes les autres commandes de ce guide ont un équivalent dans le tableau ci-dessous. |

Trois réserves en **Git Bash**, parce que ces outils n'existent pas sous Windows :

- `lsof` et `ss` sont absents. Le script essaie alors `netstat` (présent par
  défaut) ; si aucun des trois n'est disponible il affiche
  **« port NNNN non vérifié »** et non « libre » — il ne devine pas.
- `openssl` est absent, donc `MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"`
  échoue. Utilisez la variante PowerShell du tableau, ou WSL.
- `python3` s'appelle souvent `python` ou `py` sous Windows. Le script cherche
  `python3` ; s'il ne le trouve pas, il le signale et le service géospatial ne
  démarre pas.

#### Équivalences, commande par commande

| Ce que dit ce guide (bash) | PowerShell | Remarque |
| --- | --- | --- |
| `bash scripts/demarrer-local.sh --diagnostic` | **pas d'équivalent** | WSL ou Git Bash. Sinon faites les étapes 1 à 4 à la main. |
| `bash scripts/demarrer-local.sh` | **pas d'équivalent** | WSL ou Git Bash. |
| `cd backend && npm install …` | `cd backend; npm install …` | `&&` ne marche que dans **PowerShell 7+**. En PowerShell 5.1 (celui de Windows par défaut), mettez **une commande par ligne**. |
| `cp backend/.env.example backend/.env` | `Copy-Item backend\.env.example backend\.env` | |
| `cp .env.example .env` | `Copy-Item .env.example .env` | dans `apps/web` comme dans `apps/Mobile` |
| `npm install --legacy-peer-deps` | identique | fonctionne partout |
| `npx prisma generate` | identique | fonctionne partout |
| `npm run prisma:deploy` · `npm run seed` · `npm run dev` · `npm run verify` · `npm test` | identiques | fonctionne partout |
| `npm run contre-epreuves` | identique | script Node, **multiplateforme** |
| `cd backend && python3 -m pip install -r geoai/requirements.txt` | `cd backend; python -m pip install -r geoai\requirements.txt` | `python` ou `py -3` selon votre installation. Le chemin est **relatif à `backend/`** |
| `python3 geoai/server.py --port 8100` | `python geoai\server.py --port 8100` | |
| `python3 scripts/verifier-livraison.py archive.zip` | `python scripts\verifier-livraison.py archive.zip` | |
| `psql -U postgres -c "CREATE USER agrikon WITH PASSWORD 'agrikon';"` | identique, **si** PostgreSQL est dans le `PATH` | sinon utilisez pgAdmin, ou l'invite `psql` du menu PostgreSQL |
| `psql -U postgres -c "CREATE DATABASE agrikon OWNER agrikon;"` | identique | |
| `curl http://localhost:4000/api/v1/health` | `Invoke-RestMethod http://localhost:4000/api/v1/health` | dans PowerShell, `curl` est un **alias** vers `Invoke-WebRequest`, pas le vrai curl. Pour le vrai : `curl.exe`. |
| `lsof -ti:4000 \| xargs kill` | `Get-NetTCPConnection -LocalPort 4000 \| Select-Object -Expand OwningProcess \| ForEach-Object { Stop-Process -Id $_ -Force }` | libérer un port |
| `MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"` | `-join ((1..64) \| ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })` | 64 caractères hexadécimaux, comme `openssl rand -hex 32` |
| `bash scripts/construire-livraison.sh` | **pas d'équivalent** | WSL ou Git Bash |

> **Honnêteté sur cette colonne.** Les commandes PowerShell ci-dessus n'ont
> **pas été exécutées** : PowerShell n'est pas installé dans l'environnement où
> ce guide a été écrit. La colonne bash, elle, a été lancée. Si une variante
> PowerShell résiste, la cause la plus probable est la version : PowerShell 5.1
> (fourni avec Windows) et PowerShell 7 n'acceptent pas les mêmes opérateurs
> (`&&`, `||`). Passez en WSL, c'est le chemin le plus court.

> Les chemins : PowerShell accepte la barre oblique `/` dans la plupart des
> cmdlets, mais les outils natifs attendent `\`. En cas de doute, utilisez `\`.

### Un diagnostic avant de commencer

```bash
bash scripts/demarrer-local.sh --diagnostic
```

Vérifie Node, Python, les ports libres, la présence du `.env`, les variables
renseignées et la connexion à la base — **sans rien lancer**. Il dit ce qui
manque. Faites-le d'abord : la plupart des échecs de démarrage sont annoncés là.

### 1. Installer (≈ 3 min)

```bash
cd backend      && npm install --legacy-peer-deps && npx prisma generate && cd ..
cd apps/web     && npm install --legacy-peer-deps && cd ../..
cd apps/Mobile  && npm install --legacy-peer-deps && cd ../..
```

`--legacy-peer-deps` est **obligatoire** sur le web et le mobile.

### 2. Créer le `.env` (≈ 2 min)

```bash
cp backend/.env.example backend/.env
```

Ouvrez `backend/.env` et renseignez **quatre** valeurs :

```bash
DATABASE_URL="postgresql://agrikon:agrikon@localhost:5432/agrikon?schema=public"
SUPABASE_URL="https://VOTRE-PROJET.supabase.co"
SUPABASE_ANON_KEY="votre-cle-anon"
SUPABASE_SERVICE_ROLE_KEY="votre-cle-service-role"
```

Laissez tout le reste tel quel. En particulier **`SMS_PROVIDER=console`** et
**`EMAIL_PROVIDER=console`** : c'est ce que vous voulez ici.

### 3. Créer la base (≈ 1 min)

```bash
psql -U postgres -c "CREATE USER agrikon WITH PASSWORD 'agrikon';"
psql -U postgres -c "CREATE DATABASE agrikon OWNER agrikon;"
```

### 4. Lancer (≈ 1 min, puis ça tourne)

```bash
bash scripts/demarrer-local.sh
```

Le script fait : migrations → référentiels → service Python → backend → attente
de `/health` → données de démonstration → web.

### 5. Se connecter

| Rôle | Adresse | Mot de passe |
| --- | --- | --- |
| agriculteur | `agriculteur.demo@agrikonnect.test` | `Demonstration!2026` |
| agronome | `agronome.demo@agrikonnect.test` | `Demonstration!2026` |

Web : <http://localhost:5173> · API : <http://localhost:4000/api/v1>

> Les recommandations sur ces données seront **indicatives** : aucune plage
> agronomique n'est validée tant que le formulaire agronome n'est pas rempli.
> C'est l'état normal, pas un dysfonctionnement.

### Les dix erreurs de démarrage les plus probables

Chaque message ci-dessous est **celui qui s'affiche réellement**. La colonne
« vérifié » dit comment il a été obtenu :

- **déclenché** = reproduit en cassant volontairement la configuration ;
- **lu dans le code** = le texte vient du script ou du module, mais la situation
  n'a pas pu être reproduite ici (outil déjà installé, ou réponse qui dépend de
  votre projet Supabase).

#### 1. `DATABASE_URL` absente ou mal formée — *déclenché*

```
❌ Variables d'environnement invalides :

   • DATABASE_URL — DATABASE_URL doit être une URL PostgreSQL

👉 Copie .env.example vers .env et complète les valeurs.
```

Si la variable est absente ou vide, le détail est `DATABASE_URL est requis`.
Sinon, c'est le schéma qui ne commence pas par `postgres` (`mysql://…`, ou
`localhost:5432/agrikon` sans préfixe).

*Correction* : `postgresql://utilisateur:motdepasse@hôte:port/base?schema=public`.

#### 2. `SUPABASE_URL` mal formée — *déclenché*

```
❌ Variables d'environnement invalides :

   • SUPABASE_URL — SUPABASE_URL doit être une URL valide

👉 Copie .env.example vers .env et complète les valeurs.
```

*Correction* : l'URL complète du projet, `https://xxxxxxxx.supabase.co`, sans
barre oblique finale ni `\"` superflu.

#### 3. Une variable obligatoire manque — *déclenché*

```
❌ Variables d'environnement invalides :

   • SUPABASE_ANON_KEY — Required

👉 Copie .env.example vers .env et complète les valeurs.
```

`Required` signifie « la ligne est absente ou vide ». Les trois dures sont
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

*Correction* : recopier `.env.example` et remplir, plutôt qu'éditer à la main un
fichier incomplet.

#### 4. Port déjà utilisé — *déclenché*

```
[ERROR] UncaughtException : {
  message: 'listen EADDRINUSE: address already in use 0.0.0.0:4000',
```

Un backend précédent tourne encore. `scripts/demarrer-local.sh` arrête ses propres
processus à la sortie, mais pas un backend lancé à la main dans un autre
terminal.

*Correction* :

```bash
lsof -ti:4000 | xargs kill                   # bash
bash scripts/demarrer-local.sh --port 4100   # ou changer de port
```

PowerShell — voir le tableau « Sur Windows ».

#### 5. Base de données injoignable — *déclenché*

```
Error: P1001: Can't reach database server at `localhost:5432`
```

Apparaît à `npm run prisma:deploy`, **pas** au démarrage du backend : Prisma se
connecte tardivement. Trois causes : serveur PostgreSQL arrêté, mauvais port,
base jamais créée.

*Correction* : reprendre l'étape 3 (créer l'utilisateur et la base).

#### 6. Dépendances non installées — *déclenché*

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express' imported from /home/user/backend/src/app.js
```

*Correction* : `cd backend && npm install --legacy-peer-deps`. Idem pour
`apps/web` et `apps/Mobile` — chaque dossier a **son propre** `node_modules`.

#### 7. Client Prisma non généré — *déclenché*

```
SyntaxError: Named export 'PrismaClient' not found. The requested module
'@prisma/client' is a CommonJS module, which may not support all module.exports
as named exports.
```

Message trompeur : il parle de CommonJS, alors que la vraie cause est l'absence
du client généré.

*Correction* : `cd backend && npx prisma generate`. À refaire après chaque
modification de `backend/prisma/schema.prisma`.

#### 8. Inscription refusée — clé de service Supabase manquante — *composé, partiellement vérifié*

`SUPABASE_SERVICE_ROLE_KEY` est **optionnelle au démarrage** (le backend part
sans), mais `register()` appelle `supabaseAdmin.auth.admin.createUser`, qui
l'exige. Le script de démonstration échoue alors ainsi :

```
  ✗ Échec : création de agriculteur.demo@agrikonnect.test impossible (422) : <texte renvoyé par Supabase>
  → vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans backend/.env
```

Ce message est **composé à l'exécution** par `backend/scripts/seed-demo.mjs`
(ligne 408 pour `✗ Échec :`, ligne 263 pour la suite) : une recherche littérale
dans le code ne le trouve pas. Depuis l'écran d'inscription, le même échec donne
un **422** avec le texte de Supabase dans `message`.

Ce qui est vérifié ici : le statut **422**, et que la clé anon ne suffit pas. Ce
qui ne l'est pas : le `<texte renvoyé par Supabase>`, qui dépend de votre projet
et n'est pas reproductible hors ligne.

*Correction* : Settings → API → `service_role key` →
`SUPABASE_SERVICE_ROLE_KEY` dans `backend/.env`. **Ne jamais** l'exposer côté
client.

#### 9. Tests de bout en bout : répertoire déjà peuplé — *déclenché*

```
Postgres init script failed (code: 1, signal: null). ERROR OUTPUT:
initdb: error: directory "/tmp/agrikon-e2e-pg" exists but is not empty
```

Un lancement de tests interrompu laisse un répertoire de données PostgreSQL.

*Correction* : `rm -rf /tmp/agrikon-e2e-pg` (PowerShell :
`Remove-Item -Recurse -Force $env:TEMP\agrikon-e2e-pg`).

Précision mesurée : un répertoire **vide** ne gêne pas — les recettes passent.
Seul un répertoire **peuplé** échoue.

#### 10. Python ou numpy absent — *lu dans le code*

Le service géospatial ne démarre pas. `scripts/demarrer-local.sh --diagnostic` affiche :

```
  ⚠ numpy absent — python3 -m pip install -r backend/geoai/requirements.txt
```

et, si `python3` lui-même manque :

```
  ⚠ python3 absent — le service géospatial ne démarrera pas
```

Non bloquant : le backend tourne sans ce service. Sous Windows, `python3`
s'appelle souvent `python` ou `py` — le script cherche `python3` et le signale.

*Correction* : `cd backend && python3 -m pip install -r geoai/requirements.txt`.

---

> **Un mot sur `--legacy-peer-deps`.** Ce guide le présente comme obligatoire.
> Vérifié aujourd'hui sur une **installation fraîche** (dossier vide, avec les
> trois `package-lock.json` livrés — `backend/package-lock.json`,
> `apps/web/package-lock.json`, `apps/Mobile/package-lock.json`) :
> `apps/web` et `apps/Mobile` s'installent
> **sans** le drapeau, code de sortie 0, aucun `ERESOLVE`. Gardez-le quand même :
> il ne coûte rien et protège si npm resserre un jour la résolution des
> dépendances pairs.

---

## 1. Prérequis

| Outil | Version requise | Vérifié avec | Comment vérifier |
| --- | --- | --- | --- |
| **Node.js** | ≥ 20 (`engines` du backend) | v20.20.2 | `node -v` |
| **npm** | ≥ 10 | 10.8.2 | `npm -v` |
| **Python** | ≥ 3.11 | 3.13.16 | `python3 --version` |
| **PostgreSQL** | ≥ 14 | — | `psql --version` |

**PostGIS n'est pas nécessaire.** Les géométries sont stockées en `Json`
(`backend/prisma/schema.prisma:398`) et le calcul spatial est fait par le moteur Python
(`backend/geoai`). Aucune fonction `ST_*` n'est utilisée.

Python n'est requis **que** pour le service géospatial (`backend/geoai`) et ses
tests. Le backend, le web et le mobile démarrent sans lui — les analyses
géospatiales échoueront alors **à l'appel**.

⚠ **Le rapport de démarrage ne le signale pas.** L'entrée `geoai` du rapport est
au niveau `ok` (« URL configurée. Sa joignabilité n'est pas testée au
démarrage ») et les entrées `ok` ne s'affichent qu'en mode verbeux. Ne vous
fiez donc pas à l'absence d'avertissement pour conclure que le service Python
tourne : vérifiez `http://localhost:8100/health`.

---

## 2. Installation

Trois projets indépendants, **aucun `package.json` à la racine** :

```bash
# Backend
cd backend
npm install --legacy-peer-deps
npx prisma generate

# Web
cd ../apps/web
npm install --legacy-peer-deps

# Mobile
cd ../apps/Mobile
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` est **nécessaire** sur le web et le mobile : les arbres
> de dépendances (Expo/React Native d'un côté, React 18 de l'autre) ont des
> contraintes de pairs incompatibles. Un `npm install` simple échoue.

Dépendances Python du service géospatial :

```bash
cd backend
python3 -m pip install -r geoai/requirements.txt
```

> `node_modules` n'est pas dans l'archive : il est à réinstaller à chaque
> récupération du ZIP.

---

## 3. Créer le fichier `.env`

```bash
cd backend
cp .env.example .env
```

Le fichier `.env.example` contient **73 variables documentées** et 4 laissées
commentées. Presque toutes ont une valeur par défaut utilisable en local.

### 3.1 Ce que vous **devez** renseigner

Sans ces cinq-là, le backend refuse de démarrer ou ne peut rien faire d'utile :

| Variable | Obligatoire ? | Ce qui se passe sans |
| --- | --- | --- |
| `DATABASE_URL` | **oui** — démarrage refusé | `DATABASE_URL est requis` à la validation d'environnement |
| `SUPABASE_URL` | **oui** — démarrage refusé | `SUPABASE_URL doit être une URL valide` |
| `SUPABASE_ANON_KEY` | **oui** — démarrage refusé | validation d'environnement |
| `SUPABASE_SERVICE_ROLE_KEY` | non, mais **indispensable en pratique** | **l'inscription échoue** : la création de compte passe par `supabaseAdmin.auth.admin.createUser`. Le script de démonstration ne peut pas créer ses comptes |
| `MFA_ENCRYPTION_KEY` | non en développement, **oui en production** | en local, une clé de développement dérivée est utilisée — signalée au démarrage comme non sûre |

Exemple minimal pour un poste local :

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://agrikon:agrikon@localhost:5432/agrikon?schema=public"
SUPABASE_URL="https://VOTRE-PROJET.supabase.co"
SUPABASE_ANON_KEY="votre-cle-anon"
SUPABASE_SERVICE_ROLE_KEY="votre-cle-service-role"
MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
```

> `SUPABASE_URL` est une **URL**, pas une clé : la validation exige un schéma
> (`https://…`). Une valeur vide ou malformée arrête le démarrage.

### 3.2 Les 4 variables laissées commentées

`EMAIL_WEBHOOK_URL`, `SMS_WEBHOOK_URL`, `TWILIO_STATUS_CALLBACK_URL` et
`TWILIO_WEBHOOK_BASE_URL` sont commentées dans `.env.example`. Ce sont des
**URL entrantes** : elles n'ont de sens qu'une fois le backend exposé sur
Internet. Les renseigner en local avec `localhost` produirait des rappels que
personne ne peut atteindre.

### 3.3 Variables des clients

```bash
cd apps/web    && cp .env.example .env
cd apps/Mobile && cp .env.example .env
```

Elles pointent vers l'API locale (voir §3.8 de `LISEZ-MOI.md`).

---

## 4. Base de données locale

```bash
# Créer la base et l'utilisateur
psql -U postgres -c "CREATE USER agrikon WITH PASSWORD 'agrikon';"
psql -U postgres -c "CREATE DATABASE agrikon OWNER agrikon;"

# Appliquer les 16 migrations
cd backend
npm run prisma:deploy

# Charger les référentiels (pays, provinces, cultures, unités)
npm run seed
```

`npm run seed` est **idempotent** et ne crée que des référentiels publics
vérifiables : aucun compte, aucune ferme, aucune parcelle. Les données de
démonstration sont un script distinct (§6).

> `npm run prisma:migrate` (`migrate dev`) est pour le développement du schéma ;
> pour installer le projet tel quel, c'est `prisma:deploy`.

---

## 5. Lancement

Quatre processus, quatre terminaux :

```bash
# 1. Service géospatial Python (optionnel, voir §7)
cd backend && python3 geoai/server.py --port 8100

# 2. Backend API
cd backend && npm run dev          # http://localhost:4000/api/v1

# 3. Web
cd apps/web && npm run dev         # http://localhost:5173

# 4. Mobile
cd apps/Mobile && npm start        # Expo
```

Vérifier que le backend répond :

```bash
curl http://localhost:4000/api/v1/health
```

---

## 6. Données de démonstration

```bash
cd backend
node scripts/seed-demo.mjs
```

Le script crée **un compte agriculteur** et **un compte agronome**, une ferme et
une parcelle fictives, et une analyse de sol fictive.

| Rôle | Adresse | Mot de passe |
| --- | --- | --- |
| agriculteur | `agriculteur.demo@agrikonnect.test` | `Demonstration!2026` |
| agronome | `agronome.demo@agrikonnect.test` | `Demonstration!2026` |

**Toutes ces données sont fictives.** Le domaine `.test` est réservé (RFC 6761)
et ne résout jamais : aucun message réel ne peut y être envoyé. Les coordonnées
ne correspondent à aucune parcelle cadastrée. Les valeurs de sol sont
`source: 'declared'` — ni laboratoire, ni capteur.

Le script est **idempotent** : relancé, il se reconnecte aux comptes existants
au lieu de les dupliquer.

**Prérequis :** le backend doit tourner **et** `SUPABASE_SERVICE_ROLE_KEY` doit
être renseignée. Sans elle, le script échoue en le disant, plutôt que de créer
des profils incapables de se connecter.

Options : `--base-url http://localhost:4000/api/v1`, `--attente 60` (secondes).

### 6.1 Une commande pour tout lancer

```bash
bash scripts/demarrer-local.sh
```

Le script vérifie les prérequis, lance le service Python et le backend, attend
`/health`, applique les migrations, charge les référentiels, crée les données de
démonstration, puis lance le web. `--sans-demo` saute la création de comptes ;
`--sans-mobile` ne lance pas Expo.

---

## 7. Ce qui ne marche pas sans configuration

Le backend **démarre** sans service externe, mais une partie des fonctions ne
produit aucun effet. Il l'annonce au démarrage, en avertissement :

```
┌──────────────────────────────────────────────────────────────┐
│  ÉTAT DES SERVICES EXTERNES AU DÉMARRAGE                     │
└──────────────────────────────────────────────────────────────┘
  ⚠ sms — console
      Aucun SMS ne part. Les messages sont écrits dans les journaux…
  ⚠ email — console
      Aucun e-mail ne part. Les liens de vérification d'adresse…
```

| Service | Sans configuration | Conséquence | Pour l'activer |
| --- | --- | --- | --- |
| **SMS** | `SMS_PROVIDER=console` | Aucune alerte de seuil ni code OTP délivré ; les messages s'écrivent dans les journaux (`[SMS:console]`) | `SMS_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` |
| **E-mail** | `EMAIL_PROVIDER=console` | Aucun lien de vérification ni de réinitialisation envoyé (`[EMAIL:console]`) | `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` |
| **Satellite** | `SATELLITE_PROVIDER=simulated` | Les indices sont **générés**, pas acquis | `SATELLITE_PROVIDER=sentinelhub` + `SATELLITE_API_KEY` |
| **Capteurs** | mode `SIMULATION` | Les mesures peuvent être simulées (marquées comme telles en base) | `SIMULATION_ENABLED=false` + mode `REAL` |
| **Géospatial** | `GEOSPATIAL_STORAGE_DRIVER=local` | Les dépôts sont écrits sur le disque local, non partagés | `GEOSPATIAL_STORAGE_DRIVER=object` + `GEOSPATIAL_BUCKET` |
| **geoai** | service Python non lancé | Les analyses géospatiales échouent à l'appel. **La joignabilité n'est pas testée au démarrage** | `python3 geoai/server.py` |

Deux points à retenir :

1. **Le mode console écrit dans les journaux.** C'est la seule façon de lire un
   lien de vérification en local : regardez la sortie du backend, cherchez
   `[EMAIL:console]`.
2. **`JOBS_ENABLED=false` désactive le planificateur** : plus d'expiration
   d'annonces, plus de ré-notification d'alertes, plus de purge.

---

## 8. Côté Supabase — variables à configurer dans le tableau de bord

Renseigner `SUPABASE_URL` et les clés dans `.env` ne suffit **pas**. Trois
réglages vivent dans le projet Supabase lui-même.

### 8.1 `SITE_URL`

**Auth → URL Configuration → Site URL.**

C'est l'origine que GoTrue utilise pour construire les liens de ses e-mails. En
local :

```
http://localhost:5173
```

### 8.2 URL de redirection (`Redirect URLs`)

**Auth → URL Configuration → Redirect URLs.**

L'application passe une URL de redirection explicite :

```
http://localhost:5173/auth/verify-email
http://localhost:5173/auth/reset
```

GoTrue **refuse** une URL de redirection qui n'est pas dans cette liste. Sans
cela, le renvoi du lien de vérification échoue.

> **Attention au chemin.** Les routes du client web sont `/auth/verify-email` et
> `/auth/reset` — pas `/verify-email` ni `/reset-password`. Le backend
> construisait auparavant ces derniers, et le routeur web les envoyait sur sa
> page 404 (`<Route path="*">`) sans aucune erreur nulle part. Les chemins sont
> maintenant centralisés dans `backend/src/shared/links.js` et confrontés aux
> routes réelles par `backend/tests/webLinks.test.mjs`.

### 8.3 Où finit réellement l'URL de redirection — **non vérifié**

`supabase.auth.resend()` n'envoie pas l'URL dans le corps de la requête :
`@supabase/auth-js` 2.109.0 la passe à `_request({ redirectTo })`, qui en fait un
**paramètre de requête** `?redirect_to=…`. C'est vérifié.

Ce qui **n'est pas** vérifié, c'est le corps final de l'e-mail : il est produit
par le mailer de GoTrue, hors de ce dépôt. Selon sa configuration
(`GOTRUE_MAILER_URLPATHS_CONFIRMATION`), GoTrue peut construire un chemin
différent de celui transmis. **À contrôler sur votre projet réel avant de
compter sur le lien.**

### 8.4 Les trois clés

| Clé | Où la trouver | Rôle |
| --- | --- | --- |
| `SUPABASE_ANON_KEY` | Settings → API | appels côté client |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API | création de comptes, opérations d'administration. **Ne jamais l'exposer côté client ni l'archiver** |
| Jeton du projet | Settings → API | utilisé par le middleware `authenticate` |

---

## 9. Vérifier l'archive reçue

```bash
python3 scripts/verifier-livraison.py agrikonnect-africa-XXXXXXXX.zip
```

Le script **relit la table centrale** de l'archive et refuse une livraison
contenant `.env`, une clé, `node_modules/` ou `storage/`. Il scanne aussi le
contenu des fichiers texte à la recherche de motifs de secret.

Auto-test intégré — construit une archive volontairement polluée et vérifie que
chaque catégorie est détectée :

```bash
python3 scripts/verifier-livraison.py --selftest
```

Sans cet auto-test, un vérificateur dont le filtre est cassé affiche « tout va
bien » indéfiniment.

> Une clé réelle dans une archive est un incident de sécurité, pas un détail de
> livraison.

---

## 10. Vérifications du projet

```bash
cd backend
npm run verify        # 10 contrôles + 1064 tests + contrat de montage + smoke HTTP
npm test              # 1064 tests au total
node --test tests/e2e/   # 224 recettes de bout en bout, seules
```

**Comptes séparés** — `npm test` globbe `tests/`, donc il inclut les recettes de
bout en bout :

| | |
| --- | --- |
| `npm test` (tout) | **1064 / 1064** |
| e2e seuls | **224 / 224** |
| **unitaires purs** | **840 / 840** |

**840 unitaires purs + 224 e2e = 1064.**

```bash
npm run contre-epreuves   # rejoue les contre-épreuves des garde-fous structurels
```

Ce dernier script réintroduit volontairement chaque défaut que les tests de scan
sont censés attraper, vérifie que le test échoue **en nommant le bon motif**,
puis restaure les fichiers et vérifie leur identité par empreinte. Il est
multiplateforme (Node, pas de bash) et ne laisse jamais le dépôt modifié —
y compris s'il est interrompu : voir l'en-tête de
`backend/scripts/contre-epreuves.mjs`.

Les recettes e2e montent un PostgreSQL embarqué et un stub GoTrue : **elles ne
touchent pas votre base**. Elles écrivent dans `/tmp/agrikon-e2e-pg`, qu'elles
recréent à chaque lancement — si un lancement précédent a été interrompu,
supprimez ce répertoire avant de relancer.

```bash
cd backend && npm run test:geoai             # 134 tests du moteur Python
cd backend/geoai && python3 -m pytest -q     # les mêmes, via pytest
cd apps/web    && npm run typecheck          # 0 erreur
cd apps/Mobile && npm run typecheck          # 0 erreur
```

---

## 11. Dépannage courant

| Symptôme | Cause | Remède |
| --- | --- | --- |
| `initdb: error: directory "/tmp/agrikon-e2e-pg" exists but is not empty` | recette e2e interrompue (répertoire **peuplé** — un répertoire vide ne gêne pas) | `rm -rf /tmp/agrikon-e2e-pg` |
| `npm install` échoue sur le web ou le mobile avec `ERESOLVE` | conflits de dépendances pairs | `npm install --legacy-peer-deps`. **Non reproduit aujourd'hui** : installation fraîche testée sans le drapeau, code 0 |
| Inscription refusée en 422 | `SUPABASE_SERVICE_ROLE_KEY` manquante | la renseigner (§3.1) |
| Le lien de vérification mène à une page 404 | `Redirect URLs` non configurées côté Supabase | §8.2 |
| « Données insuffisantes » sur les recommandations | aucune mesure sur la parcelle | lancer `cd backend && node scripts/seed-demo.mjs` |
| Recommandation refusée : « Aucun calendrier cultural pour la province … » | province hors périmètre | seules **Équateur** et **Bandundu** ont un calendrier — et il est **provisoire** |
| Les analyses géospatiales échouent | service Python non lancé | `python3 geoai/server.py --port 8100` |

---

## 12. Ce que personne n'a vu à l'écran

Les écrans web et mobile sont **vérifiés par compilation uniquement**
(`tsc --noEmit`, 0 erreur des deux côtés) et par des tests de scan structurel.
Aucun navigateur ni émulateur n'a piloté ces pages dans l'environnement où le
projet a été développé.

**C'est à vous de les voir.** Les listes précises figurent dans :

- `backend/docs/COMPTE-RENDU-ECRAN3-ALERTES.md` §6 — boîte d'alertes (le plus
  récent) ;
- `backend/docs/COMPTE-RENDU-ECRAN2-LIVRAISON.md` §5 — recommandations, et les
  écarts reportés des étapes précédentes ;
- `backend/docs/COMPTE-RENDU-MFA-EMAIL.md` §4 — MFA et vérification d'adresse ;
- `LISEZ-MOI.md` §4.3 — synthèse.
