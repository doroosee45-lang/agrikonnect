import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { COLORS, RADIUS } from '@/theme';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optionalLabel?: string;
}

export function Input({ label, error, hint, optionalLabel, style, ...props }: InputProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
        {label}
        {optionalLabel ? (
          <span style={{ fontWeight: 400, color: COLORS.slateGray, marginLeft: 6 }}>({optionalLabel})</span>
        ) : null}
      </span>
      <input
        style={{
          height: 44,
          padding: '0 14px',
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          borderRadius: RADIUS.md,
          border: `1.5px solid ${error ? COLORS.error : COLORS.lightBorder}`,
          backgroundColor: COLORS.pureWhite,
          color: COLORS.textPrimary,
          outline: 'none',
          transition: 'border-color 150ms',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.forestGreen;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.lightBorder;
        }}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: 12, color: COLORS.error }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: COLORS.slateGray }}>{hint}</span>
      ) : null}
    </label>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  optionalLabel?: string;
  minHeight?: number;
}

export function TextArea({ label, error, hint, optionalLabel, minHeight = 100, style, ...props }: TextAreaProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
        {label}
        {optionalLabel ? (
          <span style={{ fontWeight: 400, color: COLORS.slateGray, marginLeft: 6 }}>({optionalLabel})</span>
        ) : null}
      </span>
      <textarea
        style={{
          minHeight,
          padding: '12px 14px',
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          borderRadius: RADIUS.md,
          border: `1.5px solid ${error ? COLORS.error : COLORS.lightBorder}`,
          backgroundColor: COLORS.pureWhite,
          color: COLORS.textPrimary,
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color 150ms',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.forestGreen;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? COLORS.error : COLORS.lightBorder;
        }}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: 12, color: COLORS.error }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: COLORS.slateGray }}>{hint}</span>
      ) : null}
    </label>
  );
}
