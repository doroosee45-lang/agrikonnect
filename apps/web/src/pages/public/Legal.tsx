import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Card, FilterChip, Section, Text } from '@/components/ui';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n, tr } from '@/i18n';

const SECTIONS = [
  {
    key: 'mentions',
    get label() { return tr('ui.mentionsLegales'); },
    get body() { return [
      tr('ui.agrikonnectAfricaEstUnePlateformeDe'),
      tr('ui.laPlateformeNEstNiAcheteur'),
      tr('ui.lesContenusPubliesParLesOrganisations'),
    ]; },
  },
  {
    key: 'confidentialite',
    get label() { return tr('ui.confidentialite'); },
    get body() { return [
      tr('ui.lesDonneesPersonnellesSontTraiteesConformement'),
      tr('ui.lesCoordonneesTelephoneEmailAdresseNe'),
      tr('ui.lesAgregatsPubliesRespectentUnSeuil'),
      tr('ui.aucuneDonneeNEstTransmiseA'),
    ]; },
  },
  {
    key: 'conditions',
    get label() { return tr('ui.conditionsDUtilisation'); },
    get body() { return [
      tr('ui.lInscriptionEstOuverteEnLibre'),
      tr('ui.chaqueOrganisationDeclareSesDonneesSous'),
      tr('ui.lesSortiesDIaEtDe'),
      tr('ui.toutUsageAbusifDonneesFalsifieesUsurpation'),
    ]; },
  },
  {
    key: 'donnees',
    get label() { return tr('ui.donneesEtProvenance'); },
    get body() { return [
      tr('ui.chaqueValeurAfficheePorteSaProvenance'),
      tr('ui.laSourceLaMethodeEtLa'),
      tr('ui.lesUnitesIncompatiblesNeSontJamais'),
    ]; },
  },
];

/** PUBLIC — pages légales : mentions, confidentialité, conditions, données. */
export default function PublicLegal() {
  const { t } = useI18n();
  const [active, setActive] = useState(SECTIONS[0].key);
  const section = SECTIONS.find((item) => item.key === active) ?? SECTIONS[0];

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>{t('ui.legal')}</Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.informationsLegales')}</Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>{t('ui.mentionsLegalesConfidentialiteConditionsDUtilisa')}</Text>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {SECTIONS.map((item) => (
          <FilterChip key={item.key} label={item.label} active={active === item.key} onPress={() => setActive(item.key)} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={section.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
        >
          <Card tone="white">
            <Text preset="h3" style={{ marginBottom: 20 }}>
              {section.label}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {section.body.map((paragraph) => (
                <Text key={paragraph} preset="bodyMd" color={COLORS.slateGray} style={{ lineHeight: 1.8 }}>
                  {paragraph}
                </Text>
              ))}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </Section>
  );
}
