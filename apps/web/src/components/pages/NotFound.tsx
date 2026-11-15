import { Link } from 'react-router-dom';

import { Button, Section, Text } from '@/components/ui';
import { COLORS } from '@/theme';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Section style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Text preset="h1" style={{ marginBottom: 16 }}>
          404
        </Text>
        <Text preset="bodyLg" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.laPageQueVousCherchezN')}</Text>
        <Link to="/">
          <Button label={t('ui.retourALAccueil')} variant="primary" size="lg" />
        </Link>
      </div>
    </Section>
  );
}
