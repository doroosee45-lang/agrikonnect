/**
 * Sonnerie générée (Web Audio) — aucun fichier son à charger. Deux bips
 * répétés ; s'arrête dès qu'on répond, refuse ou que l'appel se termine.
 * Les navigateurs peuvent bloquer le son tant que l'utilisateur n'a pas
 * interagi avec la page : la sonnerie est alors silencieuse, l'écran d'appel
 * reste visible.
 */
let contexte: AudioContext | null = null;
let minuteur: ReturnType<typeof setInterval> | null = null;

const bip = (ctx: AudioContext, debut: number) => {
  const oscillateur = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillateur.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, debut);
  gain.gain.exponentialRampToValueAtTime(0.15, debut + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.35);
  oscillateur.connect(gain).connect(ctx.destination);
  oscillateur.start(debut);
  oscillateur.stop(debut + 0.4);
};

export function demarrerSonnerie(): void {
  if (minuteur || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexte = contexte ?? new Ctx();
    void contexte.resume().catch(() => undefined);
    const jouer = () => {
      if (!contexte) return;
      bip(contexte, contexte.currentTime);
      bip(contexte, contexte.currentTime + 0.5);
    };
    jouer();
    minuteur = setInterval(jouer, 2500);
  } catch {
    // Pas de son disponible : l'écran d'appel suffit.
  }
}

export function arreterSonnerie(): void {
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
}
