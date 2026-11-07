import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button, Card, Section, Text } from './index';
import { COLORS } from '@/theme';

export interface AuthGateProps {
  isAuthenticated: boolean;
  title: string;
  description?: string;
  icon?: string;
  children: ReactNode;
}

export function AuthGate({ isAuthenticated, title, description, icon, children }: AuthGateProps) {
  if (isAuthenticated) return <>{children}</>;

  return (
    <Section style={{ minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card tone="white" style={{ textAlign: 'center', padding: 48, maxWidth: 520 }}>
        {icon ? <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div> : null}
        <Text preset="h2" style={{ marginBottom: 12 }}>
          {title}
        </Text>
        {description ? (
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            {description}
          </Text>
        ) : null}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/auth/login">
            <Button label="Se connecter" variant="primary" />
          </Link>
          <Link to="/auth/register">
            <Button label="Créer un compte" variant="outline" />
          </Link>
        </div>
      </Card>
    </Section>
  );
}
