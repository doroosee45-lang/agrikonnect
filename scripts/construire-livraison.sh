#!/usr/bin/env bash
#
# Construction de l'archive de livraison.
#
#   bash scripts/construire-livraison.sh [chemin/sortie.zip]
#
# Le script **relit** l'archive qu'il vient de produire
# (`scripts/verifier-livraison.py`) et s'arrête si elle contient un `.env`, une
# clé, un `node_modules` ou un `storage/`. Se fier à ce que `zip` annonce avoir
# exclu ne prouve rien : c'est la table centrale de l'archive qui fait foi.
#
set -euo pipefail

cd "$(dirname "$0")/.."
RACINE="$(pwd)"

DATE="$(date +%Y%m%d)"
SORTIE="${1:-${RACINE}/agrikonnect-africa-${DATE}.zip}"

# Ce qui ne doit **jamais** entrer dans l'archive.
EXCLUSIONS=(
  "*/node_modules/*"
  "*/.env"
  "*/.env.*"
  "!*/.env.example"
  "*/storage/*"
  "*/.git/*"
  "*/.expo/*"
  "*/.next/*"
  "*/.cache/*"
  "*/.npm/*"
  "*/dist/*"
  "*/build/*"
  "*/coverage/*"
  "*/__pycache__/*"
  "*/.venv/*"
  "*/.DS_Store"
  "*.log"
  "*.zip"
  "*.sha256.txt"
  "tmp/*"
  ".cache/*"
  ".config/*"
  ".local/*"
  ".git/*"
)

echo ""
echo "  Construction de l'archive de livraison"
echo "  Racine : ${RACINE}"
echo "  Sortie : ${SORTIE}"
echo ""

rm -f "${SORTIE}"

# -q : silencieux. -X : pas d'attributs étendus. Les exclusions sont passées
# après les sources, comme l'exige `zip`.
zip -qrX "${SORTIE}" \
  backend apps scripts design-tokens.json .gitignore \
  LISEZMOI-DEMARRAGE.md LISEZ-MOI.md COHERENCE-3-PARTIES.md \
  -x "${EXCLUSIONS[@]}"

# `.env.example` est retiré par `*/.env.*` ; la négation `!` n'est pas fiable
# avec `zip`. On le rajoute explicitement, un par un.
for exemple in backend/.env.example apps/web/.env.example apps/Mobile/.env.example; do
  if [ -f "${exemple}" ]; then
    zip -qX "${SORTIE}" "${exemple}"
  fi
done

TAILLE="$(stat -c %s "${SORTIE}" 2>/dev/null || stat -f %z "${SORTIE}")"
echo "  Archive produite : ${TAILLE} octets"
echo ""

echo "  Vérification de l'archive (relecture de la table centrale)…"
if ! python3 "${RACINE}/scripts/verifier-livraison.py" "${SORTIE}"; then
  echo "  ✗ Livraison interrompue : l'archive contient des éléments interdits."
  echo "    Elle est conservée pour inspection mais ne doit pas être distribuée."
  exit 1
fi

sha256sum "${SORTIE}" > "${SORTIE}.sha256.txt" 2>/dev/null \
  || shasum -a 256 "${SORTIE}" > "${SORTIE}.sha256.txt"
echo "  Empreinte : $(cat "${SORTIE}.sha256.txt")"
echo ""
echo "  ✓ Livraison prête."
echo ""
