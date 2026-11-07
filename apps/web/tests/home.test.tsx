import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '@/pages/public/Home';

vi.mock('@/services/endpoints', () => ({
  publicApi: {
    farms: vi.fn(() => Promise.resolve({ data: [], meta: { total: 0 } })),
    soilStats: vi.fn(() => Promise.resolve({ data: { rows: [] } })),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});

const renderHome = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </QueryClientProvider>,
  );

describe('Home (page d’accueil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rend le carrousel Hero avec plusieurs diapositives', () => {
    renderHome();
    expect(screen.getByText(/AGRIKONNECT AFRICA/)).toBeInTheDocument();
    expect(screen.getByText(/Traçabilité agricole/)).toBeInTheDocument();
  });

  it('rend au moins 15 sections de contenu', () => {
    const { container } = renderHome();
    const sections = container.querySelectorAll('section');
    // Hero (carousel) + 14 sections de contenu = 15 sections minimum
    expect(sections.length).toBeGreaterThanOrEqual(15);
  });

  it('rend les appels à l’action vers les pages publiques', () => {
    renderHome();
    expect(screen.getByText(/Créer un compte gratuit/)).toBeInTheDocument();
    expect(screen.getByText(/Créer mon compte producteur/)).toBeInTheDocument();
  });

  it('affiche un état vide propre quand aucune exploitation n’est publiée', () => {
    renderHome();
    expect(
      screen.getByText(/Aucune exploitation publiée/),
    ).toBeInTheDocument();
  });

  it('affiche un état vide propre pour les statistiques de sol', () => {
    renderHome();
    expect(
      screen.getByText(/Aucune statistique de sol disponible/),
    ).toBeInTheDocument();
  });
});
