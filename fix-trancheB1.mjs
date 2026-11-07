#!/usr/bin/env node
/**
 * fix-trancheB1 - Tranche B partie 1 (mobile, miroir du web) :
 *  1. login.tsx atterrit sur la destination centrale (getUserInitialRoute)
 *     au lieu de /farmer en dur (le parametre next explicite reste respecte) ;
 *  2. garde des pages d auth : une session deja ouverte repart vers son espace.
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

const chemin = 'src/app/auth/login.tsx';
let texte = fs.readFileSync(chemin, 'utf8');
if (sha(texte) !== '8aad2e35c46e37fd48089381408e53d4') {
  console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, aucune ecriture');
  process.exit(1);
}

texte = remplacer(
  texte,
  "import { useAuthStore } from '@/store/auth';",
  [
    "import { useAuthStore } from '@/store/auth';",
    "import { getUserInitialRoute } from '@/lib/redirects';",
  ].join(NL),
  chemin,
);

texte = remplacer(
  texte,
  "      router.replace((next as string) || '/farmer');",
  [
    "      const etat = useAuthStore.getState();",
    "      router.replace((next as string) || getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
  ].join(NL),
  chemin,
);

texte = remplacer(
  texte,
  "  }, [pendingMfa]);",
  [
    "  }, [pendingMfa]);",
    "",
    "  const status = useAuthStore((state) => state.status);",
    "",
    "  /*",
    "   * Garde des pages d auth (CAA) : une session deja ouverte repart vers son",
    "   * espace via la destination centrale - jamais le formulaire de connexion.",
    "   */",
    "  useEffect(() => {",
    "    if (status !== 'authenticated') return;",
    "    const courant = useAuthStore.getState();",
    "    if (courant.user) {",
    "      router.replace(getUserInitialRoute({ user: courant.user, permissions: courant.permissions }).route);",
    "    }",
    "  }, [status]);",
  ].join(NL),
  chemin,
);

for (const [motif, fois] of [['getUserInitialRoute', 3], ["'/farmer'", 0], ['useEffect(', 2]]) {
  const trouve = texte.split(motif).length - 1;
  if (trouve !== fois) {
    console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + trouve + ' (attendu x' + fois + ') - STOP');
    process.exit(1);
  }
}

fs.writeFileSync(chemin, texte);
console.log('fix-trancheB1 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
