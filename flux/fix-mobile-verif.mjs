#!/usr/bin/env node
/**
 * fix-mobile-verif — miroir mobile du correctif de vérification d'e-mail
 * (BLOC 67). Le renvoi du lien porte l'adresse cible ; l'écran accepte le
 * paramètre `token_hash` de Supabase ; l'inscription avec e-mail atterrit sur
 * l'écran de vérification (l'inscription téléphone seule garde /farmer).
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NL = String.fromCharCode(10);
const sha = (t) => createHash('md5').update(t, 'utf8').digest('hex');

const remplacer = (texte, ancre, remplacement, chemin) => {
  if (texte.split(ancre).length !== 2) {
    console.log('ARRET_ANCRE : ' + chemin + ' — motif introuvable ou double — STOP, aucune ecriture');
    process.exit(1);
  }
  return texte.split(ancre).join(remplacement);
};

const corriger = (chemin, attendu, operations) => {
  let texte = fs.readFileSync(chemin, 'utf8');
  if (sha(texte) !== attendu) {
    console.log('ARRET_MD5_FICHIER : ' + chemin + ' inattendu — STOP, aucune ecriture');
    process.exit(1);
  }
  for (const op of operations) texte = remplacer(texte, op[0], op[1], chemin);
  fs.writeFileSync(chemin, texte);
  console.log('fix-mobile-verif : ' + chemin + ' mis a jour');
};

// ── 1. endpoints.ts : resendVerification prend l'adresse ──
corriger('src/services/api/endpoints.ts', '5c3b838d6c43acdf3ddfa8074285949b', [
  [
    [
      '  resendVerification: () =>',
      "    api.post<{ sent: boolean }>('/auth/resend-verification', {}, { skipAuthRefresh: true }),",
    ].join(NL),
    [
      '  resendVerification: (email: string) =>',
      "    api.post<{ sent: boolean }>('/auth/resend-verification', { email }, { skipAuthRefresh: true }),",
    ].join(NL),
  ],
]);

// ── 2. verify-email.tsx : jeton token_hash, champ adresse, renvoi ciblé ──
corriger('src/app/auth/verify-email.tsx', '183f3e6c0ea022c6e8d2a7927c0ad76a', [
  [
    [
      '  const params = useLocalSearchParams<{ token?: string }>();',
      "  const jetonUrl = typeof params.token === 'string' ? params.token : '';",
      '',
      '  const [tokenHash, setTokenHash] = useState(jetonUrl);',
      '  const [renvoye, setRenvoye] = useState(false);',
    ].join(NL),
    [
      '  const params = useLocalSearchParams<{ token?: string; token_hash?: string; email?: string }>();',
      "  const jetonUrl = typeof params.token_hash === 'string' ? params.token_hash",
      "    : typeof params.token === 'string' ? params.token : '';",
      "  const emailUrl = typeof params.email === 'string' ? params.email : '';",
      '',
      '  const [email, setEmail] = useState(emailUrl);',
      '  const [tokenHash, setTokenHash] = useState(jetonUrl);',
      '  const [renvoye, setRenvoye] = useState(false);',
    ].join(NL),
  ],
  [
    '    mutationFn: () => authApi.resendVerification(),',
    '    mutationFn: () => authApi.resendVerification(email.trim()),',
  ],
  [
    '  const peutVerifier = tokenHash.trim().length > 0 && !verifier.isPending && !verifie;',
    [
      '  const peutVerifier = tokenHash.trim().length > 0 && !verifier.isPending && !verifie;',
      '  const peutRenvoyer = /.+@.+\\..+/.test(email.trim()) && !renvoyer.isPending;',
    ].join(NL),
  ],
  [
    [
      '              <Input',
      '                label="Jeton de vérification"',
    ].join(NL),
    [
      '              <Input',
      '                label="Adresse e-mail à vérifier"',
      '                value={email}',
      '                onChangeText={setEmail}',
      '                placeholder="vous@exemple.com"',
      '                icon="mail-outline"',
      '                keyboardType="email-address"',
      '                autoCapitalize="none"',
      '                autoCorrect={false}',
      '                autoComplete="email"',
      '              />',
      '',
      '              <Input',
      '                label="Jeton de vérification"',
    ].join(NL),
  ],
  [
    [
      '                loading={renvoyer.isPending}',
      '                onPress={() => renvoyer.mutate()}',
    ].join(NL),
    [
      '                loading={renvoyer.isPending}',
      '                disabled={!peutRenvoyer}',
      '                onPress={() => renvoyer.mutate()}',
    ].join(NL),
  ],
]);

// ── 3. register.tsx : vérification d'abord si e-mail fourni ──
corriger('src/app/auth/register.tsx', '65557715f73c3afffa6b2b2c7af0b0fe', [
  [
    "      router.replace('/farmer');",
    [
      "      // La vérification d'adresse (si e-mail fourni) est la prochaine étape :",
      "      // l'écran dédié se charge du renvoi du lien, l'adresse y est préremplie.",
      "      if (email.trim()) {",
      "        router.replace('/auth/verify-email?email=' + encodeURIComponent(email.trim()));",
      '      } else {',
      "        router.replace('/farmer');",
      '      }',
    ].join(NL),
  ],
]);

console.log('fix-mobile-verif : termine');
