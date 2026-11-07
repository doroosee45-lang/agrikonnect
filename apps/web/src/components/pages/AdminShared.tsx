import type { ReactNode } from 'react';

import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

/** Ligne brute renvoyée par les endpoints /admin/* (formes non typées côté serveur). */
export type Row = Record<string, unknown>;

export function str(row: Row, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? '—' : String(value);
}

export function StatusChip({ value }: { value: unknown }) {
  const status = String(value ?? 'UNKNOWN');
  const tone =
    status === 'ACTIVE' || status === 'APPROVED' || status === 'VERIFIED' || status === 'COMPLETED' || status === 'RESOLVED'
      ? 'success'
      : status === 'SUSPENDED' || status === 'REJECTED' || status === 'FAILED'
        ? 'error'
        : status === 'PENDING' || status === 'ESCALATED'
          ? 'warning'
          : 'neutral';
  return <Chip label={status} tone={tone as 'success' | 'error' | 'warning' | 'neutral'} size="sm" />;
}

export function DateCell({ value }: { value: unknown }) {
  const { locale } = useI18n();
  if (!value) return <>—</>;
  return <>{formatDate(String(value), locale)}</>;
}

export function Num({ value }: { value: unknown }) {
  return <>{value === null || value === undefined ? '—' : String(value)}</>;
}

export function render(key: string): (row: Row) => ReactNode {
  return (row) => str(row, key);
}
