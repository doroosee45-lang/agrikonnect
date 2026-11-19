# Connexions Postgres (Supabase) — éviter `EMAXCONNSESSION`

## Symptôme

Des pages renvoient `500 Erreur interne du serveur` (le tableau de bord
super-admin en premier, car il lance une vingtaine de comptages en parallèle).
Le journal de l'API montre :

```
FATAL: (EMAXCONNSESSION) max clients reached in session mode
- max clients are limited to pool_size: 15
```

## Cause

`DATABASE_URL` passe par le pooler Supabase en **mode session** (port `5432` sur
`*.pooler.supabase.com`). Dans ce mode, chaque connexion ouverte par Prisma
occupe une connexion serveur pendant toute sa durée, et le plafond (`pool_size`,
15 sur l'offre de base) vaut **pour tout le projet**.

Prisma ouvre par défaut `2 × nombre de CPU + 1` connexions **par processus** :
l'API locale, l'API Render et un script lancé à côté dépassent vite 15. Le local
et la production partageant le même projet Supabase, l'un peut priver l'autre de
connexions.

## Correction (à faire dans `backend/.env` et sur Render, service `agrikonnect-api`)

Ne change **que le port et les paramètres** de l'adresse ; l'utilisateur, le mot
de passe, l'hôte et la base restent identiques.

| Variable | Rôle | Port | Paramètres |
| --- | --- | --- | --- |
| `DATABASE_URL` | requêtes de l'API | `6543` (mode transaction) | `?pgbouncer=true&connection_limit=5&schema=public` |
| `DIRECT_URL` | migrations uniquement | `5432` | `?schema=public` |

Forme attendue (valeurs fictives) :

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=5&schema=public
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public
```

- `pgbouncer=true` : Prisma n'utilise plus de requêtes préparées, incompatibles
  avec le mode transaction.
- `connection_limit=5` : chaque processus reste sous un plafond connu.

Compatibilité vérifiée : l'API n'utilise aucune fonction de session Postgres ;
le seul verrou consultatif (`jobs/index.js`) est pris et relâché dans une même
transaction, ce qui reste valable en mode transaction.

## Contrôle au démarrage

`src/config/databaseUrl.js` affiche un **avertissement** (sans jamais imprimer
l'adresse) si `DATABASE_URL` utilise le mode session, ou s'il manque
`pgbouncer=true` ou `connection_limit`. Le démarrage n'est pas bloqué.
