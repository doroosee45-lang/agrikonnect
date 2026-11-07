import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { COLORS, DARK, TINTS } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { RequestError, ERROR_KIND_I18N } from '@/services/api/types';
import type { TranslationKey } from '@/i18n';

import { Button } from './Button';
import { Card } from './Card';
import { SkeletonList } from './Skeleton';
import { Text } from './Text';
import { TERRE } from '../../theme/agrikonnect';

/** État de chargement par défaut : squelettes, jamais de spinner seul. */
export function LoadingState({ count = 3, height = 150 }: { count?: number; height?: number }) {
  return <SkeletonList count={count} height={height} />;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  icon = 'leaf-outline',
  action,
  light = false,
  style,
}: EmptyStateProps) {
  const color = light ? DARK.text : COLORS.textPrimary;
  const muted = light ? DARK.textMuted : COLORS.slateGray;

  return (
    <View style={[styles.state, style]}>
      <View style={[styles.iconRing, { borderColor: light ? DARK.border : COLORS.lightBorder }]}>
        <Ionicons name={icon} size={26} color={light ? COLORS.gold : COLORS.livingGreen} />
      </View>
      <Text preset="h3" color={color} style={styles.centered}>
        {title}
      </Text>
      {description ? (
        <Text preset="bodySm" color={muted} style={[styles.centered, styles.description]}>
          {description}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="outline" size="sm" /> : null}
    </View>
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Le détail technique (requestId) est affiché plié : utile au support. */
  showRequestId?: boolean;
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Erreur réseau ou métier.
 *
 * Le message serveur est affiché tel quel quand il existe (il est déjà rédigé
 * pour l'utilisateur) ; sinon on retombe sur le libellé i18n de la famille
 * d'erreur. Le `requestId` est conservé pour le support.
 */
export function ErrorState({ error, onRetry, showRequestId = true, light = false, style }: ErrorStateProps) {
  const { t } = useI18n();
  const requestError = error instanceof RequestError ? error : null;
  const kindKey = (requestError ? ERROR_KIND_I18N[requestError.kind] : 'errors.unknown') as TranslationKey;
  const message = requestError?.message && requestError.status !== 0 ? requestError.message : t(kindKey);

  return (
    <Card tone={light ? 'ink' : 'white'} style={[styles.errorCard, style]}>
      <View style={styles.errorRow}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
        </View>
        <View style={styles.errorBody}>
          <Text preset="bodyMedium" color={light ? DARK.text : COLORS.textPrimary}>
            {message}
          </Text>
          {showRequestId && requestError?.requestId ? (
            <Text preset="caption" color={light ? DARK.textFaint : COLORS.slateGray} style={styles.requestId}>
              réf. {requestError.requestId}
            </Text>
          ) : null}
        </View>
      </View>
      {onRetry ? (
        <Button label={t('common.retry')} onPress={onRetry} variant="outline" size="sm" icon="refresh" />
      ) : null}
    </Card>
  );
}

/** Bandeau hors ligne : les données affichées peuvent dater (NFR client). */
export function OfflineNotice() {
  const { t } = useI18n();
  return (
    <View style={styles.offline}>
      <Ionicons name="cloud-offline-outline" size={14} color={COLORS.warning} />
      <Text preset="caption" color={TERRE[700]}>
        {t('common.offline')}
      </Text>
    </View>
  );
}

/**
 * Porte d'entrée des données qui exigent une session.
 *
 * La majeure partie de l'API (prix, météo, appels d'offres, parcelles) est
 * derrière `authenticate` : plutôt qu'un écran vide ou une erreur 401 brute, on
 * affiche une invitation explicite à se connecter.
 */
export function AuthGate({
  children,
  title,
  description,
  isAuthenticated,
  icon = 'lock-closed-outline',
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  isAuthenticated: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { t } = useI18n();

  if (isAuthenticated) return <>{children}</>;

  return (
    <Card tone="pale" style={styles.gate}>
      <View style={styles.gateIcon}>
        <Ionicons name={icon} size={20} color={COLORS.forestGreen} />
      </View>
      <Text preset="h3" color={COLORS.textPrimary}>
        {title}
      </Text>
      {description ? (
        <Text preset="bodySm" color={COLORS.slateGray} style={styles.gateDescription}>
          {description}
        </Text>
      ) : null}
      <View style={styles.gateActions}>
        <Button label={t('nav.login')} onPress={() => router.push('/auth/login')} variant="primary" size="sm" />
        <Button label={t('nav.signup')} onPress={() => router.push('/auth/register')} variant="ghost" size="sm" />
      </View>
    </Card>
  );
}

/** Avertissement obligatoire sur les sorties d'aide à la décision (AI-10). */
export function AdvisoryNotice({ text, icon = 'information-circle-outline' }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.advisory}>
      <Ionicons name={icon} size={15} color={COLORS.info} />
      <Text preset="caption" color={COLORS.info} style={styles.advisoryText}>
        {text}
      </Text>
    </View>
  );
}

const styles = {
  state: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl } as ViewStyle,
  centered: { textAlign: 'center' } as ViewStyle,
  description: { maxWidth: 320, marginTop: SPACING.xs } as ViewStyle,
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TINTS.livingGreenBg,
    marginBottom: SPACING.xs,
  } as ViewStyle,
  errorCard: { gap: SPACING.md, borderColor: 'rgba(180, 68, 47, 0.25)' } as ViewStyle,
  errorRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' } as ViewStyle,
  errorIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: TINTS.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  errorBody: { flex: 1, gap: 2 } as ViewStyle,
  requestId: { marginTop: 2 } as ViewStyle,
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: TINTS.warningBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  } as ViewStyle,
  gate: { gap: SPACING.sm, alignItems: 'flex-start' } as ViewStyle,
  gateIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: TINTS.forestGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  gateDescription: { marginTop: 2 } as ViewStyle,
  gateActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm } as ViewStyle,
  advisory: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: TINTS.infoBg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'flex-start',
  } as ViewStyle,
  advisoryText: { flex: 1, lineHeight: 17 } as ViewStyle,
};
