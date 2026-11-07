import { useEffect, useRef, useState, type ReactNode } from 'react';

import { IconeAttention, IconeCheck, IconeInfo } from './Icons';
import { CREME, ENCRE, ROUGE, SEMANTIQUE, TERRE, VERT } from '@/theme/agrikonnect';

/**
 * Kit de composants AGRIKONNET AFRICA.
 *
 * **À réutiliser avant de créer un nouveau composant.** Ces huit composants
 * couvrent les besoins courants : titre de page, encadré, étiquette, badge de
 * fiabilité, progression, carte, bouton, champ.
 *
 * Ils s'appuient sur les jetons de `@/theme/agrikonnect` et sur les classes de
 * `theme/tokens.css`. Aucune couleur en dur (I3), aucune dépendance ajoutée.
 */

/* ====== Titre de section ====== */

interface TitreSectionProps {
  /**
   * Niveau de titre. **Un seul `niveau={1}` par page** (A1, I6) : c'est lui qui
   * produit le `<h1>`.
   */
  niveau?: 1 | 2 | 3;
  surtitre?: string;
  titre: string;
  intro?: string;
  className?: string;
}

/**
 * Titre de page ou de section.
 *
 * Composant unique pour tous les titres : c'est ce qui garantit qu'il n'y a
 * qu'un `h1` par page et que la hiérarchie ne saute pas de niveau (A2).
 */
export function TitreSection({
  niveau = 2,
  surtitre,
  titre,
  intro,
  className = '',
}: TitreSectionProps) {
  const Balise = (`h${niveau}`) as 'h1' | 'h2' | 'h3';

  const tailles: Record<number, string> = {
    1: 'clamp(26px, 4vw, 32px)',
    2: '24px',
    3: '17px',
  };

  return (
    <div className={className}>
      {surtitre ? <span className="surtitre">{surtitre}</span> : null}
      <Balise
        style={{
          marginTop: surtitre ? 10 : 0,
          fontFamily: 'var(--font-display)',
          fontSize: tailles[niveau],
          fontWeight: 600,
          lineHeight: 1.2,
          color: VERT[900],
        }}
      >
        {titre}
      </Balise>
      {intro ? (
        <p
          style={{
            marginTop: 10,
            maxWidth: 640,
            fontSize: 'var(--texte-corps)',
            lineHeight: 1.6,
            color: ENCRE[500],
          }}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/* ====== Encadré ====== */

type Ton = 'info' | 'succes' | 'attention' | 'erreur';

const TONS: Record<Ton, { fond: string; bord: string; texte: string; icone: typeof IconeInfo }> = {
  info: { fond: VERT[50], bord: 'rgba(18,61,42,0.15)', texte: VERT[800], icone: IconeInfo },
  succes: { fond: VERT[100], bord: 'rgba(18,61,42,0.2)', texte: VERT[800], icone: IconeCheck },
  attention: { fond: TERRE[50], bord: 'rgba(156,68,35,0.25)', texte: TERRE[800], icone: IconeAttention },
  erreur: { fond: ROUGE[50], bord: 'rgba(160,46,38,0.25)', texte: ROUGE[700], icone: IconeAttention },
};

interface EncadreProps {
  ton?: Ton;
  titre?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Message encadré : information, succès, avertissement, erreur.
 *
 * L'information n'est **jamais portée par la couleur seule** (A11) : une icône
 * et le libellé accompagnent toujours le ton.
 */
export function Encadre({ ton = 'info', titre, children, className = '' }: EncadreProps) {
  const config = TONS[ton];
  const IconeTon = config.icone;

  return (
    <div
      className={className}
      /*
       * Une erreur est annoncée aux lecteurs d'écran sans attendre qu'ils
       * arrivent dessus (A7). Les autres tons ne le sont pas : un encadré
       * informatif n'est pas une alerte.
       */
      role={ton === 'erreur' ? 'alert' : undefined}
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 16px',
        background: config.fond,
        border: `1px solid ${config.bord}`,
        borderRadius: 14,
        color: config.texte,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 18, marginTop: 1 }}>
        <IconeTon />
      </span>
      <div style={{ minWidth: 0 }}>
        {titre ? (
          <p style={{ fontSize: 'var(--texte-corps)', fontWeight: 600, marginBottom: 4 }}>{titre}</p>
        ) : null}
        <div style={{ fontSize: 'var(--texte-dense)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

/* ====== Étiquette ====== */

type TonEtiquette = 'vert' | 'terre' | 'creme' | 'rouge';

const TONS_ETIQUETTE: Record<TonEtiquette, { fond: string; texte: string }> = {
  vert: { fond: VERT[100], texte: VERT[800] },
  terre: { fond: TERRE[100], texte: TERRE[800] },
  creme: { fond: CREME[200], texte: ENCRE[700] },
  rouge: { fond: ROUGE[100], texte: ROUGE[700] },
};

interface EtiquetteProps {
  ton?: TonEtiquette;
  children: ReactNode;
}

/** Étiquette courte : un état, une catégorie. Toujours un texte, jamais seule. */
export function Etiquette({ ton = 'creme', children }: EtiquetteProps) {
  const config = TONS_ETIQUETTE[ton];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: config.fond,
        color: config.texte,
        fontSize: 'var(--texte-surtitre)',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/* ====== Badge de fiabilité ====== */

interface BadgeFiabiliteProps {
  /** Niveau de 1 à 5. */
  niveau: number;
  /** Provenance affichée : « Sonde IoT », « Analyse laboratoire »… */
  source?: string;
}

/**
 * Badge de fiabilité N1–N5 (§3.4).
 *
 * N1–N3 en terre, N4–N5 en vert. Le niveau **et** la provenance sont écrits :
 * la couleur seule ne suffit pas (A11), et un lecteur d'écran reçoit un
 * `aria-label` complet.
 */
export function BadgeFiabilite({ niveau, source }: BadgeFiabiliteProps) {
  const borne = Math.min(5, Math.max(1, Math.round(niveau)));
  const haute = borne >= 4;
  const config = haute ? SEMANTIQUE.fiabiliteHaute : SEMANTIQUE.fiabiliteBasse;
  const libelle = source
    ? `Niveau de fiabilité ${borne} sur 5 — ${source}`
    : `Niveau de fiabilité ${borne} sur 5`;

  return (
    <span
      aria-label={libelle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 999,
        background: config.fond,
        color: config.texte,
        fontSize: 'var(--texte-surtitre)',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {/* Le point est décoratif : le niveau est écrit à côté. */}
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      N{borne}
      {source ? <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {source}</span> : null}
    </span>
  );
}

/* ====== Progression ====== */

interface ProgressionProps {
  /** De 0 à 1. */
  valeur: number;
  label: string;
  className?: string;
}

/**
 * Barre de progression.
 *
 * La largeur s'anime, ce que I5 interdit pour un mouvement décoratif — mais une
 * barre de progression **est** l'information : sa largeur est la donnée. Elle
 * reste donc animée, et la neutralisation `prefers-reduced-motion` la rend
 * instantanée sans la rendre fausse.
 */
export function Progression({ valeur, label, className = '' }: ProgressionProps) {
  const pourcent = Math.round(Math.min(1, Math.max(0, valeur)) * 100);

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={pourcent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        style={{
          height: 8,
          borderRadius: 999,
          background: 'rgba(18,61,42,0.10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pourcent}%`,
            height: '100%',
            borderRadius: 999,
            background: VERT[700],
            transition: 'width 700ms cubic-bezier(.22,.61,.36,1)',
          }}
        />
      </div>
      <p style={{ marginTop: 6, fontSize: 'var(--texte-aide)', color: ENCRE[500] }}>
        {label} — {pourcent} %
      </p>
    </div>
  );
}

/* ====== Carte ====== */

interface CarteProps {
  children: ReactNode;
  /** Une carte cliquable ou survolable gagne l'effet de survol. */
  survol?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Carte : surface surélevée, blanc à 85 %, rayon 20 px, bordure verte à 10 %. */
export function Carte({ children, survol = false, className = '', style }: CarteProps) {
  return (
    <div className={`${survol ? 'carte-survol' : 'carte'} ${className}`} style={{ padding: 20, ...style }}>
      {children}
    </div>
  );
}

/* ====== Bouton ====== */

type Variante = 'principale' | 'secondaire' | 'accent' | 'fantome';

const CLASSES_BOUTON: Record<Variante, string> = {
  principale: 'btn-primaire',
  secondaire: 'btn-secondaire',
  /* Réservé au parcours partenaire / investisseur. */
  accent: 'btn-terre',
  fantome: 'btn-fantome',
};

interface BoutonProps {
  variante?: Variante;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  charge?: boolean;
  /**
   * Libellé stable pendant le chargement.
   *
   * Un `ActivityIndicator` qui remplace le texte fait sauter la mise en page.
   * On garde le libellé et on change sa formulation.
   */
  labelleCharge?: string;
  className?: string;
  pleineLargeur?: boolean;
}

/**
 * Bouton. Cible tactile **44 px minimum**, garantie par `.btn`.
 *
 * **Un seul bouton principal par section** : si deux actions se disputent, l'une
 * des deux est secondaire.
 */
export function Bouton({
  variante = 'principale',
  children,
  onClick,
  type = 'button',
  disabled = false,
  charge = false,
  labelleCharge,
  className = '',
  pleineLargeur = false,
}: BoutonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || charge}
      aria-busy={charge || undefined}
      className={`btn ${CLASSES_BOUTON[variante]} ${className}`}
      style={pleineLargeur ? { width: '100%' } : undefined}
    >
      {charge && labelleCharge ? labelleCharge : children}
    </button>
  );
}

/* ====== Champ ====== */

interface ChampProps {
  id: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  type?: string;
  obligatoire?: boolean;
  erreur?: string | null;
  aide?: string;
  placeholder?: string;
  /** `decimal`, `numeric`, `tel`… évite le clavier alphabétique sur mobile. */
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email';
}

/**
 * Champ de formulaire.
 *
 * Le libellé est lié par `htmlFor` (A6), l'erreur est annoncée par `role="alert"`
 * et `aria-invalid` (A7), et l'aide reste associée par `aria-describedby`.
 */
export function Champ({
  id,
  label,
  valeur,
  onChange,
  type = 'text',
  obligatoire = false,
  erreur,
  aide,
  placeholder,
  inputMode,
}: ChampProps) {
  const idAide = `${id}-aide`;
  const idErreur = `${id}-err`;

  return (
    <div>
      <label htmlFor={id} className="etiquette-champ">
        {label}
        {obligatoire ? (
          <span aria-hidden="true" style={{ color: TERRE[600], marginLeft: 4 }}>
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        value={valeur}
        placeholder={placeholder}
        inputMode={inputMode}
        className="champ"
        required={obligatoire}
        aria-required={obligatoire || undefined}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? idErreur : aide ? idAide : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {!erreur && aide ? (
        <span id={idAide} className="aide-champ">
          {aide}
        </span>
      ) : null}
      {erreur ? (
        <p
          id={idErreur}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 6,
            fontSize: 'var(--texte-aide)',
            fontWeight: 500,
            color: ROUGE[700],
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>
            <IconeAttention />
          </span>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/* ====== Apparition au défilement ====== */

interface RevealProps {
  children: ReactNode;
  /** Délai en ms. Échelonnement conseillé : 40 à 90 ms, jamais plus de 140. */
  delai?: number;
  className?: string;
}

/**
 * Apparition au défilement, en IntersectionObserver.
 *
 * **Pas de framer-motion, pas de GSAP** (I2) : du CSS et l'API du navigateur
 * suffisent. L'animation ne joue qu'**une seule fois**, et la règle
 * `prefers-reduced-motion` de `tokens.css` garantit qu'un bloc ne reste jamais
 * invisible pour un utilisateur qui a demandé moins d'animation.
 */
export function Reveal({ children, delai = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    /*
     * Sans IntersectionObserver (très vieux navigateur), on affiche directement :
     * un contenu qui n'apparaît jamais est pire qu'un contenu sans animation.
     */
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (entree.isIntersecting) {
            setVisible(true);
            // Une seule fois : on cesse d'observer.
            observateur.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`}
      style={delai ? { transitionDelay: `${delai}ms` } : undefined}
    >
      {children}
    </div>
  );
}
