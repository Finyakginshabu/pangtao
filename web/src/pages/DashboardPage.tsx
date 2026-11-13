import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { OpeningBalanceDialog } from '../components/OpeningBalanceDialog';
import { accountsQueryKey, fetchAccounts } from '../api/accounts.api';
import { transactionsQueryKey } from '../api/transactions.api';
import { fetchSummary, summaryQueryKey } from '../api/summary.api';
import { errorCode, errorMessage } from '../api/http';
import { Account, AccountType, OpeningBalanceTransaction } from '../types/account.types';
import { formatSatang, formatSignedSatang } from '../utils/money';
import { formatCalendarDate, monthRange } from '../utils/date';
import { colors, font, radius, shadow, space } from '../styles/theme';

/** f-03 §2.2: these three account groups, plus the F-08 current-month totals widget below. */
const SECTIONS: ReadonlyArray<{ key: string; type: AccountType; title: string; caption: string; empty: string }> = [
  {
    key: 'cash',
    type: 'CASH',
    title: 'Cash',
    caption: 'Wallets and bank accounts',
    empty: 'No cash accounts yet.',
  },
  {
    key: 'debts',
    type: 'LOAN_TAKEN',
    title: 'Debts',
    caption: 'Credit cards and money borrowed',
    empty: 'No debts. Nothing is owed on a card or loan.',
  },
  {
    key: 'owed',
    type: 'LOAN_GIVEN',
    title: 'Owed to Me',
    caption: 'Personal loans given out',
    empty: 'No loans given. Money you lend to someone will appear here.',
  },
];

const SUBTYPE_LABEL: Record<string, string> = {
  WALLET: 'Wallet',
  BANK: 'Bank',
  CREDIT_CARD: 'Credit card',
  OTHER: 'Other',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceSolid,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.xl,
  boxShadow: shadow.card,
  padding: space[5],
  display: 'flex',
  flexDirection: 'column',
  gap: space[3],
  minWidth: 0,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  // min() keeps a single column inside a 360 px viewport.
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: space[6],
};

const skeletonBar: React.CSSProperties = {
  display: 'block',
  height: '0.85rem',
  borderRadius: radius.full,
  backgroundColor: '#E8E2D6',
};

const SUMMARY_INCOME_COLOR = '#2F6B45';
const SUMMARY_EXPENSE_COLOR = '#A34A1F';
const SUMMARY_NEGATIVE_COLOR = '#8B2525';

const summaryLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: font.size.xs,
  color: colors.textMuted,
};

const summaryValueStyle: React.CSSProperties = {
  margin: `${space[1]} 0 0`,
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  fontVariantNumeric: 'tabular-nums',
};

const NegativeLabel: React.FC = () => (
  <span
    style={{
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      color: '#8B2525',
      backgroundColor: '#FBEAEA',
      borderRadius: radius.full,
      padding: '0.1rem 0.5rem',
      whiteSpace: 'nowrap',
    }}
  >
    Negative balance
  </span>
);

const Amount: React.FC<{ satang: number; size: string; testId?: string }> = ({ satang, size, testId }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
    <span
      data-testid={testId}
      style={{ fontSize: size, fontWeight: font.weight.bold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}
    >
      {formatSatang(satang)}
    </span>
    {satang < 0 && <NegativeLabel />}
  </span>
);

const SectionCard: React.FC<{
  section: (typeof SECTIONS)[number];
  accounts: Account[];
  onSetOpeningBalance: (account: Account) => void;
}> = ({ section, accounts, onSetOpeningBalance }) => {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const headingId = `dashboard-section-${section.key}-title`;

  return (
    <section data-testid={`dashboard-section-${section.key}`} aria-labelledby={headingId} style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3], flexWrap: 'wrap' }}>
        <div>
          <h3 id={headingId} style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.textPrimary, margin: 0 }}>
            {section.title}
          </h3>
          <p style={{ fontSize: font.size.xs, color: colors.textMuted, margin: 0 }}>{section.caption}</p>
        </div>
        {accounts.length > 0 && (
          <Amount satang={total} size={font.size.xl} testId={`dashboard-section-${section.key}-total`} />
        )}
      </div>

      {accounts.length === 0 ? (
        <p data-testid={`dashboard-section-${section.key}-empty`} style={{ fontSize: font.size.sm, color: colors.textMuted, margin: 0 }}>
          {section.empty}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {accounts.map((account, index) => (
            <li
              key={account.id}
              data-testid={`account-row-${account.name}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space[3],
                flexWrap: 'wrap',
                padding: `${space[3]} 0`,
                borderTop: index === 0 ? 'none' : `1px solid ${colors.border}`,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textPrimary }}>
                  {account.name}
                </span>
                {/* The action shares the subtype line so the card height stays stable (NFR-08). */}
                <span style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
                  {account.subtype && (
                    <span style={{ fontSize: font.size.xs, color: colors.textMuted }}>{SUBTYPE_LABEL[account.subtype]}</span>
                  )}
                  {account.openingBalance ? (
                    <span
                      data-testid={`opening-balance-info-${account.name}`}
                      style={{ fontSize: font.size.xs, color: colors.textMuted }}
                    >
                      Opening balance {formatSatang(account.openingBalance.amount)} on{' '}
                      {formatCalendarDate(account.openingBalance.date)}
                    </span>
                  ) : account.isArchived ? null : (
                    <button
                      type="button"
                      data-testid={`set-opening-balance-${account.name}`}
                      aria-label={`Set opening balance for ${account.name}`}
                      onClick={() => onSetOpeningBalance(account)}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: colors.cobalt,
                        fontSize: font.size.xs,
                        fontWeight: font.weight.medium,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Set opening balance
                    </button>
                  )}
                </span>
              </span>
              <Amount satang={account.balance} size={font.size.base} testId={`account-balance-${account.name}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const DashboardSkeleton: React.FC = () => (
  <div data-testid="dashboard-skeleton" role="status" aria-live="polite" aria-label="Loading balances" style={gridStyle}>
    {SECTIONS.map((section) => (
      <div key={section.key} style={cardStyle}>
        <span style={{ ...skeletonBar, width: '40%', height: '1.1rem' }} />
        <span style={{ ...skeletonBar, width: '75%' }} />
        <span style={{ ...skeletonBar, width: '60%' }} />
      </div>
    ))}
  </div>
);

/**
 * F-08 §1 step 1: the Dashboard also shows the current month's income, expense and net.
 * It shares the summary query key with `/summary`, so recording a transaction refreshes both.
 */
const DashboardSummary: React.FC = () => {
  const range = monthRange();
  const summaryQuery = useQuery({
    queryKey: [...summaryQueryKey, range.from, range.to],
    queryFn: () => fetchSummary(range.from, range.to),
  });

  return (
    <section
      data-testid="dashboard-summary"
      aria-labelledby="dashboard-summary-title"
      style={{ ...cardStyle, marginTop: space[6] }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3], flexWrap: 'wrap' }}>
        <div>
          <h3
            id="dashboard-summary-title"
            style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.textPrimary, margin: 0 }}
          >
            This month
          </h3>
          <p style={{ fontSize: font.size.xs, color: colors.textMuted, margin: 0 }}>
            {formatCalendarDate(range.from)} – {formatCalendarDate(range.to)}
          </p>
        </div>
        <Link
          to="/summary"
          data-testid="dashboard-summary-link"
          style={{ color: colors.cobalt, fontSize: font.size.sm, fontWeight: font.weight.semibold }}
        >
          View summary
        </Link>
      </div>

      {summaryQuery.isPending ? (
        <div
          data-testid="dashboard-summary-skeleton"
          role="status"
          aria-label="Loading summary"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: space[3] }}
        >
          {[0, 1, 2].map((index) => (
            <span key={index} style={{ ...skeletonBar, width: '70%', height: '1.1rem' }} />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <ErrorBanner
          message={errorMessage(summaryQuery.error, "Unable to load this month's summary. Please try again.")}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : summaryQuery.data ? (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: space[3], margin: 0 }}>
          <div>
            <dt style={summaryLabelStyle}>Income</dt>
            <dd
              data-testid="dashboard-summary-income"
              style={{ ...summaryValueStyle, color: SUMMARY_INCOME_COLOR }}
            >
              {formatSignedSatang(summaryQuery.data.income)}
            </dd>
          </div>
          <div>
            <dt style={summaryLabelStyle}>Expenses</dt>
            <dd
              data-testid="dashboard-summary-expense"
              style={{ ...summaryValueStyle, color: SUMMARY_EXPENSE_COLOR }}
            >
              {formatSatang(summaryQuery.data.expense)}
            </dd>
          </div>
          <div>
            <dt style={summaryLabelStyle}>Net</dt>
            <dd
              data-testid="dashboard-summary-net"
              style={{
                ...summaryValueStyle,
                color: summaryQuery.data.net < 0 ? SUMMARY_NEGATIVE_COLOR : SUMMARY_INCOME_COLOR,
              }}
            >
              {formatSignedSatang(summaryQuery.data.net)}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
};

export const DashboardPage: React.FC = () => {
  const { user, refetchUser } = useAuth();
  const accountsQuery = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });
  const queryClient = useQueryClient();
  const [openingAccount, setOpeningAccount] = useState<Account | null>(null);

  // An expired session re-checks the user, and the route guard then sends them to /login.
  const unauthenticated = errorCode(accountsQuery.error) === 'UNAUTHENTICATED';
  useEffect(() => {
    if (unauthenticated) void refetchUser();
  }, [unauthenticated, refetchUser]);

  /**
   * f-04 §2.2: an opening balance always adds to these three account types' derived
   * balances, so the card updates immediately; the refetch then confirms the server value.
   */
  const handleOpeningSaved = (transaction: OpeningBalanceTransaction) => {
    queryClient.setQueryData<Account[]>(accountsQueryKey, (accounts) =>
      accounts?.map((account) =>
        account.id === transaction.accountId
          ? {
              ...account,
              balance: account.balance + transaction.totalAmount,
              openingBalance: {
                transactionId: transaction.id,
                amount: transaction.totalAmount,
                date: transaction.txnDate,
              },
            }
          : account
      )
    );
    setOpeningAccount(null);
    void queryClient.invalidateQueries({ queryKey: accountsQueryKey });
    void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    void queryClient.invalidateQueries({ queryKey: summaryQueryKey });
  };

  return (
    <AppShell>
      <div>
        <h2 style={{ fontSize: font.size['2xl'], fontWeight: font.weight.semibold, color: colors.textPrimary, marginBottom: space[2] }}>
          Welcome back, {user?.displayName}
        </h2>
        <p style={{ color: colors.textMuted, marginBottom: space[8] }}>Overview of your financial accounts and balances.</p>

        {accountsQuery.isError && (
          <ErrorBanner
            message={errorMessage(accountsQuery.error, 'Unable to load your balances. Please try again.')}
            onRetry={() => void accountsQuery.refetch()}
          />
        )}

        {accountsQuery.isPending || (accountsQuery.isError && accountsQuery.isFetching) ? (
          <DashboardSkeleton />
        ) : accountsQuery.isSuccess ? (
          <div style={gridStyle}>
            {SECTIONS.map((section) => (
              <SectionCard
                key={section.key}
                section={section}
                accounts={accountsQuery.data.filter((account) => account.type === section.type)}
                onSetOpeningBalance={setOpeningAccount}
              />
            ))}
          </div>
        ) : null}

        <DashboardSummary />

        {/* f-05 §2.2 entry point; below the cards so the balance overview stays first on small screens. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: space[6] }}>
          <Link
            to="/transactions/new"
            data-testid="record-payment-link"
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: radius.md,
              backgroundColor: colors.cobalt,
              color: colors.porcelain,
              fontWeight: font.weight.semibold,
              textDecoration: 'none',
            }}
          >
            Record payment
          </Link>
        </div>
      </div>

      {openingAccount && (
        <OpeningBalanceDialog
          account={openingAccount}
          onClose={() => setOpeningAccount(null)}
          onSaved={handleOpeningSaved}
        />
      )}
    </AppShell>
  );
};
