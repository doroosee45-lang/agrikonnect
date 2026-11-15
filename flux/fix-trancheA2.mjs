#!/usr/bin/env node
/**
 * fix-trancheA2 - Tranche A partie 2 (web) :
 *  1. VerifyEmail.tsx : parcours post-verification -> espace du role si
 *     session existante (destination centrale), sinon bouton de connexion
 *     qui enchaîne vers la meme destination ;
 *  2. Login.tsx : garde des pages d auth - une session deja ouverte repart
 *     vers son espace, jamais le site public, jamais un formulaire en double ;
 *  3. Register.tsx (variante machine 9 types de compte) : meme garde.
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
  console.log('fix-trancheA2 : ' + chemin + ' mis a jour');
};

// ---- 1. VerifyEmail.tsx : parcours post-verification ---------------------
corriger('src/pages/auth/VerifyEmail.tsx', '9ddfb8b502071b1b25b982d71cc5f4a9', [
  [
    "import { useState } from 'react';",
    "import { useEffect, useState } from 'react';",
  ],
  [
    "import { Link, useSearchParams } from 'react-router-dom';",
    "import { Link, useNavigate, useSearchParams } from 'react-router-dom';",
  ],
  [
    "import { authApi } from '@/services/endpoints';",
    ["import { authApi } from '@/services/endpoints';", "import { useAuthStore } from '@/store/auth';"].join(NL),
  ],
  [
    "import { COLORS, DURATION, EASE } from '@/theme';",
    ["import { COLORS, DURATION, EASE } from '@/theme';", "import { getUserInitialRoute } from '@/lib/redirects';"].join(NL),
  ],
  [
    "  const verifie = verifier.isSuccess;",
    [
      "  const verifie = verifier.isSuccess;",
      "  const navigate = useNavigate();",
      "",
      "  /*",
      "   * Parcours post-verification (CAA) : si une session existe deja, partir",
      "   * tout de suite vers l espace du role (Situation A = configuration",
      "   * initiale si identite manquante, Situation B = espace direct). Sans",
      "   * session, le bouton de connexion enchaîne vers la destination centrale.",
      "   */",
      "  useEffect(() => {",
      "    if (!verifie) return;",
      "    const etat = useAuthStore.getState();",
      "    if (etat.status === 'authenticated' && etat.user) {",
      "      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "    }",
      "  }, [verifie, navigate]);",
    ].join(NL),
  ],
  [
    "Vous pouvez maintenant vous connecter.",
    "Connectez-vous pour accéder à votre espace.",
  ],
], {
  verifications: [["getUserInitialRoute", 2], ["useEffect(", 1]],
});

// ---- 2. Login.tsx : garde session deja ouverte ---------------------------
corriger('src/pages/auth/Login.tsx', '81695790d724981855f8e8bf91e3bb38', [
  [
    "import { useState } from 'react';",
    "import { useEffect, useState } from 'react';",
  ],
  [
    "  const showMfa = pendingMfa !== null;",
    [
      "  const showMfa = pendingMfa !== null;",
      "  const status = useAuthStore((state) => state.status);",
      "",
      "  /*",
      "   * Garde des pages d auth (CAA) : une session deja ouverte repart vers",
      "   * son espace via la destination centrale - jamais le site public,",
      "   * jamais un formulaire en double.",
      "   */",
      "  useEffect(() => {",
      "    if (status !== 'authenticated') return;",
      "    const etat = useAuthStore.getState();",
      "    if (etat.user) {",
      "      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "    }",
      "  }, [status, navigate]);",
    ].join(NL),
  ],
]);

// ---- 3. Register.tsx (variante machine) : meme garde ---------------------
corriger('src/pages/auth/Register.tsx', 'a843229ea09ce5c70c5ab50a0fd451ea', [
  [
    "import { useState } from 'react';",
    "import { useEffect, useState } from 'react';",
  ],
  [
    "import { COLORS, DURATION, EASE } from '@/theme';",
    ["import { COLORS, DURATION, EASE } from '@/theme';", "import { getUserInitialRoute } from '@/lib/redirects';"].join(NL),
  ],
  [
    "  const register = useAuthStore((state) => state.register);",
    [
      "  const register = useAuthStore((state) => state.register);",
      "  const status = useAuthStore((state) => state.status);",
      "",
      "  /*",
      "   * Garde des pages d auth (CAA) : une session deja ouverte repart vers",
      "   * son espace via la destination centrale - jamais le formulaire",
      "   * d inscription en double.",
      "   */",
      "  useEffect(() => {",
      "    if (status !== 'authenticated') return;",
      "    const etat = useAuthStore.getState();",
      "    if (etat.user) {",
      "      navigate(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "    }",
      "  }, [status, navigate]);",
    ].join(NL),
  ],
], {
  verifications: [["getUserInitialRoute", 2], ["useEffect(", 1]],
});

console.log('fix-trancheA2 : termine');
