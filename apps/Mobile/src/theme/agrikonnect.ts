/**
 * Jetons AGRIKONNECT AFRICA -- source de verite des valeurs.
 *
 * Source normative : UI KIT & DESIGN SYSTEM AGRIKONNECT AFRICA v1.0
 * (sections 2 a 5), valide le 2026-11-05. Il remplace la charte V1-V5
 * et les decisions D1/D2 : design-tokens.json se regenere desormais depuis
 * ce fichier, avec les valeurs du kit.
 *
 * ## Pourquoi ce fichier coexiste avec les alias
 *
 * L'application existante nomme ses couleurs autrement (forestGreen, gold,
 * naturalWhite...) et 157 pages web plus 206 ecrans mobile s y referencent.
 * Les renommer d un coup serait une regression silencieuse. index.ts (web) et
 * colors.ts (mobile) repointent donc leurs ancres vers les valeurs ci-dessous :
 * l'identite bascule partout en une fois, sans toucher aux ecrans. Les anciens
 * noms restent des alias.
 *
 * Ce fichier est IDENTIQUE sur les deux plateformes (apps/web et apps/Mobile).
 * Toute modification se fait dans les deux.
 *
 * ## Regles
 *
 * I3 -- ecrire un code hexadecimal dans un composant reste interdit : on
 * importe VERT[800], ou on utilise la variable CSS --vert-800.
 * AA -- quand une couleur du kit echoue au contraste texte (4,5:1), le ROLE
 * texte prend une valeur derivee plus foncee ; la couleur du kit reste
 * reservee aux remplissages, filets et icones avec libelle (kit 2.2).
 */

/* ====== Vert -- marque (kit primary) ====== */

export const VERT = {
  /** kit primary-50 -- surface legere. */
  50: '#f2f8f4',
  /** kit primary-100 -- fond vert leger. */
  100: '#e6f3ec',
  /** Derive (interpolation). */
  200: '#c6e0d2',
  /** Derive. */
  300: '#9bc7b0',
  /** Derive. */
  400: '#63ae8b',
  /** kit primary-500 -- vert secondaire. */
  500: '#239b68',
  /** Derive. */
  600: '#1b7f55',
  /** kit primary-700 -- vert principal. */
  700: '#176b45',
  /** kit primary-900 (vert fonce) -- la marque. C est cette valeur, pas une autre. */
  800: '#124c34',
  /** Texte titre (derive fonce). 11,85:1 sur le fond. */
  900: '#0e3a29',
  /** Derive. */
  950: '#08241a',
} as const;

/* ====== Terre -- accent (kit earth) ====== */

export const TERRE = {
  /** Derives de la teinte earth du kit. */
  50: '#f7efe5',
  100: '#f0e2cc',
  200: '#e2c79b',
  300: '#d6ac72',
  /** Traits, filets et l accent utilise en SURFACE. */
  400: '#d09a55',
  /** kit earth-500 -- agriculture et terre. Remplissages et filets. */
  500: '#c58b42',
  /** Derive. */
  600: '#a5722f',
  /** Derive AA -- l accent en TEXTE : 5,45:1 sur le fond, 5,83:1 sur blanc.
   *  kit earth-500 ne tient pas AA en texte (2,34:1) : voir regle AA. */
  700: '#8a5b22',
  /** Derive. */
  800: '#6e4c1d',
  900: '#523a17',
} as const;

/* ====== Creme -- fonds ====== */

export const CREME = {
  50: '#fafbfa',
  /** kit background -- le fond de page. */
  100: '#f5f8f5',
  200: '#e7ede8',
  300: '#d4dcd6',
} as const;

/* ====== Encre -- texte ====== */

export const ENCRE = {
  /** kit text-secondary. 4,67:1 sur le fond. */
  500: '#64736a',
  /** kit text-primary -- le texte courant. Jamais de noir pur. 15,16:1. */
  700: '#17231d',
  /** Titres sur surface claire (derive fonce). */
  900: '#0f1712',
} as const;

/* ====== Blanc -- surfaces, en opacite ====== */

export const BLANC = {
  40: 'rgba(255, 255, 255, 0.40)',
  55: 'rgba(255, 255, 255, 0.55)',
  70: 'rgba(255, 255, 255, 0.70)',
  85: 'rgba(255, 255, 255, 0.85)',
  95: 'rgba(255, 255, 255, 0.95)',
} as const;

/* ====== Rouge -- l erreur ====== */

export const ROUGE = {
  /** Fond d erreur. */
  50: '#fef2f2',
  100: '#fadedd',
  300: '#eea29e',
  400: '#e2716b',
  /** kit error -- remplissages, filets, icones avec libelle. */
  500: '#dc4545',
  /** Derive AA -- l erreur en TEXTE : 6,01:1 sur rouge-50. */
  700: '#b42318',
  800: '#8e1b12',
} as const;

/* ====== Scientifique -- information (kit scientific) ====== */

export const SCIENTIFIQUE = {
  50: '#f2f7fc',
  100: '#e4eef8',
  /** kit scientific-500 -- information. */
  500: '#2878c8',
  /** kit scientific-900 -- information en texte : 11,18:1 sur scientifique-100. */
  900: '#17324d',
} as const;

/* ====== Fonctionnelles du kit (2.2) ====== */
/**
 * Valeurs EXACTES du kit. Reservees aux remplissages, filets et icones ;
 * chaque usage porte un libelle (jamais la couleur seule). Les usages texte
 * prennent les etapes derivees AA (VERT[700], TERRE[700], ROUGE[700],
 * SCIENTIFIQUE[900]).
 */
export const FONCTION = {
  succes: '#16a34a',
  attention: '#e59a23',
  erreur: '#dc4545',
  info: '#2878c8',
  desactive: '#a3ada6',
} as const;

/**
 * Semantique metier imposee.
 *
 * Un badge porte UN etat. Jamais deux couleurs de sens oppose dans le meme
 * badge, et jamais une information portee par la couleur seule (A11) : le
 * libelle et l icone accompagnent toujours.
 */
export const SEMANTIQUE = {
  fiabiliteBasse: { fond: TERRE[100], texte: TERRE[800] },
  fiabiliteHaute: { fond: VERT[100], texte: VERT[800] },
  identiteVerifiee: VERT[600],
  /** Usage non textuel (filets, remplissages) : terre-500. */
  identiteEnAttente: TERRE[500],
  annonceActive: { fond: VERT[100], texte: VERT[800] },
  annonceExpiree: { fond: CREME[200], texte: ENCRE[500] },
  erreur: ROUGE[700],
} as const;

/**
 * Typographie.
 *
 * kit 3 : deux familles seulement. Inter pour tout le texte, titres compris ;
 * JetBrains Mono pour les coordonnees GPS, mesures scientifiques, identifiants
 * de parcelles et valeurs techniques. Aucune autre famille (l ancienne police
 * display est retiree). Les polices sont chargees via index.html (web) et
 * @expo-google-fonts (mobile).
 */
export const TEXTE = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  /** Alias historique (anciennement serif) : renvoie a Inter. Ne plus employer. */
  serif: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

/**
 * Echelle autorisee (kit 3), en pixels.
 *
 * Six tailles maximum par ecran. Toute valeur hors de cette liste doit etre
 * justifiee.
 */
export const TAILLES = {
  /** H1 kit (30-36) -- titre de page. */
  titrePage: 30,
  titrePageLarge: 36,
  /** H2 kit (24-28) -- titre de section. */
  titreSection: 24,
  /** H3 kit (18-22) -- sous-titre de carte. */
  sousTitre: 20,
  /** Corps de texte (kit 14-16). */
  corps: 15,
  corpsBase: 16,
  /** Corps dense : tableaux, listes (kit 12-13). */
  dense: 12.5,
  /** Aide sous un champ. */
  aide: 12,
  /** Sur-titre en majuscules (kit caption 11-12). */
  surtitre: 11,
  /** Mention legale. */
  mention: 11.5,
} as const;

/* ====== Geometrie ====== */

export const RAYON = {
  /** Cartes : 20 px (kit radius-2xl). */
  carte: 20,
  /** Champs : 12 px (kit radius-lg). */
  champ: 12,
  pilule: 999,
} as const;

export const ESPACEMENT = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Cibles tactiles minimales.
 *
 * 44 px sur le web, 48 pt sur mobile (I14). Ces valeurs ne se reduisent pas
 * pour faire tenir une mise en page : on agrandit la zone, pas seulement
 * l'icone.
 */
export const TACTILE = {
  web: 44,
  mobile: 48,
  ecart: 8,
} as const;

/**
 * Mouvement.
 *
 * Seuls opacity et transform s animent (I5). Animer height, width, top, left,
 * margin, box-shadow ou filter est interdit. La courbe est imposee, et tout
 * doit etre neutralise quand le systeme demande de reduire les animations.
 */
export const MOUVEMENT = {
  /** Courbe imposee -- ne pas en inventer d autre. */
  courbe: 'cubic-bezier(.22,.61,.36,1)',
  /** Apparition au defilement. */
  apparition: 700,
  /** Translation de l apparition. */
  decalage: 22,
  /** Transition d ecran. */
  ecran: 500,
  /** Survol de carte. */
  carte: 300,
  /** Echelonnement dans une grille : 40 a 90 ms, jamais plus de 140. */
  echelonnement: 70,
  echelonnementMax: 140,
  /** Zoom de photo. */
  zoomPhoto: 1200,
  /** Largeur du conteneur (unifiee avec LAYOUT.maxContentWidth). */
  conteneur: 1180,
} as const;
