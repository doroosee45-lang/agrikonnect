import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import './theme/tokens.css';
import './design-system/index.css';
import { queryClient } from './services/query';
import { useI18nStore } from './i18n';

/*
 * I18N-02 — la langue choisie est relue AVANT le premier rendu : sans cela,
 * chaque rechargement repartait en français (et envoyait `Accept-Language: fr`).
 * À la première visite, la langue du navigateur est retenue.
 */
void useI18nStore
  .getState()
  .hydrate()
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );
  });

