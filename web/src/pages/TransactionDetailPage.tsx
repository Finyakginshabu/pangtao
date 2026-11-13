import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { TransactionKindBadge } from '../components/TransactionKindBadge';
import { useAuth } from '../context/AuthContext';
import { fetchTransaction, transactionsQueryKey } from '../api/transactions.api';
import { errorCode, errorMessage } from '../api/http';
import { formatSatang } from '../utils/money';
import { formatCalendarDate } from '../utils/date';
import { colors, font, radius, shadow, space } from '../styles/theme';

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceSolid,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.xl,
  boxShadow: shadow.card,
  padding: space[5],
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
};

const skeletonBar: React.CSSProperties = {
  display: 'block',
  height: '0.85rem',
  borderRadius: radius.full,
  backgroundColor: '#E8E2D6',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: colors.textMuted,
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ minWidth: 0 }}>
    <span style={labelStyle}>{label}</span>
    <span style={{ display: 'block', fontSize: font.size.base, color: colors.textPrimary, overflowWrap: 'anywhere' }}>{children}</span>
  </div>
);

/** f-07 workflow step 5 / FR-25: one transaction with every allocation line and its note. */
export const TransactionDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { refetchUser } = useAuth();
  const detailQuery = useQuery({
    queryKey: [...transactionsQueryKey, 'detail', id],
    queryFn: () => fetchTransaction(id),
  });

  const code = errorCode(detailQuery.error);
  useEffect(() => {
    if (code === 'UNAUTHENTICATED') void refetchUser();
  }, [code, refetchUser]);

  // A malformed id (400) and another user's or unknown id (404) both mean "nothing to show here".
  const notFound = code === 'NOT_FOUND' || code === 'VALIDATION_ERROR';
  const transaction = detailQuery.data;

  return (
    <AppShell>
      <div>
        <Link to="/transactions" style={{ color: colors.cobalt, fontSize: font.size.sm }}>
          ← Back to history
        </Link>
        <h2 style={{ fontSize: font.size['2xl'], fontWeight: font.weight.semibold, color: colors.textPrimary, margin: `${space[3]} 0 ${space[6]}` }}>
          Transaction detail
        </h2>

        {detailQuery.isError && !notFound && !detailQuery.isFetching && (
          <ErrorBanner
            message={errorMessage(detailQuery.error, 'Unable to load this transaction. Please try again.')}
            onRetry={() => void detailQuery.refetch()}
          />
        )}

        {detailQuery.isPending || detailQuery.isFetching ? (
          <div role="status" aria-label="Loading transaction" style={cardStyle}>
            <span style={{ ...skeletonBar, width: '35%', height: '1.1rem' }} />
            <span style={{ ...skeletonBar, width: '60%' }} />
            <span style={{ ...skeletonBar, width: '50%' }} />
          </div>
        ) : notFound ? (
          <div data-testid="transaction-not-found" style={cardStyle}>
            <p style={{ margin: 0, color: colors.textSecondary }}>Transaction not found.</p>
          </div>
        ) : transaction ? (
          <section data-testid="transaction-detail" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
              <TransactionKindBadge kind={transaction.kind} />
              <span style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, fontVariantNumeric: 'tabular-nums' }}>
                {formatSatang(transaction.totalAmount)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(12rem, 100%), 1fr))', gap: space[4] }}>
              <Field label="Date">{formatCalendarDate(transaction.txnDate)}</Field>
              <Field label="Source account">{transaction.accountName}</Field>
              <Field label="Memo">{transaction.memo ?? '—'}</Field>
            </div>

            <div>
              <span style={labelStyle}>Allocation lines</span>
              {transaction.lines.length === 0 ? (
                <p style={{ margin: `${space[2]} 0 0`, fontSize: font.size.sm, color: colors.textMuted }}>
                  An opening balance has no allocation lines.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: `${space[2]} 0 0`, padding: 0 }}>
                  {transaction.lines.map((line, index) => (
                    <li
                      key={line.id}
                      data-testid="detail-line"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: space[3],
                        flexWrap: 'wrap',
                        padding: `${space[2]} 0`,
                        borderTop: index === 0 ? 'none' : `1px solid ${colors.border}`,
                      }}
                    >
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <span style={{ display: 'block', color: colors.textPrimary }}>{line.targetAccountName}</span>
                        {line.note && <span style={{ display: 'block', fontSize: font.size.sm, color: colors.textMuted }}>{line.note}</span>}
                      </span>
                      <span style={{ fontWeight: font.weight.semibold, fontVariantNumeric: 'tabular-nums' }}>
                        {formatSatang(line.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
};
