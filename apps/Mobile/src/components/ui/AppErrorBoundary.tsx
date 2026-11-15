import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/theme/colors';
import { tr } from '@/i18n';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

/** Catches render failures and lets the user retry the affected tree. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Mobile app render failure:', error, errorInfo);
  }

  private retry = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.card}>
          <Text style={styles.title}>{tr('ui.impossibleDAfficherCetEcran')}</Text>
          <Text style={styles.message}>{tr('ui.uneErreurDAffichageOuDe')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.retry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{tr('common.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.naturalWhite,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  title: {
    marginBottom: 12,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    marginBottom: 20,
    color: COLORS.slateGray,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.forestGreen,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: COLORS.pureWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});
