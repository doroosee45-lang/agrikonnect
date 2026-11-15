#!/usr/bin/env node
/**
 * fix-trancheA3V2 - Tranche A partie 3 (web) : liens de navigation du cahier
 * des charges dans le Header partage (public + espaces) :
 *  - depuis l espace : "Visiter le site public" ;
 *  - depuis le site public : "Retour a mon espace" (destination centrale).
 * Session jamais perdue : simple navigation, aucun logout.
 *
 * Variante machine : le Header peut diverger du miroir (personnalisation).
 * Pas de porte md5 fichier ici - la protection = portes d ANCRES (ecriture
 * tout-ou-rien, chaque motif unique requis) + comptes semantiques finaux.
 * L empreinte avant/imprimee sert au dossier.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');

const remplacer = (texte, ancre, remplacement, chemin) => {
  if (texte.split(ancre).length !== 2) {
    console.log('ARRET_ANCRE : ' + chemin + ' - motif introuvable ou double - STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(ancre).join(remplacement);
};

const chemin = 'src/components/layout/Header.tsx';
let texte = fs.readFileSync(chemin, 'utf8');
console.log('fix-trancheA3V2 : ' + chemin + ' avant = ' + sha(texte));

// 1. Import de la destination centrale.
texte = remplacer(
  texte,
  "import { useAuthStore } from '@/store/auth';",
  [
    "import { useAuthStore } from '@/store/auth';",
    "import { getUserInitialRoute } from '@/lib/redirects';",
  ].join(NL),
  chemin,
);

// 2. Contexte de navigation : espace ou site public, destination calculee.
texte = remplacer(
  texte,
  "  const user = useAuthStore((state) => state.user);",
  [
    "  const user = useAuthStore((state) => state.user);",
    "  const permissions = useAuthStore((state) => state.permissions);",
    "",
    "  /*",
    "   * Navigation du cahier des charges : depuis l espace, \"Visiter le site",
    "   * public\" ; depuis le site public, \"Retour a mon espace\" (destination",
    "   * centrale calculee). La session n est jamais perdue : simple",
    "   * navigation, aucun logout.",
    "   */",
    "  const PREFIXES_ESPACE = ['/admin', '/farmer', '/organization', '/market', '/app', '/reviewer', '/investment', '/developers'];",
    "  const dansEspace = PREFIXES_ESPACE.some(",
    "    (prefixe) => location.pathname === prefixe || location.pathname.startsWith(prefixe + '/'),",
    "  );",
    "  const destinationEspace = user",
    "    ? getUserInitialRoute({ user, permissions }).route",
    "    : '/app/profile';",
  ].join(NL),
  chemin,
);

// 3. Lien contextuel dans le bloc authentifie.
texte = remplacer(
  texte,
  ["          {isAuthenticated ? (", "            <>"].join(NL),
  [
    "          {isAuthenticated ? (",
    "            <>",
    "              <Link",
    "                to={dansEspace ? '/' : destinationEspace}",
    "                style={{",
    "                  fontSize: 13,",
    "                  fontWeight: 600,",
    "                  color: COLORS.forestGreen,",
    "                  textDecoration: 'none',",
    "                }}",
    "              >",
    "                {dansEspace ? 'Visiter le site public' : 'Retour à mon espace'}",
    "              </Link>",
  ].join(NL),
  chemin,
);

for (const [motif, fois] of [['Visiter le site public', 1], ['Retour à mon espace', 1], ['getUserInitialRoute', 2]]) {
  const trouve = texte.split(motif).length - 1;
  if (trouve !== fois) {
    console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + trouve + ' (attendu x' + fois + ') - STOP');
    process.exit(1);
  }
}

fs.writeFileSync(chemin, texte);
console.log('fix-trancheA3V2 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
