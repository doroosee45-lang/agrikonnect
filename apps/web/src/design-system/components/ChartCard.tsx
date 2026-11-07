import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

/**
 * ChartCard (kit 8) : carte enveloppe des graphiques et repartitions. Titre,
 * periode, source ; le contenu (barres, tableau, liste) reste fourni par
 * l ecran : aucune librairie de rendu n est ajoutee (harmonisation de
 * l existant). La source suit la formulation du kit : Source : X.
 *
 * Aucune mention par defaut : periode et source n apparaissent que si elles
 * sont fournies (jamais d information fictive).
 */
export interface ChartCardProps {
  titre: string;
  periode?: string;
  source?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ titre, periode, source, children, className }: ChartCardProps) {
  return (
    <section className={cn('rounded-carte border border-bordure bg-surface p-5', className)}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-2xl font-semibold text-texte">{titre}</h3>
        {periode || source ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-texte-doux">
            {periode ? <span>{periode}</span> : null}
            {source ? <span>Source : {source}</span> : null}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
