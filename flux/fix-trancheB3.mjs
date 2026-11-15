#!/usr/bin/env node
/**
 * fix-trancheB3 - Tranche B partie 3 (mobile, miroir du web BLOC 71) :
 *  1. Navbar.tsx (site public) : "Retour a mon espace" -> destination
 *     centrale (getUserInitialRoute) au lieu de /farmer en dur ; le lien est
 *     pose dans la barre ET dans le menu compact ;
 *  2. AppHeader.tsx + FarmerHeader.tsx (espaces) : "Visiter le site public"
 *     (icone Ionicons globe-outline) vers /accueil, accueil public.
 * Session jamais perdue : simple navigation, aucun logout.
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
  console.log('fix-trancheB3 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
};

// ---- 1. Navbar.tsx : Retour a mon espace (barre + menu compact) ----------
corriger('src/components/public-site/Navbar.tsx', '2009c0f4c74721ca472b3b8be114c99f', [
  [
    "import { useAuthStore } from '@/store/auth';",
    [
      "import { useAuthStore } from '@/store/auth';",
      "import { getUserInitialRoute } from '@/lib/redirects';",
    ].join(NL),
  ],
  [
    [
      "                <Button",
      "                  label={t('farmer.title')}",
      "                  onPress={() => router.push('/farmer')}",
    ].join(NL),
    [
      "                <Button",
      "                  label=\"Retour à mon espace\"",
      "                  onPress={() => {",
      "                    const etat = useAuthStore.getState();",
      "                    router.push(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "                  }}",
    ].join(NL),
  ],
  [
    "            <Button label={t('farmer.title')} onPress={() => go('/farmer')} variant=\"primary\" fullWidth icon=\"leaf\" />",
    [
      "            <Button",
      "              label=\"Retour à mon espace\"",
      "              onPress={() => {",
      "                const etat = useAuthStore.getState();",
      "                go(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);",
      "              }}",
      "              variant=\"primary\"",
      "              fullWidth",
      "              icon=\"leaf\"",
      "            />",
    ].join(NL),
  ],
], {
  verifications: [["Retour à mon espace", 2], ["getUserInitialRoute", 3], ["'/farmer'", 0]],
});

// ---- 2. AppHeader.tsx : Visiter le site public --------------------------
corriger('src/components/app/AppHeader.tsx', 'e8353871f1e48378aa1d15a9b7beeafe', [
  [
    ["          <View style={styles.actions}>", "            {showNotifications ? ("].join(NL),
    [
      "          <View style={styles.actions}>",
      "            <IconButton icon=\"globe-outline\" onPress={() => router.push('/accueil')} accessibilityLabel=\"Visiter le site public\" />",
      "            {showNotifications ? (",
    ].join(NL),
  ],
], {
  verifications: [["Visiter le site public", 1], ["globe-outline", 1]],
});

// ---- 3. FarmerHeader.tsx : Visiter le site public -----------------------
corriger('src/components/farmer/FarmerHeader.tsx', 'a3c39f74bc1a87e843819176b2f5478c', [
  [
    ["          <View style={styles.actions}>", "            <IconButton icon=\"notifications-outline\""].join(NL),
    [
      "          <View style={styles.actions}>",
      "            <IconButton icon=\"globe-outline\" onPress={() => router.push('/accueil')} accessibilityLabel=\"Visiter le site public\" />",
      "            <IconButton icon=\"notifications-outline\"",
    ].join(NL),
  ],
], {
  verifications: [["Visiter le site public", 1], ["globe-outline", 1]],
});

console.log('fix-trancheB3 : termine');
