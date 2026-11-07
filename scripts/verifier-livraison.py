#!/usr/bin/env python3
"""
Vérification de l'archive de livraison.

    python3 scripts/verifier-livraison.py <archive.zip> [--verbose]
    python3 scripts/verifier-livraison.py --selftest

## Pourquoi un script plutôt qu'un `unzip -l | grep`

Parce qu'une exclusion ratée ne se voit pas : l'archive se construit, elle a la
bonne taille, et le `.env` est dedans. Ce script **relit l'archive produite**
(module `zipfile`, donc la table centrale réelle — pas ce que `zip` a annoncé
avoir fait) et refuse de laisser passer une livraison contenant un secret.

Une clé réelle dans une archive n'est pas un détail de livraison : c'est un
incident de sécurité. Ce script sort en code 1, et `construire-livraison.sh`
s'arrête.

## Ce qui est vérifié

1. **Chemins interdits** — `.env` (mais pas `.env.example`), `node_modules/`,
   `storage/`, `.git/`, artefacts de build, clés et certificats.
2. **Contenu** — recherche de motifs de secret dans les fichiers texte :
   jetons Supabase, clés Twilio, clés d'API, clés privées, mots de passe
   affectés en dur.
3. **Auto-test** (`--selftest`) — construit une archive volontairement
   polluée dans un répertoire temporaire et vérifie que chaque catégorie est
   bien détectée. Sans lui, un script de vérification qui ne trouve jamais rien
   est indiscernable d'un script cassé.
"""

from __future__ import annotations

import io
import os
import re
import sys
import tempfile
import zipfile

# ─────────────────────────── chemins interdits ───────────────────────────

INTERDITS = [
    (r"(^|/)\.env$", ".env réel (secrets de l'environnement)"),
    (r"(^|/)\.env\.(?!example$)[^/]+$", "fichier .env.* autre que .env.example"),
    (r"(^|/)node_modules/", "node_modules (à réinstaller chez le destinataire)"),
    (r"(^|/)storage/", "storage/ (dépôts géospatiaux et médias locaux)"),
    (r"(^|/)\.git/", "répertoire .git"),
    (r"(^|/)\.git-credentials$", "identifiants git"),
    (r"(^|/)\.netrc$", "fichier .netrc"),
    (r"(^|/)\.expo/", "cache Expo"),
    (r"(^|/)\.next/", "build Next.js"),
    (r"(^|/)\.cache/", "cache"),
    (r"(^|/)\.npm/", "cache npm"),
    (r"(^|/)dist/", "artefact de build"),
    (r"(^|/)build/", "artefact de build"),
    (r"(^|/)coverage/", "rapport de couverture"),
    (r"(^|/)__pycache__/", "bytecode Python"),
    (r"(^|/)\.venv/", "environnement virtuel Python"),
    (r"\.(pem|key|p12|pfx|keystore|jks)$", "clé ou certificat"),
    (r"(^|/)id_rsa(\.pub)?$", "clé SSH"),
    (r"(^|/)(secret|secrets)\.(json|ya?ml)$", "fichier de secrets"),
    (r"(^|/)\.DS_Store$", "métadonnée macOS"),
]

INTERDITS_COMPILES = [(re.compile(motif), raison) for motif, raison in INTERDITS]

# ─────────────────────────── motifs de secret ───────────────────────────

"""
Chaque motif est accompagné d'une liste d'**exclusions** : les fichiers où le
motif est attendu (exemple, test, documentation) ne doivent pas déclencher
d'alerte, sinon le script sera désactivé au premier faux positif.
"""
MOTIFS = [
    {
        "nom": "jeton Supabase / JWT signé",
        "re": re.compile(r"\beyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{10,}"),
        "exclure": [],
    },
    {
        "nom": "clé Twilio",
        "re": re.compile(r"\b(?:SK|AC)[0-9a-fA-F]{32}\b"),
        "exclure": [r"SMS-TWILIO\.md$", r"\.test\.mjs$", r"\.md$"],
    },
    {
        "nom": "clé privée",
        "re": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
        "exclure": [r"\.md$"],
    },
    {
        "nom": "clé d'API affectée",
        "re": re.compile(
            r"(?i)\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|EMAIL_API_KEY|"
            r"TWILIO_AUTH_TOKEN|MFA_ENCRYPTION_KEY|SATELLITE_API_KEY|GEOAI_TOKEN)\b"
            r"\s*[:=]\s*['\"]?[A-Za-z0-9_\-\.]{20,}"
        ),
        # `.env.example` livre ces noms **vides** ou avec des valeurs
        # manifestement fictives ; les tests et la doc les citent.
        "exclure": [r"\.env\.example$", r"\.test\.mjs$", r"\.md$", r"\.json$"],
    },
]

EXTENSIONS_BINAIRES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
    ".tgz", ".mp3", ".mp4", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pyc", ".so", ".dylib", ".dll", ".db", ".sqlite",
}

TAILLE_MAX_SCAN = 512 * 1024  # 512 Ko : au-delà, ce n'est pas un fichier de configuration

"""
Marqueurs de valeur **manifestement fictive**.

Exclure par chemin (`*.test.mjs`) ne suffit pas : les jeux de données de test
vivent aussi dans des fichiers d'accompagnement comme
`tests/e2e/support/harness.mjs`, qui pose `SUPABASE_SERVICE_ROLE_KEY:
'service-role-key-e2e'`. Exclure ce fichier par son nom ouvrirait un trou —
quelqu'un pourrait y coller une vraie clé.

On filtre donc sur la **valeur capturée** : une valeur qui se dit de test est
ignorée, une valeur qui n'en dit rien est signalée où qu'elle se trouve.
"""
MARQUEURS_FICTIFS = re.compile(
    r"(?i)(e2e|placeholder|example|exemple|dummy|fake|fixture|test\b|changeme|"
    r"xxxx|votre|your[-_]|a-remplacer|todo|secret-local)"
)


"""
Référence de variable plutôt que valeur.

`server.js` contient `TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN` — le câblage du
rapport de démarrage. Le motif « clé affectée » y voyait une clé, alors qu'il n'y
a aucune valeur du tout : c'est une lecture de configuration. Reconnaître la
forme `env.X` / `process.env.X` / `cfg.X` évite de signaler le code qui *passe*
la variable au lieu de celui qui la *fixe*.
"""
REFERENCE_VARIABLE = re.compile(
    r"^(?:process\.)?(?:env|cfg|config|options|opts|params|settings)\.[A-Za-z_$][A-Za-z0-9_$]*$"
)


def valeur_fictive(valeur: str) -> bool:
    """Valeur manifestement de test, ou simple référence à une variable."""
    if MARQUEURS_FICTIFS.search(valeur):
        return True
    # Partie droite d'une affectation `CLE=valeur` ou `CLE: valeur`.
    droite = re.split(r"[:=]", valeur, maxsplit=1)
    candidate = droite[1].strip().strip("\"'") if len(droite) > 1 else valeur.strip()
    return bool(REFERENCE_VARIABLE.match(candidate))


def est_binaire(nom: str) -> bool:
    return os.path.splitext(nom)[1].lower() in EXTENSIONS_BINAIRES


def verifier_archive(chemin: str, verbose: bool = False):
    """Relit l'archive et renvoie `(problemes, statistiques)`."""
    problemes: list[tuple[str, str, str]] = []  # (catégorie, détail, raison)
    stats = {"entrees": 0, "dossiers": 0, "fichiers": 0, "octets": 0, "scannes": 0}

    if not zipfile.is_zipfile(chemin):
        return [("-", chemin, "n'est pas une archive ZIP lisible")], stats

    with zipfile.ZipFile(chemin, "r") as archive:
        for info in archive.infolist():
            nom = info.filename
            stats["entrees"] += 1
            if info.is_dir() or nom.endswith("/"):
                stats["dossiers"] += 1
                continue
            stats["fichiers"] += 1
            stats["octets"] += info.file_size

            # 1. Chemins interdits.
            for motif, raison in INTERDITS_COMPILES:
                if motif.search(nom):
                    problemes.append(("chemin", nom, raison))

            # 2. Contenu.
            if est_binaire(nom) or info.file_size > TAILLE_MAX_SCAN:
                continue
            try:
                with archive.open(info) as handle:
                    texte = io.TextIOWrapper(handle, encoding="utf-8", errors="strict").read()
            except (UnicodeDecodeError, KeyError):
                continue
            stats["scannes"] += 1

            for motif in MOTIFS:
                if any(re.search(ex, nom) for ex in motif["exclure"]):
                    continue
                trouve = motif["re"].search(texte)
                if not trouve:
                    continue
                if valeur_fictive(trouve.group(0)):
                    continue
                # L'aperçu est tronqué : on ne recopie pas un secret dans un
                # rapport qui pourrait être archivé à son tour.
                apercu = trouve.group(0)
                apercu = apercu[:12] + "…" if len(apercu) > 12 else apercu
                problemes.append(("contenu", f"{nom} → {apercu}", motif["nom"]))

    return problemes, stats


def rapport(chemin: str, problemes, stats, verbose: bool) -> int:
    print("")
    print(f"  Archive : {chemin}")
    print(
        f"  Entrées : {stats['entrees']} ({stats['fichiers']} fichiers, "
        f"{stats['dossiers']} dossiers) — {stats['octets']:,} octets décompressés"
    )
    print(f"  Fichiers texte analysés : {stats['scannes']}")
    print("")

    if not problemes:
        print("  ✓ Aucun .env, aucune clé, aucun node_modules, aucun storage/.")
        print("")
        return 0

    print(f"  ✗ {len(problemes)} problème(s) détecté(s) :")
    print("")
    par_categorie: dict[str, list] = {}
    for categorie, detail, raison in problemes:
        par_categorie.setdefault(categorie, []).append((detail, raison))
    for categorie, elements in par_categorie.items():
        print(f"    [{categorie}] {len(elements)}")
        for detail, raison in elements[:40]:
            print(f"      • {detail}")
            print(f"        → {raison}")
        if len(elements) > 40:
            print(f"      … et {len(elements) - 40} autre(s)")
        print("")

    print("  ⚠ Une clé réelle dans une archive est un incident de sécurité,")
    print("    pas un détail de livraison. Ne distribuez pas cette archive.")
    print("")
    return 1


# ─────────────────────────────── auto-test ───────────────────────────────


# Gabarits de l'auto-test, assemblés pour que le source de ce fichier ne
# contienne aucune chaîne ayant la forme d'un secret.
SID_TWILIO_GABARIT = "AC" + "0123456789abcdef" * 2
CLE_PRIVEE_GABARIT = (
    "-----BEGIN RSA " + "PRIVATE KEY-----\n"
    + "MIIE\n"
    + "-----END RSA " + "PRIVATE KEY-----\n"
)


def auto_test() -> int:
    """
    Construit une archive volontairement polluée et vérifie que **chaque**
    catégorie est détectée.

    Sans ce contrôle, un script de vérification dont le filtre est cassé
    (regex fautive, liste vide) affiche « tout va bien » indéfiniment — et
    laisse passer exactement ce qu'il était censé arrêter.
    """
    print("")
    print("  Auto-test : archive volontairement polluée")
    print("")

    pollue = {
        "backend/.env": "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9."
        + "eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuv\n",
        "backend/.env.local": "DATABASE_URL=postgres://x\n",
        "backend/.env.example": "SUPABASE_URL=\n",  # autorisé
        "backend/node_modules/lodash/index.js": "module.exports = 1;\n",
        "backend/storage/geospatial/fichier.tif": "RIFF....",
        "apps/web/dist/index.html": "<html></html>\n",
        "apps/Mobile/.expo/settings.json": "{}\n",
        # Les gabarits de fuite sont **construits à l'exécution**. Écrire les
        # littéraux en clair ferait de ce fichier une fausse positive de
        # lui-même — il se scanne — et la tentation serait alors de l'exclure
        # par son chemin, ce qui ouvrirait un vrai trou.
        "backend/cle.pem": CLE_PRIVEE_GABARIT,
        "backend/src/config/prod.js": f"const k = '{SID_TWILIO_GABARIT}';\n",
        "backend/docs/SMS-TWILIO.md": f"exemple {SID_TWILIO_GABARIT}\n",  # exclu (doc)
        "backend/src/app.js": "export const app = null;\n",  # sain
        # Le cas réel qui a déclenché l'affinage : une valeur de test dans un
        # fichier d'accompagnement (ni `.test.mjs`, ni `.md`). Elle doit être
        # ignorée **par sa valeur**, pas par son chemin — exclure le fichier
        # ouvrirait un trou si quelqu'un y collait une vraie clé.
        "backend/tests/e2e/support/harness.mjs": (
            "  SUPABASE_ANON_KEY: 'anon-key-e2e',\n"
            "  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-e2e',\n"
        ),
    }

    attendus = {
        "chemin:.env": "backend/.env",
        "chemin:.env.local": "backend/.env.local",
        "chemin:node_modules": "backend/node_modules/lodash/index.js",
        "chemin:storage": "backend/storage/geospatial/fichier.tif",
        "chemin:dist": "apps/web/dist/index.html",
        "chemin:.expo": "apps/Mobile/.expo/settings.json",
        "chemin:pem": "backend/cle.pem",
        "contenu:jwt": "backend/.env",
        "contenu:twilio": "backend/src/config/prod.js",
    }

    with tempfile.TemporaryDirectory() as dossier:
        chemin = os.path.join(dossier, "polluee.zip")
        with zipfile.ZipFile(chemin, "w", zipfile.ZIP_DEFLATED) as archive:
            for nom, contenu in pollue.items():
                archive.writestr(nom, contenu)

        problemes, _ = verifier_archive(chemin)

    chemins = {d for c, d, _ in problemes if c == "chemin"}
    contenus = {d for c, d, _ in problemes if c == "contenu"}

    echecs = []
    for etiquette, cible in attendus.items():
        categorie, quoi = etiquette.split(":", 1)
        if categorie == "chemin":
            if cible not in chemins:
                echecs.append(f"{etiquette} : « {cible} » non signalé")
        else:
            if not any(d.startswith(cible) for d in contenus):
                echecs.append(f"{etiquette} : « {cible} » non signalé")

    # Contre-épreuve inverse : ce qui est autorisé ne doit pas être signalé.
    permis = ["backend/.env.example", "backend/src/app.js"]
    for nom in permis:
        if nom in chemins:
            echecs.append(f"faux positif : « {nom} » signalé alors qu'il est autorisé")
    if any(d.startswith("backend/docs/SMS-TWILIO.md") for d in contenus):
        echecs.append("faux positif : clé Twilio citée dans la documentation signalée")
    # Valeurs de test : ignorées par leur contenu, pas par leur chemin.
    if any(d.startswith("backend/tests/e2e/support/harness.mjs") for d in contenus):
        echecs.append(
            "faux positif : la valeur de test du harnais est signalée — "
            "le filtre par valeur ne fonctionne pas"
        )

    if echecs:
        print(f"  ✗ {len(echecs)} échec(s) :")
        for e in echecs:
            print(f"      • {e}")
        print("")
        return 1

    print(
        f"  ✓ {len(attendus)} fuites détectées, {len(permis)} fichiers autorisés "
        f"et 1 valeur de test ignorés."
    )
    print("")
    return 0


def main(argv: list[str]) -> int:
    if "--selftest" in argv:
        return auto_test()

    cibles = [a for a in argv if not a.startswith("-")]
    if not cibles:
        print(__doc__)
        return 2

    verbose = "--verbose" in argv
    code = 0
    for cible in cibles:
        if not os.path.exists(cible):
            print(f"\n  ✗ Archive introuvable : {cible}\n")
            code = 1
            continue
        problemes, stats = verifier_archive(cible, verbose)
        code = max(code, rapport(cible, problemes, stats, verbose))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
