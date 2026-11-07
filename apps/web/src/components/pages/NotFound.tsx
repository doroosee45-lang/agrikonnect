import { Link } from 'react-router-dom';

import { Button, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme';

export default function NotFound() {
  return (
    <Section style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Text preset="h1" style={{ marginBottom: 16 }}>
          404
        </Text>
        <Text preset="bodyLg" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
          La page que vous cherchez n'existe pas.
        </Text>
        <Link to="/">
          <Button label="Retour à l'accueil" variant="primary" size="lg" />
        </Link>
      </div>
    </Section>
  );
}
