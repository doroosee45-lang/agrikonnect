#!/usr/bin/env node
/**
 * fix-trancheB3V2 - Tranche B partie 3 (mobile, miroir du web BLOC 71) :
 *  1. AppHeader.tsx + FarmerHeader.tsx (espaces) : "Visiter le site public"
 *     (icone Ionicons globe-outline) vers /accueil, accueil public ;
 *  2. Navbar.tsx (site public) : "Retour a mon espace" -> destination
 *     centrale (getUserInitialRoute) au lieu de /farmer en dur ; le lien est
 *     pose dans la barre ET dans le menu compact.
 * Session jamais perdue : simple navigation, aucun logout.
 *
 * Variante machine : ces composants peuvent diverger du miroir. Pas de porte
 * md5 fichier - la protection = portes d ANCRES (ecriture tout-ou-rien par
 * fichier, chaque motif unique requis) + comptes semantiques finaux. Les
 * empreintes avant/imprimees servent au dossier.
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

const corriger = (chemin, operations, options = {}) => {
  let texte = fs.readFileSync(chemin, 'utf8');
  console.log('fix-trancheB3V2 : ' + chemin + ' avant = ' + sha(texte));
  for (const op of operations) texte = remplacer(texte, op[0], op[1], chemin);
  for (const [motif, foisAttendues] of options.verifications ?? []) {
    const fois = texte.split(motif).length - 1;
    if (fois !== foisAttendues) {
      console.log('ARRET_SEMANTIQUE : ' + chemin + ' - "' + motif + '" x' + fois + ' (attendu x' + foisAttendues + ') - STOP');
      process.exit(1);
    }
  }
  fs.writeFileSync(chemin, texte);
  console.log('fix-trancheB3V2 : ' + chemin + ' mis a jour, apres = ' + sha(texte));
};

// ---- 1. AppHeader.tsx : Visiter le site public --------------------------
corriger('src/components/app/AppHeader.tsx', [
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

// ---- 2. FarmerHeader.tsx : Visiter le site public -----------------------
corriger('src/components/farmer/FarmerHeader.tsx', [
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

// ---- 3. Navbar.tsx : Retour a mon espace (barre + menu compact) ----------
corriger('src/components/public-site/Navbar.tsx', [
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
  verifications: [["Retour à mon espace", 2], ["getUserInitialRoute", 3]],
});

console.log('fix-trancheB3V2 : termine');
