import type { SVGProps } from 'react';

/**
 * Jeu d'icônes AGRIKONNET AFRICA.
 *
 * ## Règles (I1, I8, A4)
 *
 * - **Aucune bibliothèque d'icônes.** Pas de `lucide-react`, `react-icons`,
 *   `heroicons` ni `@fortawesome/*`. Ce fichier est le seul jeu autorisé.
 * - **Style « line », trait 1.7, `currentColor`.** L'icône hérite de la couleur
 *   du texte qui l'entoure : on ne lui donne jamais de couleur en dur.
 * - **Taille pilotée par la police.** On passe `fontSize` sur le parent, pas une
 *   largeur fixe : l'icône suit le texte.
 * - **Toute icône est décorative par défaut** (`aria-hidden`). Une icône ne porte
 *   jamais seule une information (I8) : le libellé visible ou `sr-only`
 *   accompagne toujours.
 *
 * ## Pourquoi ce fichier existe
 *
 * L'application utilisait **243 emojis** comme icônes. Un emoji n'a ni trait
 * constant, ni couleur contrôlée, ni rendu identique d'une plateforme à l'autre,
 * et il est annoncé tel quel par les lecteurs d'écran (« visage souriant »). Ces
 * composants remplacent cet usage, sans imposer de dépendance.
 *
 * Chaque icône est dessinée dans une grille 24 × 24.
 */

type IconeProps = SVGProps<SVGSVGElement> & {
  /** Libellé pour les lecteurs d'écran. Omis = icône décorative. */
  titre?: string;
};

/** Socle commun : viewBox 24, trait 1.7, bouts arrondis, currentColor. */
function Icone({ titre, children, ...props }: IconeProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      /*
       * Décorative par défaut : sans `titre`, l'icône est masquée aux lecteurs
       * d'écran. Avec un `titre`, elle devient informative et porte un `role`.
       */
      aria-hidden={titre ? undefined : true}
      role={titre ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {titre ? <title>{titre}</title> : null}
      {children}
    </svg>
  );
}

/* ====== Agriculture ====== */

export const IconeFeuille = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </Icone>
);

export const IconePlant = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 22V10" />
    <path d="M12 10C12 6.5 9.5 4 6 4c0 3.5 2.5 6 6 6Z" />
    <path d="M12 13c0-3 2-5.5 5.5-5.5 0 3-2 5.5-5.5 5.5Z" />
  </Icone>
);

export const IconeGoutte = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 2.7 6.9 8.4a7.2 7.2 0 1 0 10.2 0Z" />
  </Icone>
);

export const IconeSonde = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 3v10" />
    <path d="M9 6h6" />
    <circle cx="12" cy="17" r="4" />
  </Icone>
);

/* ====== Parcelle et carte ====== */

export const IconeCarte = (props: IconeProps) => (
  <Icone {...props}>
    <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
  </Icone>
);

export const IconeRepere = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Icone>
);

/* ====== État et validation ====== */

export const IconeCheck = (props: IconeProps) => (
  <Icone {...props}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Icone>
);

export const IconeAttention = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 3.5 2.8 19.5h18.4Z" />
    <path d="M12 9.5v4.5" />
    <path d="M12 17.2h.01" />
  </Icone>
);

export const IconeInfo = (props: IconeProps) => (
  <Icone {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </Icone>
);

export const IconeCroix = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M6 6 18 18" />
    <path d="M18 6 6 18" />
  </Icone>
);

export const IconeHorloge = (props: IconeProps) => (
  <Icone {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 1.9" />
  </Icone>
);

/* ====== Navigation et action ====== */

export const IconeFleche = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Icone>
);

export const IconePlus = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icone>
);

export const IconeFiltre = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  </Icone>
);

export const IconeRecherche = (props: IconeProps) => (
  <Icone {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Icone>
);

export const IconeTelechargement = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 20h16" />
  </Icone>
);

/* ====== Données ====== */

export const IconeGraphique = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="m7 15 3.5-4 3 2.5L20 7" />
  </Icone>
);

export const IconeDocument = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </Icone>
);

export const IconeCloche = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </Icone>
);

export const IconeUtilisateur = (props: IconeProps) => (
  <Icone {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icone>
);

export const IconeBalance = (props: IconeProps) => (
  <Icone {...props}>
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M5 7 2.5 13a3 3 0 0 0 5 0Z" />
    <path d="M19 7l-2.5 6a3 3 0 0 0 5 0Z" />
  </Icone>
);
