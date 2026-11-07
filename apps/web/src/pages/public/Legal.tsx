import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Card, FilterChip, Section, Text } from '@/components/ui';
import { COLORS, DURATION, EASE } from '@/theme';

const SECTIONS = [
  {
    key: 'mentions',
    label: 'Mentions légales',
    body: [
      "AGRIKONNECT AFRICA est une plateforme de traçabilité agricole, de mise en relation commerciale et d'investissement.",
      "La plateforme n'est ni acheteur, ni vendeur, ni transporteur, ni certificateur : elle met en relation des organisations et trace les données qu'elles déclarent ou mesurent.",
      "Les contenus publiés par les organisations restent sous leur responsabilité. La plateforme n'édite pas ces contenus a priori.",
    ],
  },
  {
    key: 'confidentialite',
    label: 'Confidentialité',
    body: [
      "Les données personnelles sont traitées conformément au règlement applicable dans le pays de l'organisation.",
      "Les coordonnées (téléphone, email, adresse) ne sont jamais exposées publiquement : le contact passe par une conversation ou une demande acceptée.",
      "Les agrégats publiés respectent un seuil de k-anonymat : tout groupe plus petit est masqué, avec son motif.",
      "Aucune donnée n'est transmise à un modèle d'IA sans consentement explicite, daté et réversible.",
    ],
  },
  {
    key: 'conditions',
    label: "Conditions d'utilisation",
    body: [
      "L'inscription est ouverte en libre-service aux producteurs, coopératives, entreprises agricoles, acheteurs, fournisseurs, investisseurs et agents de support. Les rôles administrateur et vérificateur ne sont jamais auto-attribués.",
      "Chaque organisation déclare ses données sous sa responsabilité. Une donnée déclarée reste marquée comme telle tant qu'aucun contrôle n'a eu lieu.",
      "Les sorties d'IA et de télédétection sont des estimations : elles ne constituent jamais un conseil agronomique validé.",
      "Tout usage abusif (données falsifiées, usurpation, spam) entraîne la suspension du compte, motivée et réversible.",
    ],
  },
  {
    key: 'donnees',
    label: 'Données et provenance',
    body: [
      "Chaque valeur affichée porte sa provenance : ✔ pour une mesure ou une donnée vérifiée, ≈ pour une déclaration ou une estimation.",
      "La source, la méthode et la date accompagnent la valeur. Quand une donnée manque, elle manque : la plateforme ne complète jamais un trou par une estimation silencieuse.",
      "Les unités incompatibles ne sont jamais additionnées. Les totaux indiquent toujours leur périmètre.",
    ],
  },
];

/** PUBLIC — pages légales : mentions, confidentialité, conditions, données. */
export default function PublicLegal() {
  const [active, setActive] = useState(SECTIONS[0].key);
  const section = SECTIONS.find((item) => item.key === active) ?? SECTIONS[0];

  return (
    <Section>
      <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
        Légal
      </Text>
      <Text preset="h1" style={{ marginBottom: 8 }}>
        Informations légales
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32, maxWidth: 640 }}>
        Mentions légales, confidentialité, conditions d'utilisation et politique de provenance des données.
      </Text>

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
