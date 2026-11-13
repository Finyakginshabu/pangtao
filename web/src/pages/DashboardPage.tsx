import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { OpeningBalanceDialog } from '../components/OpeningBalanceDialog';
import { accountsQueryKey, fetchAccounts } from '../api/accounts.api';
import { transactionsQueryKey } from '../api/transactions.api';
import { fetchSummary, summaryQueryKey } from '../api/summary.api';
import { errorCode, errorMessage } from '../api/http';
import { Account, AccountType, OpeningBalanceTransaction } from '../types/account.types';
import { formatSatang, formatSignedSatang } from '../utils/money';
import { formatCalendarDate, monthRange } from '../utils/date';
import { colors, font, radius, space } from '../styles/theme';

/** f-03 §2.2: these three account groups, plus the F-08 current-month totals widget below. */
const SECTIONS: ReadonlyArray<{
  key: string;
  type: AccountType;
  title: string;
  caption: string;
  empty: string;
  icon: string;
  tint: { fg: string };
}> = [
  {
    key: 'cash',
    icon: 'account_balance_wallet',
    tint: { fg: '#2E4A67' },
    type: 'CASH',
    title: 'Cash',
    caption: 'Wallets and bank accounts',
    empty: 'No cash accounts yet.',
  },
  {
    key: 'debts',
    icon: 'credit_card',
    tint: { fg: '#7A3E12' },
    type: 'LOAN_TAKEN',
    title: 'Debts',
    caption: 'Credit cards and money borrowed',
    empty: 'No debts. Nothing is owed on a card or loan.',
  },
  {
    key: 'owed',
    icon: 'handshake',
    tint: { fg: '#1F5C42' },
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
  borderRadius: radius.xl,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  // min() keeps a single column inside a 360 px viewport.
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: space[6],
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space[3],
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  color: colors.textPrimary,
  margin: 0,
  lineHeight: 1.25,
};

const cardCaptionStyle: React.CSSProperties = {
  fontSize: font.size.xs,
  color: colors.textMuted,
  margin: 0,
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

/** A rounded square holding one icon, tinted per meaning (decoration; the text carries the meaning). */
const IconTile: React.FC<{ name: string; fg: string; size?: number }> = ({ name, fg, size = 1.75 }) => (
  <span style={{ display: 'inline-flex', flexShrink: 0, color: fg }}>
    <Icon name={name} size={size} />
  </span>
);

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
    <section data-testid={`dashboard-section-${section.key}`} aria-labelledby={headingId} className="pt-card" style={cardStyle}>
      <div className="pt-section-head" style={cardHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3], minWidth: 0 }}>
          <span className="pt-hide-on-mobile" style={{ display: 'inline-flex' }}>
            <IconTile name={section.icon} fg={section.tint.fg} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 id={headingId} style={cardTitleStyle}>
              {section.title}
            </h3>
            <p className="pt-hide-on-mobile" style={cardCaptionStyle}>{section.caption}</p>
          </div>
        </div>
        {accounts.length > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Amount satang={total} size={font.size.xl} testId={`dashboard-section-${section.key}-total`} />
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <div style={{ padding: space[5], flex: 1, display: 'flex' }}>
          <p
            data-testid={`dashboard-section-${section.key}-empty`}
            style={{
              flex: 1,
              margin: 0,
              padding: space[4],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: font.size.sm,
              color: colors.textMuted,
              border: `1px dashed ${colors.parchment}`,
              borderRadius: radius.md,
            }}
          >
            {section.empty}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {accounts.map((account, index) => (
            <li
              key={account.id}
              data-testid={`account-row-${account.name}`}
              className="pt-section-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space[3],
                borderTop: index === 0 ? 'none' : `1px solid ${colors.border}`,
              }}
            >
              <span style={{ flex: '1 1 0', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: font.size.base, fontWeight: font.weight.medium, color: colors.textPrimary }}>
                  {account.name}
                </span>
                {/* The action shares the subtype line so the card height stays stable (NFR-08). */}
                <span style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap', marginTop: '0.125rem' }}>
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
                      className="pt-pill-btn"
                      data-testid={`set-opening-balance-${account.name}`}
                      aria-label={`Set opening balance for ${account.name}`}
                      onClick={() => onSetOpeningBalance(account)}
                    >
                      <Icon name="add" size={0.875} />
                      Set opening balance
                    </button>
                  )}
                </span>
              </span>
              <span style={{ flexShrink: 0 }}>
                <Amount satang={account.balance} size={font.size.lg} testId={`account-balance-${account.name}`} />
              </span>
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
      <div key={section.key} className="pt-card" style={{ ...cardStyle, padding: space[5], gap: space[3] }}>
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
  const data = summaryQuery.data;

  const stats = data
    ? [
        {
          key: 'income',
          label: 'Income',
          icon: 'trending_up',
          fg: SUMMARY_INCOME_COLOR,
          value: formatSignedSatang(data.income),
          color: SUMMARY_INCOME_COLOR,
        },
        {
          key: 'expense',
          label: 'Expenses',
          icon: 'trending_down',
          fg: SUMMARY_EXPENSE_COLOR,
          value: formatSatang(data.expense),
          color: SUMMARY_EXPENSE_COLOR,
        },
        {
          key: 'net',
          label: 'Net',
          icon: 'savings',
          fg: data.net < 0 ? SUMMARY_NEGATIVE_COLOR : SUMMARY_INCOME_COLOR,
          value: formatSignedSatang(data.net),
          color: data.net < 0 ? SUMMARY_NEGATIVE_COLOR : SUMMARY_INCOME_COLOR,
        },
      ]
    : [];

  return (
    <section
      data-testid="dashboard-summary"
      aria-labelledby="dashboard-summary-title"
      className="pt-card"
      style={{ ...cardStyle, marginTop: space[6] }}
    >
      <div className="pt-section-head" style={{ ...cardHeaderStyle, flexWrap: 'wrap' }}>
        <div>
          <h3 id="dashboard-summary-title" style={cardTitleStyle}>
            This month
          </h3>
          <p style={cardCaptionStyle}>
            {formatCalendarDate(range.from)} – {formatCalendarDate(range.to)}
          </p>
        </div>
        <Link
          to="/summary"
          className="pt-icon-link"
          data-testid="dashboard-summary-link"
          style={{ color: colors.cobalt, fontSize: font.size.sm, fontWeight: font.weight.semibold, display: 'inline-flex', alignItems: 'center', gap: space[1] }}
        >
          <span>View summary</span>
          <Icon name="arrow_forward" size={1.125} />
        </Link>
      </div>

      {summaryQuery.isPending ? (
        <div
          data-testid="dashboard-summary-skeleton"
          role="status"
          aria-label="Loading summary"
          className="pt-stat-grid"
        >
          {[0, 1, 2].map((index) => (
            <div key={index} className="pt-stat">
              <span style={{ ...skeletonBar, width: '45%' }} />
              <span style={{ ...skeletonBar, width: '70%', height: '1.4rem', marginTop: space[2] }} />
            </div>
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <div style={{ padding: space[5] }}>
          <ErrorBanner
            message={errorMessage(summaryQuery.error, "Unable to load this month's summary. Please try again.")}
            onRetry={() => void summaryQuery.refetch()}
          />
        </div>
      ) : data ? (
        <dl className="pt-stat-grid" style={{ margin: 0 }}>
          {stats.map((stat) => (
            <div key={stat.key} className="pt-stat">
              <dt style={{ display: 'flex', alignItems: 'center', gap: space[2], fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.textSecondary }}>
                <IconTile name={stat.icon} fg={stat.fg} size={1.5} />
                {stat.label}
              </dt>
              <dd
                data-testid={`dashboard-summary-${stat.key}`}
                style={{
                  margin: `${space[2]} 0 0`,
                  fontSize: font.size['2xl'],
                  fontWeight: font.weight.bold,
                  fontVariantNumeric: 'tabular-nums',
                  color: stat.color,
                }}
              >
                {stat.value}
              </dd>
            </div>
          ))}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: space[3], flexWrap: 'wrap', marginBottom: space[6] }}>
          <div>
            <h2 style={{ fontSize: font.size['2xl'], fontWeight: font.weight.semibold, color: colors.textPrimary, marginBottom: space[2] }}>
              Welcome back, {user?.displayName}
            </h2>
            <p className="pt-hide-on-mobile" style={{ color: colors.textMuted, margin: 0 }}>
              Overview of your financial accounts and balances.
            </p>
          </div>
          {/* f-05 §2.2 entry point, in the page header like the History page. */}
          <Link
            to="/transactions/new"
            data-testid="record-payment-link"
            className="pt-btn-primary"
          >
            <Icon name="add" size={1.125} />
            Record transaction
          </Link>
        </div>

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
