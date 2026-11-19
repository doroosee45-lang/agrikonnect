import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeroCarousel } from '@/components/hero/HeroCarousel';

// Le carrousel contient des liens (<Link>) : un routeur est requis pour le rendu.
const afficher = () =>
  render(
    <MemoryRouter>
      <HeroCarousel slides={slides} height={300} intervalMs={0} />
    </MemoryRouter>,
  );

const slides = [
  {
    image: 'https://example.com/slide1.jpg',
    titre: 'Traçabilité agricole',
    sousTitre: 'Chaque lot porte son origine.',
    ctaHref: '/auth/register',
    ctaLabel: 'Créer un compte',
  },
  {
    image: 'https://example.com/slide2.jpg',
    titre: 'Coopératives',
    sousTitre: 'Réunissez vos productions.',
    ctaHref: '/public/cooperatives',
    ctaLabel: 'Voir les coopératives',
  },
];

describe('HeroCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * Comportement du composant (fondu enchaîné) : seul le texte de la
   * diapositive ACTIVE est rendu ; les indicateurs (un bouton par diapositive)
   * permettent d'en changer. Libellé des indicateurs selon la langue :
   * « Diapositive 1 sur 2 » / « Slide 1 of 2 ».
   */
  const indicateurs = () => screen.getAllByRole('button', { name: /^(Diapositive|Slide) \d+/ });

  it('affiche la diapositive active (titre, sous-titre), pas les autres', () => {
    afficher();

    expect(screen.getByText('Traçabilité agricole')).toBeInTheDocument();
    expect(screen.getByText('Chaque lot porte son origine.')).toBeInTheDocument();
    expect(screen.queryByText('Coopératives')).not.toBeInTheDocument();
    expect(screen.queryByText('Réunissez vos productions.')).not.toBeInTheDocument();
  });

  it('affiche le bouton d’action de la diapositive active, vers son lien', () => {
    afficher();

    expect(screen.getByText('Créer un compte')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/auth/register');
  });

  it('un indicateur par diapositive ; un clic affiche la diapositive choisie', () => {
    afficher();

    const points = indicateurs();
    expect(points).toHaveLength(2);
    expect(points[0]).toHaveAttribute('aria-current', 'true');

    fireEvent.click(points[1]);

    expect(screen.getByText('Coopératives')).toBeInTheDocument();
    expect(screen.getByText('Voir les coopératives')).toBeInTheDocument();
    expect(screen.queryByText('Traçabilité agricole')).not.toBeInTheDocument();
    expect(indicateurs()[1]).toHaveAttribute('aria-current', 'true');
  });
});
