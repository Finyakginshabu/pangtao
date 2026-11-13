import React from 'react';
import { TransactionKind } from '../types/transaction.types';
import { font, radius } from '../styles/theme';

/** f-07 §2.2 labels; colour is decoration only, the text carries the meaning (NFR-08). */
export const KIND_LABEL: Record<TransactionKind, string> = {
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
  OPENING_BALANCE: 'Opening Balance',
};

const KIND_COLORS: Record<TransactionKind, { bg: string; border: string; fg: string }> = {
  PAYMENT: { bg: '#FBEFE6', border: '#E6BE9C', fg: '#7A3E12' },
  RECEIPT: { bg: '#E7F4EE', border: '#9CCDB6', fg: '#1F5C42' },
  OPENING_BALANCE: { bg: '#EAF0F7', border: '#A9BDD3', fg: '#2E4A67' },
};

export const TransactionKindBadge: React.FC<{ kind: TransactionKind }> = ({ kind }) => {
  const palette = KIND_COLORS[kind];
  return (
    <span
      data-testid="kind-badge"
      style={{
        display: 'inline-block',
        fontSize: font.size.xs,
        fontWeight: font.weight.semibold,
        padding: '0.1rem 0.5rem',
        borderRadius: radius.full,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        color: palette.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {KIND_LABEL[kind]}
    </span>
  );
};
