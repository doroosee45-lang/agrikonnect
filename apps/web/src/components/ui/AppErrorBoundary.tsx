import { Component, type ErrorInfo, type ReactNode } from 'react';

import { COLORS, RADIUS, SPACING } from '@/theme';
import { tr } from '@/i18n';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

/** Catches render failures, including rejected lazy page imports. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('App render or lazy-load failure:', error, errorInfo);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main role="alert" aria-live="assertive" style={{
        minHeight: '40vh', display: 'grid', placeItems: 'center', padding: SPACING.xl,
        backgroundColor: COLORS.naturalWhite, color: COLORS.textPrimary,
      }}>
        <section aria-labelledby="app-error-title" style={{
          width: 'min(100%, 34rem)', boxSizing: 'border-box', padding: SPACING.xl,
          border: '1px solid', borderColor: COLORS.lightBorder, borderRadius: RADIUS.xl,
          backgroundColor: COLORS.surface, textAlign: 'center',
        }}>
          <h1 id="app-error-title" style={{ marginTop: 0 }}>{tr('ui.impossibleDAfficherCettePage')}</h1>
          <p style={{ color: COLORS.error }}>{tr('ui.uneErreurDeChargementOuD')}</p>
          <button type="button" onClick={this.reload} style={{
            minHeight: 44, padding: `0 ${SPACING.lg}px`, borderRadius: RADIUS.md, border: 0,
            backgroundColor: COLORS.forestGreen, color: COLORS.pureWhite, cursor: 'pointer',
            font: 'inherit', fontWeight: 600,
          }}>{tr('ui.rechargerLaPage')}</button>
        </section>
      </main>
    );
  }
}
