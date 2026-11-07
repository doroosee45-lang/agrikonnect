#!/usr/bin/env node
/**
 * fix-trancheB2 - Tranche B partie 2 (mobile, miroir du web BLOC 70) :
 *  1. verify-email.tsx : parcours post-verification -> espace du role si
 *     session existante (destination centrale), sinon bouton de connexion
 *     qui enchaîne vers la meme destination ;
 *  2. register.tsx : le repli sans e-mail part vers la destination centrale
 *     (plus de /farmer en dur) + garde des pages d auth (session deja
 *     ouverte -> espace, jamais le formulaire d inscription).
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

const corriger = (chemin, attendu, operations, options = {}) => {
  let texte = fs.readFileSync(chemin, 'utf8');
  if (sha(texte) !== attendu) {
    console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu - STOP, aucune ecriture');
    process.exit(1);
  }
  for (const op of operations) texte = remplacer(texte, op[0], op[1], chemin);
  for (const [motif, foisAttendues] of options.verifications ?? []) {
    const fois = texte.split(motif).length - 1;
    if (fois !== foisAttendues) {
      console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + fois + ' (attendu x' + foisAttendues + ') - STOP');
      process.exit(1);
    }
  }
  fs.writeFileSync(chemin, texte);
  console.log('fix-trancheB2 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
};

// ---- 1. verify-email.tsx : parcours post-verification --------------------
corriger('src/app/auth/verify-email.tsx', '6ac0f47e9cfd04776c50d26f4dfa4feb', [
  [
    "import { useState } from 'react';",
    "import { useEffect, useState } from 'react';",
  ],
  [
    "import { authApi } from '@/services/api/endpoints';",
    [
      "import { authApi } from '@/services/api/endpoints';",
      "import { useAuthStore } from '@/store/auth';",
      "import { getUserInitialRoute } from '@/lib/redirects';",
    ].join(NL),
  ],
  [
    "  const verifie = verifier.isSuccess;",
    [
      "  const verifie = verifier.isSuccess;",
      "  const status = useAuthStore((state) => state.status);",
      "",
      "  /*",
      "   * Parcours post-verification (CAA) : si une session existe deja, partir",
      "   * tout de suite vers l espace du role (Situation A = configuration",
      "   * initiale si identite manquante, Situation B = espace direct). Sans",
      "   * session, le bouton de connexion enchaîne vers la destination centrale.",
      "   */",
      "  useEffect(() => {",
      "    if (!verifie || status !== 'authenticated') return;",
      "    const etat = useAuthStore.getState();",
      "    if (etat.user) {",
      "      router.replace(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "    }",
      "  }, [verifie, status]);",
    ].join(NL),
  ],
  [
    "Vous pouvez maintenant vous connecter.",
    "Connectez-vous pour accéder à votre espace.",
  ],
], {
  verifications: [["getUserInitialRoute", 2], ["useEffect(", 1]],
});

// ---- 2. register.tsx : repli destination centrale + garde ----------------
corriger('src/app/auth/register.tsx', '6b9da05d3272c8c0333de0030941ef58', [
  [
    "import { useState } from 'react';",
    "import { useEffect, useState } from 'react';",
  ],
  [
    "import { useAuthStore } from '@/store/auth';",
    [
      "import { useAuthStore } from '@/store/auth';",
      "import { getUserInitialRoute } from '@/lib/redirects';",
    ].join(NL),
  ],
  [
    "        router.replace('/farmer');",
    [
      "        const etat = useAuthStore.getState();",
      "        router.replace(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
    ].join(NL),
  ],
  [
    "  const busy = useAuthStore((state) => state.busy);",
    [
      "  const busy = useAuthStore((state) => state.busy);",
      "  const status = useAuthStore((state) => state.status);",
      "",
      "  /*",
      "   * Garde des pages d auth (CAA) : une session deja ouverte repart vers son",
      "   * espace via la destination centrale - jamais le formulaire d inscription.",
      "   */",
      "  useEffect(() => {",
      "    if (status !== 'authenticated') return;",
      "    const courant = useAuthStore.getState();",
      "    if (courant.user) {",
      "      router.replace(getUserInitialRoute({ user: courant.user, permissions: courant.permissions }).route);",
      "    }",
      "  }, [status]);",
    ].join(NL),
  ],
], {
  verifications: [["getUserInitialRoute", 3], ["'/farmer'", 0], ["useEffect(", 1]],
});

console.log('fix-trancheB2 : termine');
