import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Button, Card, Section, Text } from '@/components/ui';
import { SERVICES } from '@/lib/platform';
import { COLORS, DURATION, EASE, LAYOUT } from '@/theme';

export default function Home() {
  return (
    <>
      {/* Hero */}
      <Section style={{ backgroundColor: COLORS.forestGreen, color: COLORS.pureWhite, padding: '96px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}
        >
          <Text preset="h1" color={COLORS.pureWhite} style={{ marginBottom: 24 }}>
            Traçabilité agricole, marchés et investissement en Afrique
          </Text>
          <Text preset="bodyLg" color="rgba(246, 247, 242, 0.85)" style={{ marginBottom: 32 }}>
            Chaque lot porte son origine. Chaque donnée porte sa source. Chaque transaction est traçable.
          </Text>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/services">
              <Button label="Découvrir la plateforme" variant="primary" size="lg" style={{ backgroundColor: COLORS.gold, color: COLORS.textPrimary }} />
            </Link>
            <Link to="/auth/register">
              <Button label="Créer un compte" variant="outline" size="lg" style={{ borderColor: COLORS.pureWhite, color: COLORS.pureWhite }} />
            </Link>
          </div>
        </motion.div>
      </Section>

      {/* Services */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
            Nos services
          </Text>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Une plateforme complète pour l'agriculture africaine
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ maxWidth: 600, margin: '0 auto' }}>
            De la parcelle au marché, en passant par l'investissement : traçabilité, données et mise en relation.
          </Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {SERVICES.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: DURATION.base / 1000, delay: index * 0.05, ease: EASE.out }}
            >
              <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{service.icon}</div>
                <Text preset="h4" color={COLORS.textPrimary}>
                  {service.title}
                </Text>
                <Text preset="bodyMd" color={COLORS.slateGray} style={{ flex: 1 }}>
                  {service.body}
                </Text>
                <Link to={service.href}>
                  <Button label="En savoir plus" variant="ghost" size="sm" />
                </Link>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section style={{ backgroundColor: COLORS.paleGreen }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Prêt à rejoindre AGRIKONNECT ?
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Créez votre compte et commencez à tracer vos productions, publier vos annonces ou investir dans des projets agricoles.
          </Text>
          <Link to="/auth/register">
            <Button label="Créer un compte gratuit" variant="primary" size="lg" />
          </Link>
        </div>
      </Section>
    </>
  );
}
