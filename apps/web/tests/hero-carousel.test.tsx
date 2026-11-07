import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroCarousel } from '@/components/hero/HeroCarousel';

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

  it('rend toutes les diapositives avec leurs titres', () => {
    render(<HeroCarousel slides={slides} height={300} intervalMs={0} />);

    expect(screen.getByText('Traçabilité agricole')).toBeInTheDocument();
    expect(screen.getByText('Coopératives')).toBeInTheDocument();
    expect(screen.getByText('Chaque lot porte son origine.')).toBeInTheDocument();
    expect(screen.getByText('Réunissez vos productions.')).toBeInTheDocument();
  });

  it('affiche les boutons CTA de chaque diapositive', () => {
    render(<HeroCarousel slides={slides} height={300} intervalMs={0} />);

    expect(screen.getByText('Créer un compte')).toBeInTheDocument();
    expect(screen.getByText('Voir les coopératives')).toBeInTheDocument();
  });

  it('affiche les indicateurs de navigation (dots)', () => {
    render(<HeroCarousel slides={slides} height={300} intervalMs={0} />);

    const dots = screen.getAllByRole('button', { name: /diapositive/ });
    expect(dots).toHaveLength(2);
  });
});
