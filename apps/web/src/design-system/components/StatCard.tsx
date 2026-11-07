import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

/**
 * StatCard (kit 8) : valeur principale, libelle, evolution, periode, icone,
 * source, pied (contenu additionnel : ex. provenance des donnees).
 *
 * Aucune valeur par defaut pour l evolution : un indicateur n affiche jamais
 * un pourcentage ou une evolution fictifs dans l environnement reel. La
 * tendance n apparaît que si elle est fournie.
 */
export interface StatTendance {
  valeur: string;
  sens: 'up' | 'down' | 'flat';
  libelle?: string;
}

export interface StatCardProps {
  label: string;
  valeur: string;
  unite?: string;
  periode?: string;
  icone?: ReactNode;
  source?: string;
  tendance?: StatTendance;
  pied?: ReactNode;
  className?: string;
}

const SENS_STYLE: Record<StatTendance['sens'], string> = {
  up: 'bg-marque-clair text-marque',
  down: 'bg-erreur-clair text-erreur',
  flat: 'bg-fond text-texte-doux',
};

const SENS_ICONE: Record<StatTendance['sens'], ReactNode> = {
  up: <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M5 1 L9 7 L1 7 Z" fill="currentColor" /></svg>,
  down: <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M5 9 L1 3 L9 3 Z" fill="currentColor" /></svg>,
  flat: <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><rect x="1" y="4" width="8" height="2" fill="currentColor" /></svg>,
};

export function StatCard({ label, valeur, unite, periode, icone, source, tendance, pied, className }: StatCardProps) {
  return (
    <section className={cn('flex flex-col gap-2 rounded-carte border border-bordure bg-surface p-5', className)}>
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-texte-doux">{label}</h3>
        {icone ? <span className="text-marque" aria-hidden>{icone}</span> : null}
      </header>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-texte">{valeur}</span>
        {unite ? <span className="text-sm text-texte-doux">{unite}</span> : null}
      </p>
      {tendance || periode || source || pied ? (
        <footer className="flex flex-wrap items-center gap-2 text-xs text-texte-doux">
          {tendance ? (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold', SENS_STYLE[tendance.sens])}>
              {SENS_ICONE[tendance.sens]}
              {tendance.valeur}
              {tendance.libelle ? <span className="font-normal">-- {tendance.libelle}</span> : null}
            </span>
          ) : null}
          {periode ? <span>{periode}</span> : null}
          {source ? <span>Source : {source}</span> : null}
          {pied ? <div className="w-full">{pied}</div> : null}
        </footer>
      ) : null}
    </section>
  );
}
