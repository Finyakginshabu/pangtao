import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../context/AuthContext';
import { fetchSummary, summaryQueryKey } from '../api/summary.api';
import { errorCode, errorMessage } from '../api/http';
import { formatSatang, formatSignedSatang } from '../utils/money';
import { formatCalendarDate, monthRange } from '../utils/date';
import { colors, font, radius, shadow, space } from '../styles/theme';

type Preset = 'this-month' | 'last-month' | 'custom';

const PRESETS: ReadonlyArray<{ key: Preset; label: string }> = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

/** f-08 §2.2 accents: income green, expenses red/orange, negative net red. */
const INCOME_COLOR = '#2F6B45';
const EXPENSE_COLOR = '#A34A1F';
const NEGATIVE_COLOR = '#8B2525';

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceSolid,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.xl,
  boxShadow: shadow.card,
  padding: space[5],
  minWidth: 0,
};

const skeletonBar: React.CSSProperties = {
  display: 'block',
  height: '0.85rem',
  borderRadius: radius.full,
  backgroundColor: '#E8E2D6',
};

const presetButton = (active: boolean): React.CSSProperties => ({
  padding: '0.4rem 0.9rem',
  borderRadius: radius.full,
  border: `1px solid ${active ? colors.cobalt : colors.parchment}`,
  backgroundColor: active ? colors.cobalt : colors.surfaceSolid,
  color: active ? colors.porcelain : colors.cobalt,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  cursor: 'pointer',
});

const dateInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  marginTop: space[1],
  padding: '0.4rem 0.5rem',
  borderRadius: radius.md,
  border: `1px solid ${colors.parchment}`,
  backgroundColor: colors.surfaceInput,
  color: colors.textPrimary,
  fontFamily: font.family,
  fontSize: font.size.sm,
};

const MetricCard: React.FC<{ label: string; value: string; testId: string; accent: string }> = ({
  label,
  value,
  testId,
  accent,
}) => (
  <div data-testid={`${testId}-card`} style={cardStyle}>
    <span
      style={{
        display: 'block',
        fontSize: font.size.sm,
        fontWeight: font.weight.medium,
        color: colors.textSecondary,
      }}
    >
      {label}
    </span>
    <span
      data-testid={testId}
      style={{
        display: 'block',
        marginTop: space[2],
        fontSize: font.size['2xl'],
        fontWeight: font.weight.bold,
        color: accent,
        fontVariantNumeric: 'tabular-nums',
        overflowWrap: 'anywhere',
      }}
    >
      {value}
    </span>
  </div>
);

/** Skeleton cards keep the same test ids, so the layout does not jump when data arrives. */
const SummarySkeleton: React.FC = () => (
  <div
    data-testid="summary-skeleton"
    role="status"
    aria-live="polite"
    aria-label="Loading summary"
    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: space[4] }}
  >
    {[
      { testId: 'summary-income', width: '60%' },
      { testId: 'summary-expense', width: '55%' },
      { testId: 'summary-net', width: '65%' },
    ].map((item) => (
      <div key={item.testId} data-testid={item.testId} style={cardStyle}>
        <span style={{ ...skeletonBar, width: '45%' }} />
        <span style={{ ...skeletonBar, width: item.width, height: '1.6rem', marginTop: space[2] }} />
      </div>
    ))}
  </div>
);

export const SummaryPage: React.FC = () => {
  const { refetchUser } = useAuth();
  const [preset, setPreset] = useState<Preset>('this-month');
  const [thisMonth] = useState(() => monthRange());
  const [lastMonth] = useState(() => monthRange(new Date(), -1));
  const [customFrom, setCustomFrom] = useState(thisMonth.from);
  const [customTo, setCustomTo] = useState(thisMonth.to);

  const range =
    preset === 'this-month'
      ? thisMonth
      : preset === 'last-month'
        ? lastMonth
        : { from: customFrom, to: customTo };

  const summaryQuery = useQuery({
    queryKey: [...summaryQueryKey, range.from, range.to],
    queryFn: () => fetchSummary(range.from, range.to),
  });

  // An expired session re-checks the user, and the route guard then sends them to /login.
  const unauthenticated = errorCode(summaryQuery.error) === 'UNAUTHENTICATED';
  useEffect(() => {
    if (unauthenticated) void refetchUser();
  }, [unauthenticated, refetchUser]);

  const summary = summaryQuery.data;
  const showSkeleton = summaryQuery.isPending || (summaryQuery.isError && summaryQuery.isFetching);

  return (
    <AppShell>
      <div>
        <div style={{ marginBottom: space[6] }}>
          <h2
            style={{
              fontSize: font.size['2xl'],
              fontWeight: font.weight.semibold,
              color: colors.textPrimary,
              marginBottom: space[2],
            }}
          >
            Income and expense summary
          </h2>
          <p style={{ color: colors.textMuted, margin: 0 }}>
            Totals for the selected date range, in Thai Baht.
          </p>
        </div>

        <section aria-label="Date range" style={{ ...cardStyle, marginBottom: space[4] }}>
          <div
            role="group"
            aria-label="Date range presets"
            style={{ display: 'flex', flexWrap: 'wrap', gap: space[2] }}
          >
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                data-testid={`summary-preset-${key}`}
                aria-pressed={preset === key}
                onClick={() => setPreset(key)}
                style={presetButton(preset === key)}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3], marginTop: space[4] }}>
              <label
                style={{
                  flex: '1 1 10rem',
                  minWidth: 0,
                  fontSize: font.size.sm,
                  color: colors.textSecondary,
                }}
              >
                From
                <input
                  type="date"
                  data-testid="summary-range-from"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  style={dateInputStyle}
                />
              </label>
              <label
                style={{
                  flex: '1 1 10rem',
                  minWidth: 0,
                  fontSize: font.size.sm,
                  color: colors.textSecondary,
                }}
              >
                To
                <input
                  type="date"
                  data-testid="summary-range-to"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  style={dateInputStyle}
                />
              </label>
            </div>
          )}

          <p
            data-testid="summary-range-label"
            style={{ margin: `${space[3]} 0 0`, fontSize: font.size.sm, color: colors.textMuted }}
          >
            {formatCalendarDate(range.from)} – {formatCalendarDate(range.to)}
          </p>
        </section>

        {summaryQuery.isError && !summaryQuery.isFetching && (
          <ErrorBanner
            message={errorMessage(summaryQuery.error, 'Unable to load your summary. Please try again.')}
            onRetry={() => void summaryQuery.refetch()}
          />
        )}

        {showSkeleton ? (
          <SummarySkeleton />
        ) : summary ? (
          <section
            aria-label="Summary totals"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: space[4],
            }}
          >
            <MetricCard
              label="Total Income"
              testId="summary-income"
              value={formatSignedSatang(summary.income)}
              accent={INCOME_COLOR}
            />
            <MetricCard
              label="Total Expenses"
              testId="summary-expense"
              value={formatSatang(summary.expense)}
              accent={EXPENSE_COLOR}
            />
            <MetricCard
              label="Net Savings"
              testId="summary-net"
              value={formatSignedSatang(summary.net)}
              accent={summary.net < 0 ? NEGATIVE_COLOR : INCOME_COLOR}
            />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
};
