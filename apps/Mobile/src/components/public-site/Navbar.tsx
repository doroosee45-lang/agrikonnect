import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SUPPORTED_LOCALES, useI18n } from '@/i18n';
import { COLORS, DARK } from '@/theme/colors';
import { DURATION, EASE } from '@/theme/motion';
import { LAYOUT, RADIUS, SPACING } from '@/theme/space';
import { useAuthStore } from '@/store/auth';
import { getUserInitialRoute } from '@/lib/redirects';

import { Button, IconButton, PressableScale, Text } from '@/components/ui';

import { Logo } from './Logo';

export interface NavItem {
  key: string;
  href: string;
  labelKey: 'nav.home' | 'nav.services' | 'nav.markets' | 'nav.projects' | 'nav.farmers' | 'nav.about' | 'nav.tenders' | 'nav.news';
}

export const PUBLIC_NAV: NavItem[] = [
  { key: 'accueil', href: '/accueil', labelKey: 'nav.home' },
  { key: 'services', href: '/services', labelKey: 'nav.services' },
  { key: 'marches', href: '/marches', labelKey: 'nav.markets' },
  { key: 'projets', href: '/projets', labelKey: 'nav.projects' },
  { key: 'farmers', href: '/farmers', labelKey: 'nav.farmers' },
  { key: 'tenders', href: '/tenders', labelKey: 'nav.tenders' },
  { key: 'a-propos', href: '/a-propos', labelKey: 'nav.about' },
];

const SCROLL_THRESHOLD = 90;
const TOPBAR_HEIGHT = 48;
const NAVBAR_GAP = 8;

/**
 * Barre de navigation du site public.
 *
 * Transparente au-dessus du héros, elle se densifie (fond, filet, ombre) dès
 * que la page défile — l'opacité est interpolée depuis la position de
 * défilement, sur le thread UI. Sur mobile, le menu s'ouvre en plein écran avec
 * ses liens en cascade.
 */
export function Navbar({
  scrollY,
  transparentOnTop = true,
  items = PUBLIC_NAV,
}: {
  scrollY: SharedValue<number>;
  transparentOnTop?: boolean;
  items?: NavItem[];
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCompact = width < 1080;
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const bar = useAnimatedStyle(() => {
    const progress = transparentOnTop
      ? interpolate(scrollY.value, [0, SCROLL_THRESHOLD], [0, 1], 'clamp')
      : 1;
    return {
      top: insets.top + Math.max(TOPBAR_HEIGHT + NAVBAR_GAP - scrollY.value, NAVBAR_GAP),
      backgroundColor: COLORS.naturalWhite,
      borderBottomColor: COLORS.lightBorder,
      shadowOpacity: 0.08,
    };
  });

  return (
    <>
      <Animated.View style={[styles.bar, bar]}>
        <View style={styles.inner}>
          <View>
            <PressableScale onPress={() => router.push('/accueil')} accessibilityRole="link">
                  <Logo size={40} showTagline />
            </PressableScale>
          </View>

          {!isCompact ? (
            <View style={styles.links}>
              {items.map((item) => (
                <NavLink
                  key={item.key}
                  label={t(item.labelKey)}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  onPress={() => router.push(item.href as never)}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            {!isCompact ? <LanguageToggle locale={locale} onChange={setLocale} /> : null}

            {!isCompact ? (
              isAuthenticated ? (
                <Button
                  label="Retour à mon espace"
                  onPress={() => {
                    const etat = useAuthStore.getState();
                    router.push(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
                  }}
                  variant="primary"
                  size="sm"
                  icon="leaf"
                />
              ) : (
                <>
                  <Button label={t('nav.login')} onPress={() => router.push('/auth/login')} variant="ghost" size="sm" />
                  <Button label={t('nav.signup')} onPress={() => router.push('/auth/register')} variant="primary" size="sm" />
                </>
              )
            ) : (
              <IconButton
                icon={menuOpen ? 'close' : 'menu'}
                onPress={() => setMenuOpen((open) => !open)}
                size={24}
                diameter={44}
                color={COLORS.pureWhite}
                background={COLORS.forestGreen}
                bordered={false}
                accessibilityLabel={t('nav.menu')}
              />
            )}
          </View>
        </View>
      </Animated.View>

      {menuOpen && isCompact ? (
        <MobileMenu
          items={items}
          onClose={() => setMenuOpen(false)}
          isAuthenticated={isAuthenticated}
          locale={locale}
          onLocaleChange={setLocale}
        />
      ) : null}
    </>
  );
}

function NavLink({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const hover = useSharedValue(0);

  const underline = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(active ? 1 : 0, hover.value) }],
    opacity: active ? 1 : hover.value,
  }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="link"
      style={styles.link}
      onHoverIn={() => {
        hover.value = withTiming(1, { duration: DURATION.instant, easing: EASE.out });
      }}
      onHoverOut={() => {
        hover.value = withTiming(0, { duration: DURATION.instant, easing: EASE.out });
      }}
    >
      <Text preset="caption" color={active ? COLORS.forestGreen : COLORS.slateGray}>
        {label}
      </Text>
      <Animated.View style={[styles.underline, underline]} />
    </PressableScale>
  );
}

function LanguageToggle({
  locale,
  onChange,
}: {
  locale: 'fr' | 'en';
  onChange: (next: 'fr' | 'en') => void;
}) {
  return (
    <View style={styles.lang}>
      {SUPPORTED_LOCALES.map((item) => {
        const active = item.code === locale;
        return (
          <PressableScale
            key={item.code}
            onPress={() => onChange(item.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.langItem, active ? styles.langItemActive : null]}
          >
            <Text preset="overline" color={active ? COLORS.pureWhite : COLORS.slateGray} style={{ fontSize: 10 }}>
              {item.code.toUpperCase()}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Voile flouté natif ; sur web le fond semi-opaque suffit. */
function MobileMenu({
  items,
  onClose,
  isAuthenticated,
  locale,
  onLocaleChange,
}: {
  items: NavItem[];
  onClose: () => void;
  isAuthenticated: boolean;
  locale: 'fr' | 'en';
  onLocaleChange: (next: 'fr' | 'en') => void;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };

  return (
    <Animated.View entering={FadeIn.duration(DURATION.fast)} style={styles.overlay}>
      <Animated.View entering={SlideInDown.duration(DURATION.slow).springify()} style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Logo size={30} />
          <View style={styles.sheetHeaderActions}>
            <LanguageToggle locale={locale} onChange={onLocaleChange} />
            <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>
        </View>

        <View style={styles.sheetLinks}>
          {items.map((item, index) => {
            const active = pathname === item.href;
            return (
              <Animated.View
                key={item.key}
                entering={FadeIn.delay(120 + index * 55).duration(DURATION.base)}
              >
                <PressableScale onPress={() => go(item.href)} style={styles.sheetLink}>
                  <Text preset="overline" color={COLORS.gold} style={{ fontSize: 10 }}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text preset="h2" color={active ? COLORS.forestGreen : COLORS.textPrimary}>
                    {t(item.labelKey)}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={active ? COLORS.forestGreen : COLORS.slateGray}
                  />
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View entering={FadeIn.delay(420).duration(DURATION.base)} style={styles.sheetCta}>
          {isAuthenticated ? (
            <Button
              label="Retour à mon espace"
              onPress={() => {
                const etat = useAuthStore.getState();
                go(getUserInitialRoute({ user: etat.user, permissions: etat.permissions }).route);
              }}
              variant="primary"
              fullWidth
              icon="leaf"
            />
          ) : (
            <>
              <Button label={t('nav.signup')} onPress={() => go('/auth/register')} variant="primary" fullWidth />
              <Button label={t('nav.login')} onPress={() => go('/auth/login')} variant="outline" fullWidth />
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: LAYOUT.screenPadding,
    right: LAYOUT.screenPadding,
    zIndex: 1000,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.lightBorder,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.pureWhite,
    shadowColor: 'rgba(23, 77, 53, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 20,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    height: LAYOUT.navbarHeight,
    paddingHorizontal: SPACING.md,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
  },
  links: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  link: { paddingVertical: SPACING.sm, alignItems: 'center', gap: 4 },
  underline: {
    height: 2,
    width: '100%',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.livingGreen,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  lang: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    borderRadius: RADIUS.pill,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  langItem: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  langItemActive: { backgroundColor: COLORS.forestGreen },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12, 30, 21, 0.45)', zIndex: 60 },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.naturalWhite,
    paddingTop: SPACING.xxl,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACING.xxl,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sheetLinks: { flex: 1, gap: SPACING.md, marginTop: SPACING.xl },
  sheetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBorder,
  },
  sheetCta: { gap: SPACING.sm },
});

export const NAVBAR_HEIGHT = LAYOUT.navbarHeight;
export const MOBILE_MENU_EXIT = FadeOut;
export const NAV_DARK_TEXT = DARK.text;
