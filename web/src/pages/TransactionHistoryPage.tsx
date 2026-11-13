import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { TransactionKindBadge } from '../components/TransactionKindBadge';
import { useAuth } from '../context/AuthContext';
import { fetchTransactions, transactionsQueryKey } from '../api/transactions.api';
import { errorCode, errorMessage } from '../api/http';
import { HistoryTransaction } from '../types/transaction.types';
import { formatSatang } from '../utils/money';
import { formatCalendarDate } from '../utils/date';
import { colors, font, radius, space } from '../styles/theme';

/** f-07 §1: default page size 50, server maximum 100. */
const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

const cardStyle: React.CSSProperties = {
  borderRadius: radius.xl,
  padding: `${space[2]} ${space[5]}`,
};

const skeletonBar: React.CSSProperties = {
  display: 'block',
  height: '0.85rem',
  borderRadius: radius.full,
  backgroundColor: '#E8E2D6',
};

const linkButton: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  color: colors.cobalt,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  textDecoration: 'underline',
  cursor: 'pointer',
};

const pagerButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[1],
  padding: '0.35rem 0.8rem',
  borderRadius: radius.md,
  border: `1px solid ${colors.parchment}`,
  backgroundColor: colors.surfaceSolid,
  color: colors.cobalt,
  fontWeight: font.weight.medium,
  cursor: 'pointer',
};

const HistoryRow: React.FC<{ transaction: HistoryTransaction; first: boolean }> = ({ transaction, first }) => {
  const [expanded, setExpanded] = useState(false);
  const linesId = `history-lines-${transaction.id}`;
  const lineCount = transaction.lines.length;

  return (
    <li
      data-testid="history-row"
      style={{ padding: `${space[3]} 0`, borderTop: first ? 'none' : `1px solid ${colors.border}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3], flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 14rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
            <span style={{ fontSize: font.size.sm, color: colors.textMuted, whiteSpace: 'nowrap' }}>
              {formatCalendarDate(transaction.txnDate)}
            </span>
            <TransactionKindBadge kind={transaction.kind} />
          </div>
          <Link
            to={`/transactions/${transaction.id}`}
            data-testid="history-open"
            style={{
              display: 'block',
              marginTop: space[1],
              fontSize: font.size.base,
              fontWeight: font.weight.medium,
              color: colors.textPrimary,
              textDecoration: 'none',
              overflowWrap: 'anywhere',
            }}
          >
            {transaction.accountName}
          </Link>
          {transaction.memo && (
            <span style={{ display: 'block', fontSize: font.size.sm, color: colors.textSecondary, overflowWrap: 'anywhere' }}>
              {transaction.memo}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: space[1] }}>
          <span style={{ fontSize: font.size.base, fontWeight: font.weight.bold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
            {formatSatang(transaction.totalAmount)}
          </span>
          {lineCount > 0 && (
            <button
              type="button"
              data-testid="history-expand"
              aria-expanded={expanded}
              aria-controls={linesId}
              onClick={() => setExpanded((value) => !value)}
              style={linkButton}
            >
              {expanded ? 'Hide lines' : `Show ${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <ul
          id={linesId}
          style={{
            listStyle: 'none',
            margin: `${space[2]} 0 0`,
            padding: `${space[2]} ${space[3]}`,
            borderRadius: radius.md,
            backgroundColor: colors.porcelain,
          }}
        >
          {transaction.lines.map((line) => (
            <li
              key={line.id}
              data-testid="history-line"
              style={{ display: 'flex', justifyContent: 'space-between', gap: space[3], flexWrap: 'wrap', padding: `${space[1]} 0` }}
            >
              <span style={{ minWidth: 0, fontSize: font.size.sm, color: colors.textPrimary, overflowWrap: 'anywhere' }}>
                {line.targetAccountName}
                {line.note && <span style={{ color: colors.textMuted }}> · {line.note}</span>}
              </span>
              <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, fontVariantNumeric: 'tabular-nums' }}>
                {formatSatang(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const HistorySkeleton: React.FC = () => (
  <ul data-testid="history-skeleton" role="status" aria-label="Loading transactions" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
    {[0, 1, 2, 3].map((index) => (
      <li
        key={index}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space[2],
          padding: `${space[3]} 0`,
          borderTop: index === 0 ? 'none' : `1px solid ${colors.border}`,
        }}
      >
        <span style={{ ...skeletonBar, width: '30%' }} />
        <span style={{ ...skeletonBar, width: '55%', height: '1rem' }} />
      </li>
    ))}
  </ul>
);

export const TransactionHistoryPage: React.FC = () => {
  const { refetchUser } = useAuth();
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);

  const historyQuery = useQuery({
    queryKey: [...transactionsQueryKey, { limit, offset }],
    queryFn: () => fetchTransactions(limit, offset),
    placeholderData: keepPreviousData,
  });

  // An expired session re-checks the user, and the route guard then sends them to /login.
  const unauthenticated = errorCode(historyQuery.error) === 'UNAUTHENTICATED';
  useEffect(() => {
    if (unauthenticated) void refetchUser();
  }, [unauthenticated, refetchUser]);

  const page = historyQuery.data;
  const showSkeleton = historyQuery.isPending || (historyQuery.isError && historyQuery.isFetching);
  const firstShown = page && page.items.length > 0 ? page.offset + 1 : 0;
  const lastShown = page ? page.offset + page.items.length : 0;

  return (
    <AppShell>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: space[3], flexWrap: 'wrap', marginBottom: space[6] }}>
          <div>
            <h2 style={{ fontSize: font.size['2xl'], fontWeight: font.weight.semibold, color: colors.textPrimary, marginBottom: space[2] }}>
              Transaction history
            </h2>
            <p style={{ color: colors.textMuted, margin: 0 }}>Every recorded transaction, newest first.</p>
          </div>
          <Link
            to="/transactions/new"
            className="pt-btn-primary"
          >
            <Icon name="add" size={1.125} />
            Record transaction
          </Link>
        </div>

        {historyQuery.isError && !historyQuery.isFetching && (
          <ErrorBanner
            message={errorMessage(historyQuery.error, 'Unable to load your transactions. Please try again.')}
            onRetry={() => void historyQuery.refetch()}
          />
        )}

        <section aria-label="Transactions" className="pt-card" style={cardStyle}>
          {showSkeleton ? (
            <HistorySkeleton />
          ) : historyQuery.isError ? null : page && page.total === 0 ? (
            <div data-testid="history-empty" style={{ padding: `${space[6]} 0`, textAlign: 'center' }}>
              <p style={{ fontSize: font.size.base, color: colors.textSecondary, margin: `0 0 ${space[3]}` }}>
                No transactions recorded yet.
              </p>
              <Link to="/transactions/new" style={{ color: colors.cobalt, fontWeight: font.weight.semibold }}>
                Record your first transaction
              </Link>
            </div>
          ) : page ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {page.items.map((transaction, index) => (
                <HistoryRow key={transaction.id} transaction={transaction} first={index === 0} />
              ))}
            </ul>
          ) : null}
        </section>

        {page && page.total > 0 && !historyQuery.isError && (
          <nav
            aria-label="History pages"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space[3], flexWrap: 'wrap', marginTop: space[4] }}
          >
            <span data-testid="history-counter" style={{ fontSize: font.size.sm, color: colors.textSecondary }}>
              Showing {firstShown}–{lastShown} of {page.total}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
              <label style={{ fontSize: font.size.sm, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: space[1] }}>
                Per page
                <select
                  data-testid="history-page-size"
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value));
                    setOffset(0);
                  }}
                  style={{ padding: '0.25rem', borderRadius: radius.sm, border: `1px solid ${colors.parchment}` }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-testid="history-prev"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                style={{ ...pagerButton, opacity: offset === 0 ? 0.5 : 1 }}
              >
                <Icon name="chevron_left" size={1.125} />
                Previous
              </button>
              <button
                type="button"
                data-testid="history-next"
                disabled={lastShown >= page.total}
                onClick={() => setOffset(offset + limit)}
                style={{ ...pagerButton, opacity: lastShown >= page.total ? 0.5 : 1 }}
              >
                Next
                <Icon name="chevron_right" size={1.125} />
              </button>
            </div>
          </nav>
        )}
      </div>
    </AppShell>
  );
};
