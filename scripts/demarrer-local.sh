#!/usr/bin/env bash
#
# Démarrage local en une commande.
#
#   bash scripts/demarrer-local.sh [--sans-demo] [--sans-mobile] [--port 4000]
#   bash scripts/demarrer-local.sh --diagnostic   # vérifie, ne lance rien
#
# Ordre réel, et pourquoi :
#
#   1. **prérequis** — mieux vaut échouer ici qu'après avoir ouvert trois ports ;
#   2. **migrations + référentiels** — avant le backend, qui suppose le schéma
#      à jour ;
#   3. **service Python** — en arrière-plan, car le backend ne vérifie pas sa
#      joignabilité au démarrage (voir le rapport d'état) ;
#   4. **backend**, puis attente de `/health` — sans ça le script de
#      démonstration échoue en trouvant un port fermé ;
#   5. **données de démonstration** — elles passent par l'API, donc par Supabase ;
#   6. **web**, puis **mobile** en avant-plan.
#
# Les processus lancés en arrière-plan sont arrêtés à la sortie (Ctrl-C inclus),
# sinon ils survivraient au terminal.
#
set -euo pipefail

cd "$(dirname "$0")/.."
RACINE="$(pwd)"

AVEC_DEMO=1
AVEC_MOBILE=1
PORT=4000
DIAGNOSTIC=0

while [ $# -gt 0 ]; do
  case "$1" in
    --sans-demo)   AVEC_DEMO=0 ;;
    --sans-mobile) AVEC_MOBILE=0 ;;
    --diagnostic)  DIAGNOSTIC=1 ;;
    --port)        PORT="$2"; shift ;;
    -h|--help)     sed -n '2,24p' "$0"; exit 0 ;;
    *)             echo "  Option inconnue : $1"; exit 2 ;;
  esac
  shift
done

PIDS=()
nettoyer() {
  # En diagnostic, rien n'a été lancé : annoncer un arrêt serait un mensonge.
  [ ${#PIDS[@]} -eq 0 ] && return 0
  echo ""
  echo "  Arrêt des services…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap nettoyer EXIT INT TERM

titre() { echo ""; echo "── $1"; }

# ─────────────────────────────── diagnostic ───────────────────────────────
#
# Vérifie tout ce qui fait échouer un démarrage, **sans rien lancer**.
#
# Pourquoi une option plutôt que laisser le lancement échouer : un échec arrive
# après trois processus ouverts et plusieurs écrans de sortie, et le message
# utile est noyé. Le diagnostic répond à la question « qu'est-ce qui manque ? »
# avant, en une page.
#
# Chaque contrôle ajoute à ERREURS (bloquant) ou AVERTISSEMENTS (non bloquant).
# Le script sort en 1 si une erreur subsiste, pour être utilisable dans un CI.

diagnostic() {
  ERREURS=()
  AVERTISSEMENTS=()
  ok()   { echo "  ✓ $1"; }
  ko()   { echo "  ✗ $1"; ERREURS+=("$1"); }
  warn() { echo "  ⚠ $1"; AVERTISSEMENTS+=("$1"); }

  echo ""
  echo "  DIAGNOSTIC — rien ne sera lancé"
  echo ""

  # ── Versions ────────────────────────────────────────────────
  echo "  Versions"
  if command -v node >/dev/null; then
    MAJEURE="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
    if [ "$MAJEURE" -ge 20 ]; then ok "node $(node -v)"; else ko "node $(node -v) — le backend exige Node 20+"; fi
  else ko "node absent"; fi
  command -v npm >/dev/null && ok "npm $(npm -v)" || ko "npm absent"
  if command -v python3 >/dev/null; then ok "python3 $(python3 --version | cut -d' ' -f2)"; else warn "python3 absent — le service géospatial ne démarrera pas"; fi
  command -v psql >/dev/null && ok "psql présent" || warn "psql absent — créez la base par un autre moyen"
  command -v curl >/dev/null && ok "curl présent" || warn "curl absent — l'attente de /health échouera"

  # ── .env ────────────────────────────────────────────────────
  echo ""
  echo "  Configuration (backend/.env)"
  if [ ! -f backend/.env ]; then
    ko "backend/.env absent — cp backend/.env.example backend/.env"
  else
    ok "backend/.env présent"
    # Lecture sans exporter : le diagnostic ne doit pas modifier l'environnement.
    # `.env.example` documente chaque variable par un commentaire en fin de
    # ligne (`SMS_PROVIDER=console   # console | twilio | …`). Sans ce retrait,
    # le commentaire fait partie de la valeur lue et s'affiche tel quel.
    lire_var() {
      sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" backend/.env \
        | head -1 \
        | sed 's/[[:space:]]*#.*$//; s/[[:space:]]*$//; s/^"//; s/"$//'
    }

    DB="$(lire_var DATABASE_URL)"
    SB_URL="$(lire_var SUPABASE_URL)"
    SB_ANON="$(lire_var SUPABASE_ANON_KEY)"
    SB_SERVICE="$(lire_var SUPABASE_SERVICE_ROLE_KEY)"

    if [ -z "$DB" ]; then
      ko "DATABASE_URL vide ou absente — le backend refuse de démarrer"
    elif [ "${DB#postgres}" = "$DB" ]; then
      ko "DATABASE_URL doit commencer par postgres:// — reçu « ${DB%%://*}://… »"
    else
      ok "DATABASE_URL renseignée (${DB%%://*}://…)"
    fi

    if [ -z "$SB_URL" ]; then ko "SUPABASE_URL vide ou absente — le backend refuse de démarrer"
    elif [ "${SB_URL#http}" = "$SB_URL" ]; then ko "SUPABASE_URL doit être une URL (http/https)"
    else ok "SUPABASE_URL renseignée"; fi

    [ -n "$SB_ANON" ] && ok "SUPABASE_ANON_KEY renseignée" || ko "SUPABASE_ANON_KEY vide — le backend refuse de démarrer"

    # Non bloquante au sens de Zod, mais sans elle **aucun compte ne peut être
    # créé** : l'inscription passe par supabaseAdmin.auth.admin.createUser.
    if [ -n "$SB_SERVICE" ]; then
      ok "SUPABASE_SERVICE_ROLE_KEY renseignée"
    else
      ko "SUPABASE_SERVICE_ROLE_KEY vide — l'inscription et le script de démonstration échoueront"
    fi

    # Information, pas anomalie : c'est l'état attendu sans Twilio ni e-mail réel.
    SMS_P="$(lire_var SMS_PROVIDER)"; [ -z "$SMS_P" ] && SMS_P="console (défaut)"
    EMAIL_P="$(lire_var EMAIL_PROVIDER)"; [ -z "$EMAIL_P" ] && EMAIL_P="console (défaut)"
    echo "  · SMS_PROVIDER   = $SMS_P"
    echo "  · EMAIL_PROVIDER = $EMAIL_P"
    case "$SMS_P|$EMAIL_P" in
      *console*) echo "    → aucun SMS ni e-mail réel : les messages s'écrivent dans la sortie du backend." ;;
    esac
  fi

  # ── Ports ───────────────────────────────────────────────────
  echo ""
  echo "  Ports"
  # `netstat` en troisième recours : c'est le seul des trois présent par défaut
  # sur Windows (donc dans Git Bash), où ni `lsof` ni `ss` n'existent.
  OUTIL_PORT=''
  if command -v lsof >/dev/null; then OUTIL_PORT='lsof'
  elif command -v ss >/dev/null; then OUTIL_PORT='ss'
  elif command -v netstat >/dev/null; then OUTIL_PORT='netstat'
  fi
  # 0 = libre · 1 = occupé · 2 = non vérifiable (aucun outil disponible)
  port_libre() {
    case "$OUTIL_PORT" in
      lsof)    ! lsof -ti:"$1" >/dev/null 2>&1 ;;
      ss)      ! ss -tln 2>/dev/null | grep -q ":$1 " ;;
      netstat) ! netstat -an 2>/dev/null | grep -Eq "[.:]$1[[:space:]].*LISTEN" ;;
      *)       return 2 ;;
    esac
  }
  for p in "$PORT" 5173 8100; do
    # `set -e` est actif : sans le `&& … || …`, un port occupé ferait sortir.
    port_libre "$p" && etat=0 || etat=$?
    if [ "$etat" -eq 0 ]; then
      ok "port $p libre"
    elif [ "$etat" -eq 2 ]; then
      # Annoncer « libre » sans avoir vérifié serait un mensonge : sous Windows
      # le diagnostic passait silencieusement à côté d'un port déjà pris.
      warn "port $p non vérifié — ni lsof, ni ss, ni netstat disponibles"
    else
      ko "port $p déjà utilisé — lsof -ti:$p | xargs kill, ou --port $((p + 100))"
    fi
  done

  # ── Base de données ─────────────────────────────────────────
  echo ""
  echo "  Connexion à la base"
  if [ -n "${DB:-}" ] && [ "${DB#postgres}" != "$DB" ]; then
    HOTE="$(echo "$DB" | sed -n 's|.*@\([^:/]*\).*|\1|p')"
    PORTDB="$(echo "$DB" | sed -n 's|.*@[^:/]*:\([0-9]*\).*|\1|p')"; [ -z "$PORTDB" ] && PORTDB=5432
    BASE="$(echo "$DB" | sed -n 's|.*/\([^?]*\).*|\1|p')"
    if [ -z "$HOTE" ]; then
      warn "hôte illisible dans DATABASE_URL — vérification ignorée"
    elif command -v psql >/dev/null; then
      if PGPASSWORD="$(echo "$DB" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')" \
         psql "$DB" -tAc 'select 1' >/dev/null 2>&1; then
        ok "connexion à $BASE@$HOTE:$PORTDB établie"
      else
        ko "connexion à $BASE@$HOTE:$PORTDB impossible — base absente, mot de passe faux, ou serveur arrêté"
      fi
    else
      warn "psql absent : connexion à la base non vérifiée"
    fi
  else
    warn "DATABASE_URL inutilisable : connexion à la base non vérifiée"
  fi

  # ── Dépendances ─────────────────────────────────────────────
  echo ""
  echo "  Dépendances installées"
  for projet in backend apps/web apps/Mobile; do
    if [ -d "$projet/node_modules" ]; then ok "$projet/node_modules"; else warn "$projet/node_modules absent — npm install --legacy-peer-deps"; fi
  done
  if command -v python3 >/dev/null && python3 -c "import numpy" 2>/dev/null; then
    ok "numpy (service géospatial)"
  else
    warn "numpy absent — python3 -m pip install -r backend/geoai/requirements.txt"
  fi

  # ── Synthèse ────────────────────────────────────────────────
  echo ""
  if [ ${#ERREURS[@]} -eq 0 ]; then
    echo "  ✓ Aucun blocage. Vous pouvez lancer : bash scripts/demarrer-local.sh"
  else
    echo "  ✗ ${#ERREURS[@]} blocage(s) à corriger avant de lancer :"
    for e in "${ERREURS[@]}"; do echo "      • $e"; done
  fi
  if [ ${#AVERTISSEMENTS[@]} -gt 0 ]; then
    echo "  ⚠ ${#AVERTISSEMENTS[@]} avertissement(s) non bloquant(s) :"
    for w in "${AVERTISSEMENTS[@]}"; do echo "      • $w"; done
  fi
  echo ""
  [ ${#ERREURS[@]} -eq 0 ]
}

if [ "$DIAGNOSTIC" -eq 1 ]; then
  if diagnostic; then exit 0; else exit 1; fi
fi

# ── 1. Prérequis ────────────────────────────────────────────────
titre "Vérification des prérequis"

manquant=0
command -v node   >/dev/null || { echo "  ✗ node absent";   manquant=1; }
command -v npm    >/dev/null || { echo "  ✗ npm absent";    manquant=1; }
command -v python3 >/dev/null || { echo "  ✗ python3 absent"; manquant=1; }
[ "$manquant" -eq 0 ] || { echo ""; echo "  Installez les prérequis (LISEZMOI-DEMARRAGE.md §1)."; exit 1; }

echo "  node     $(node -v)"
echo "  npm      $(npm -v)"
echo "  python3  $(python3 --version | cut -d' ' -f2)"

MAJEURE="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$MAJEURE" -lt 20 ]; then
  echo "  ✗ Node $(node -v) : le backend exige Node 20 ou plus."
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo ""
  echo "  ✗ backend/.env absent."
  echo "    cp backend/.env.example backend/.env, puis renseignez au minimum :"
  echo "    DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
  echo "    (LISEZMOI-DEMARRAGE.md §3.1)"
  exit 1
fi
echo "  ✓ backend/.env présent"

for projet in backend apps/web apps/Mobile; do
  if [ ! -d "$projet/node_modules" ]; then
    echo "  ⚠ $projet/node_modules absent — installation…"
    (cd "$projet" && npm install --legacy-peer-deps --no-audit --no-fund)
  fi
done

# ── 2. Base de données ──────────────────────────────────────────
titre "Migrations et référentiels"
(
  cd backend
  npx prisma migrate deploy
  npm run --silent seed
)

# ── 3. Service géospatial Python ────────────────────────────────
titre "Service géospatial (port 8100)"
if python3 -c "import numpy" 2>/dev/null; then
  (cd backend && python3 geoai/server.py --port 8100) &
  PIDS+=("$!")
  echo "  ✓ lancé (PID ${PIDS[-1]})"
else
  echo "  ⚠ numpy absent : service géospatial NON lancé."
  echo "    python3 -m pip install -r backend/geoai/requirements.txt"
  echo "    Les analyses géospatiales échoueront à l'appel."
fi

# ── 4. Backend ──────────────────────────────────────────────────
titre "Backend API (port ${PORT})"
(cd backend && PORT="$PORT" npm run dev) &
PIDS+=("$!")

echo -n "  Attente de http://localhost:${PORT}/api/v1/health "
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/api/v1/health" >/dev/null 2>&1; then
    echo ""
    echo "  ✓ backend prêt"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$_" -eq 60 ]; then
    echo ""
    echo "  ✗ le backend n'a pas répondu après 60 s. Voir sa sortie ci-dessus."
    exit 1
  fi
done

# ── 5. Données de démonstration ─────────────────────────────────
if [ "$AVEC_DEMO" -eq 1 ]; then
  titre "Données de démonstration (fictives)"
  (cd backend && node scripts/seed-demo.mjs --base-url "http://localhost:${PORT}/api/v1")
else
  titre "Données de démonstration ignorées (--sans-demo)"
fi

# ── 6. Clients ──────────────────────────────────────────────────
titre "Application web (port 5173)"
(cd apps/web && npm run dev) &
PIDS+=("$!")

if [ "$AVEC_MOBILE" -eq 1 ]; then
  titre "Application mobile (Expo)"
  (cd apps/Mobile && npm start) &
  PIDS+=("$!")
fi

cat <<EOF

  ┌──────────────────────────────────────────────────────────────┐
  │  EN LIGNE                                                    │
  ├──────────────────────────────────────────────────────────────┤
  │  API      http://localhost:${PORT}/api/v1                        │
  │  Santé    http://localhost:${PORT}/api/v1/health                 │
  │  Web      http://localhost:5173                              │
  │  Mobile   Expo (voir sa sortie)                              │
  └──────────────────────────────────────────────────────────────┘

  Lisez la sortie du backend : le rapport d'état des services y indique
  ce qui ne fonctionne pas sans configuration (SMS et e-mail en console,
  satellite simulé). Les liens de vérification s'y écrivent.

  Ctrl-C arrête tout.

EOF

wait
