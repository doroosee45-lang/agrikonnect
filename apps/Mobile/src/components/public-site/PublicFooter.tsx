import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useI18n } from '@/i18n';
import { APP } from '@/lib/config';
import { COLORS, DARK } from '@/theme/colors';
import { RADIUS, SPACING } from '@/theme/space';
import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';

import { Divider, Input, PressableScale, Reveal, Text } from '@/components/ui';

import { Logo } from './Logo';

interface FooterColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

/**
 * Pied de page du site public.
 *
 * Fond vert profond, filets dorés, et un indicateur d'état de l'API réellement
 * interrogé (`GET /health`) : le pied de page ne prétend rien, il montre ce que
 * la plateforme répond à l'instant.
 */
export function PublicFooter() {
  const { t, locale, setLocale } = useI18n();
  const { width } = useWindowDimensions();
  const columns = useColumns(t);
  const wide = width >= 820;

  return (
    <View style={styles.wrapper}>
      <View style={styles.goldTop} />

      <View style={styles.content}>
        <View style={[styles.top, wide ? styles.topWide : null]}>
          <Reveal variant="up" style={styles.brand}>
            <Logo light size={38} showTagline />
            <Text preset="bodySm" color={DARK.textMuted} style={styles.brandText}>
              {t('home.footerNote')}
            </Text>
            <PlatformStatus />
          </Reveal>

          <View style={[styles.columns, wide ? styles.columnsWide : null]}>
            {columns.map((column, columnIndex) => (
              <Reveal key={column.title} index={columnIndex} variant="up" style={styles.column}>
                <Text preset="overline" color={COLORS.gold}>
                  {column.title}
                </Text>
                {column.links.map((link) => (
                  <FooterLink key={link.href} label={link.label} onPress={() => router.push(link.href as never)} />
                ))}
              </Reveal>
            ))}
          </View>
        </View>

        <Divider light style={styles.divider} />

        <Reveal variant="up">
          <View style={[styles.newsletter, wide ? styles.newsletterWide : null]}>
            <View style={styles.newsletterText}>
              <Text preset="h3" color={DARK.text}>
                {t('home.newsletterTitle')}
              </Text>
              <Text preset="bodySm" color={DARK.textMuted}>
                Les relevés de prix sont réservés aux comptes vérifiés : chaque prix publié porte sa source et sa date.
              </Text>
            </View>
            <NewsletterForm />
          </View>
        </Reveal>

        <Divider light style={styles.divider} />

        <View style={[styles.bottom, wide ? styles.bottomWide : null]}>
          <Text preset="caption" color={DARK.textFaint}>
            © {new Date().getFullYear()} {APP.name} · {APP.version}
          </Text>

          <View style={styles.bottomLinks}>
            <FooterLink label={t('home.footerLegal')} onPress={() => router.push('/public-site/mentions')} small />
            <FooterLink label={t('home.footerPrivacy')} onPress={() => router.push('/public-site/confidentialite')} small />
            <FooterLink label={t('home.footerTerms')} onPress={() => router.push('/public-site/conditions')} small />
          </View>

          <View style={styles.langRow}>
            {(['fr', 'en'] as const).map((code) => (
              <PressableScale
                key={code}
                onPress={() => setLocale(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: locale === code }}
              >
                <Text
                  preset="overline"
                  color={locale === code ? COLORS.gold : DARK.textFaint}
                  style={{ fontSize: 10 }}
                >
                  {code.toUpperCase()}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function FooterLink({ label, onPress, small = false }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" style={styles.link}>
      <Text preset={small ? 'caption' : 'bodySm'} color={DARK.textMuted}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Pastille d'état branchée sur `GET /health` (aucun statut inventé). */
function PlatformStatus() {
  const { data, isError, isLoading } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => publicApi.health().then((result) => result.data),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const state = isLoading ? 'checking' : isError ? 'down' : data?.status === 'ok' ? 'up' : 'down';
  const color = state === 'up' ? COLORS.livingGreen : state === 'down' ? COLORS.error : COLORS.gold;
  const label =
    state === 'up'
      ? `API opérationnelle · v${data?.version ?? '?'}`
      : state === 'down'
        ? 'API injoignable'
        : 'Vérification…';

  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text preset="caption" color={DARK.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function NewsletterForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <View style={styles.form}>
      <Input
        label=""
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setTouched(false);
        }}
        onBlur={() => setTouched(true)}
        placeholder={t('home.newsletterPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        icon="mail-outline"
        error={touched && !valid ? t('home.newsletterError') : null}
      />
      <PressableScale
        onPress={() => {
          setTouched(true);
          if (!valid) return;
          router.push({ pathname: '/auth/register', params: { email: email.trim() } });
        }}
        accessibilityRole="button"
        style={styles.submit}
      >
        <Text preset="button" color={COLORS.textPrimary}>
          {t('home.newsletterCta')}
        </Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
      </PressableScale>
    </View>
  );
}

type Translator = (key: never) => string;

function useColumns(t: Translator): FooterColumn[] {
  return [
    {
      title: 'Plateforme',
      links: [
        { label: t('nav.services' as never), href: '/services' },
        { label: t('nav.markets' as never), href: '/marches' },
        { label: t('nav.tenders' as never), href: '/tenders' },
        { label: t('nav.projects' as never), href: '/projets' },
        { label: t('nav.explore' as never), href: '/explore' },
      ],
    },
    {
      title: 'Données',
      links: [
        { label: t('nav.prices' as never), href: '/prices' },
        { label: t('nav.weather' as never), href: '/weather' },
        { label: 'Statistiques de sol', href: '/public-site/sols' },
        { label: 'Traçabilité d’un lot', href: '/public-site/lot' },
        { label: 'Carte agricole', href: '/explore' },
      ],
    },
    {
      title: 'Réseau',
      links: [
        { label: t('nav.farmers' as never), href: '/farmers' },
        { label: t('nav.about' as never), href: '/a-propos' },
        { label: t('nav.news' as never), href: '/actualites' },
        { label: t('nav.faq' as never), href: '/faq' },
        { label: t('nav.contact' as never), href: '/contact' },
      ],
    },
    {
      title: 'Espaces',
      links: [
        { label: 'Espace producteur', href: '/farmer' },
        { label: 'Connexion', href: '/auth/login' },
        { label: 'Créer un compte', href: '/auth/register' },
        { label: 'API développeurs', href: '/developers' },
        { label: 'Mon profil', href: '/profil' },
      ],
    },
  ];
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: DARK.bg, width: '100%' },
  goldTop: {
    height: 2,
    backgroundColor: COLORS.goldSurface,
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 48,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: SPACING.xl,
  },
  top: { gap: SPACING.xl },
  topWide: { flexDirection: 'row', gap: SPACING.xxl, alignItems: 'flex-start' },
  brand: { gap: SPACING.md, maxWidth: 340, flex: 1 },
  brandText: { lineHeight: 21 },
  status: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  columns: { gap: SPACING.xl },
  columnsWide: { flexDirection: 'row', flex: 2, gap: SPACING.xl },
  column: { gap: SPACING.sm, flex: 1, minWidth: 150 },
  link: { paddingVertical: 2, alignSelf: 'flex-start' },
  divider: { marginVertical: SPACING.sm },
  newsletter: { gap: SPACING.md },
  newsletterWide: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxl },
  newsletterText: { gap: SPACING.xs, flex: 1 },
  form: { gap: SPACING.sm, width: '100%', maxWidth: 380 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    height: 50,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.goldSurface,
  },
  bottom: { gap: SPACING.md },
  bottomWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLinks: { flexDirection: 'row', gap: SPACING.lg, flexWrap: 'wrap' },
  langRow: { flexDirection: 'row', gap: SPACING.md },
});
