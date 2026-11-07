import { motion } from 'framer-motion';

import { Card, FilterChip, Section, Text } from '@/components/ui';
import { SUPPORTED_LOCALES, useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/** PUBLIC — sélecteur de langue et de pays (fr / en). */
export default function CountryLanguageSelector() {
  const { t, locale, setLocale } = useI18n();

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Préférences
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Langue et pays
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        La langue choisie s'applique à toute l'interface et aux formats de dates et de nombres.
      </Text>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <Card tone="white">
          <Text preset="h3" style={{ marginBottom: 16 }}>
            Langue
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SUPPORTED_LOCALES.map((item) => (
              <FilterChip key={item.code} label={`${item.native} (${item.label})`} active={locale === item.code} onPress={() => setLocale(item.code)} />
            ))}
          </div>
          <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 16, lineHeight: 1.7 }}>
            {t('common.seeAll')}
          </Text>
        </Card>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: DURATION.base / 1000, ease: EASE.out }}>
          <Card tone="pale" style={{ height: '100%' }}>
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Pays
            </Text>
            <Text preset="bodyMd" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
              Le pays est déterminé par votre organisation à l'inscription. Il pilote la devise par défaut, les
              locales disponibles et le périmètre des agrégats de marché.
            </Text>
          </Card>
        </motion.div>
      </div>
    </Section>
  );
}
