import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { accountsQueryKey, fetchAccounts } from '../api/accounts.api';
import { createTransaction, transactionsQueryKey } from '../api/transactions.api';
import { summaryQueryKey } from '../api/summary.api';
import { errorCode, errorMessage } from '../api/http';
import { Account, AccountType } from '../types/account.types';
import { ApiErrorResponse } from '../types/auth.types';
import { CreateTransactionInput } from '../types/transaction.types';
import { formatSatang, parseThbToSatang } from '../utils/money';
import { bangkokToday, isFutureDate } from '../utils/date';
import { colors, font, radius, space } from '../styles/theme';

/** BR-04: 100,000,000.00 THB in integer satang. */
const MAX_AMOUNT_SATANG = 10_000_000_000;

type Mode = 'PAYMENT' | 'RECEIPT';

/**
 * BR-06 / BR-16, Sprint 1 matrices, mirrored from the server so the form only offers
 * valid choices. The server stays authoritative.
 */
const PAYMENT_TARGETS: Partial<Record<AccountType, AccountType[]>> = {
  CASH: ['EXPENSE', 'LOAN_TAKEN'],
  LOAN_TAKEN: ['EXPENSE'],
};

const RECEIPT_TARGETS: Partial<Record<AccountType, AccountType[]>> = {
  CASH: ['INCOME'],
};

interface ModeConfig {
  sourceTypes: AccountType[];
  targets: Partial<Record<AccountType, AccountType[]>>;
  sourceGroups: Array<{ type: AccountType; label: string }>;
  sourceLabel: string;
  detailsLabel: string;
  submitLabel: string;
  errorFallback: string;
  emptyMessage: string;
  targetHint: string;
}

const MODE_CONFIG: Record<Mode, ModeConfig> = {
  PAYMENT: {
    sourceTypes: ['CASH', 'LOAN_TAKEN'],
    targets: PAYMENT_TARGETS,
    sourceGroups: [
      { type: 'CASH', label: 'Cash' },
      { type: 'LOAN_TAKEN', label: 'Credit cards and loans (charge)' },
    ],
    sourceLabel: 'Paid from',
    detailsLabel: 'Payment details',
    submitLabel: 'Save payment',
    errorFallback: 'Unable to save the payment. Please try again.',
    emptyMessage: 'You have no active Cash or Credit Card account to pay from.',
    targetHint: 'Choose the account you paid from to see where the money can go.',
  },
  RECEIPT: {
    sourceTypes: ['CASH'],
    targets: RECEIPT_TARGETS,
    sourceGroups: [{ type: 'CASH', label: 'Cash' }],
    sourceLabel: 'Received into',
    detailsLabel: 'Receipt details',
    submitLabel: 'Save receipt',
    errorFallback: 'Unable to save the receipt. Please try again.',
    emptyMessage: 'You have no active Cash account to receive money into.',
    targetHint: 'Choose the Cash account that received the money to see where it can be allocated.',
  },
};

const TYPE_GROUP_LABEL: Record<AccountType, string> = {
  CASH: 'Cash',
  LOAN_TAKEN: 'Debts (repayment)',
  LOAN_GIVEN: 'Owed to me',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

interface LineDraft {
  key: number;
  targetAccountId: string;
  amount: string;
  note: string;
}

type FieldErrors = Record<string, string>;

/** Stable React keys for line rows, so removing a row never reuses another row's inputs. */
let lineKeySeq = 0;
const newLine = (): LineDraft => ({ key: ++lineKeySeq, targetAccountId: '', amount: '', note: '' });

/** A THB input as positive satang within BR-04, or null. */
function positiveSatang(input: string): number | null {
  const satang = parseThbToSatang(input);
  return satang !== null && satang > 0 && satang <= MAX_AMOUNT_SATANG ? satang : null;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: space[2],
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textSecondary,
};

const cardStyle: React.CSSProperties = {
  borderRadius: radius.xl,
  padding: space[5],
  minWidth: 0,
};

const fieldGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: space[4],
};

const secondaryButton: React.CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.porcelain,
  color: colors.textPrimary,
  fontWeight: font.weight.medium,
  cursor: 'pointer',
};

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <span id={id} data-testid={id} role="alert" className="pt-field-error" style={{ marginTop: space[1] }}>
      {message}
    </span>
  ) : null;

const FormSkeleton: React.FC = () => (
  <div data-testid="transaction-form-skeleton" role="status" aria-live="polite" aria-label="Loading accounts" className="pt-card" style={cardStyle}>
    {[60, 85, 70].map((width) => (
      <span
        key={width}
        style={{
          display: 'block',
          height: '0.85rem',
          width: `${width}%`,
          borderRadius: radius.full,
          backgroundColor: '#E8E2D6',
          marginBottom: space[3],
        }}
      />
    ))}
  </div>
);

/** f-05 §2.2 / f-06 §2.2: the Payment and Receive tabs of `/transactions/new`. */
export const NewTransactionPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refetchUser } = useAuth();
  const accountsQuery = useQuery({ queryKey: accountsQueryKey, queryFn: fetchAccounts });

  const [mode, setMode] = useState<Mode>('PAYMENT');
  const [sourceId, setSourceId] = useState('');
  const [txnDate, setTxnDate] = useState(bangkokToday());
  const [memo, setMemo] = useState('');
  const [total, setTotal] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const today = bangkokToday();
  const config = MODE_CONFIG[mode];
  const testIdPrefix = mode === 'PAYMENT' ? 'payment' : 'receipt';

  // An expired session re-checks the user, and the route guard then sends them to /login.
  const unauthenticated = errorCode(accountsQuery.error) === 'UNAUTHENTICATED';
  useEffect(() => {
    if (unauthenticated) void refetchUser();
  }, [unauthenticated, refetchUser]);

  const mutation = useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      await queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
      await queryClient.invalidateQueries({ queryKey: summaryQueryKey });
      navigate('/');
    },
    onError: async (error) => {
      if (errorCode(error) === 'UNAUTHENTICATED') {
        await refetchUser();
        return;
      }
      // Map server details[].field (e.g. `lines.1.amount`) back onto the inputs.
      const details = (error as Partial<ApiErrorResponse>)?.error?.details ?? [];
      const mapped: FieldErrors = {};
      for (const detail of details) {
        if (detail.field) mapped[detail.field] = detail.issue;
      }
      setFieldErrors(mapped);
      setServerError(errorMessage(error, config.errorFallback));
    },
  });

  const accounts: Account[] = accountsQuery.data ?? [];
  const sources = accounts.filter((a) => !a.isArchived && config.sourceTypes.includes(a.type));
  const source = sources.find((a) => a.id === sourceId);
  const allowedTypes = source ? config.targets[source.type] ?? [] : [];
  const targets = accounts.filter((a) => !a.isArchived && a.id !== sourceId && allowedTypes.includes(a.type));

  const totalSatang = positiveSatang(total);
  const lineSatang = lines.map((line) => positiveSatang(line.amount));
  // Integer satang arithmetic only (NFR-03); every value is a safe integer.
  const allocated = lineSatang.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const remaining = (totalSatang ?? 0) - allocated;

  const linesComplete = lines.every(
    (line, i) => lineSatang[i] !== null && targets.some((t) => t.id === line.targetAccountId)
  );
  const canSubmit =
    !!source && !!txnDate && totalSatang !== null && linesComplete && remaining === 0 && !mutation.isPending;

  const clearErrors = () => {
    if (Object.keys(fieldErrors).length > 0) setFieldErrors({});
    if (serverError) setServerError(null);
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    // The two forms have different sources and targets, so start the form clean.
    setSourceId('');
    setTotal('');
    setMemo('');
    setLines([newLine()]);
    setFieldErrors({});
    setServerError(null);
  };

  const updateLine = (key: number, patch: Partial<LineDraft>) => {
    clearErrors();
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const changeSource = (id: string) => {
    clearErrors();
    setSourceId(id);
    // Drop targets the new source cannot use (e.g. a card cannot repay itself).
    const nextSource = sources.find((a) => a.id === id);
    const nextAllowed = nextSource ? config.targets[nextSource.type] ?? [] : [];
    setLines((current) =>
      current.map((line) => {
        const target = accounts.find((a) => a.id === line.targetAccountId);
        const keep = target && target.id !== id && nextAllowed.includes(target.type);
        return keep ? line : { ...line, targetAccountId: '' };
      })
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !source || totalSatang === null) return;
    if (isFutureDate(txnDate)) {
      setFieldErrors({ txnDate: 'Date cannot be later than today.' });
      return;
    }
    setFieldErrors({});
    setServerError(null);

    const trimmedMemo = memo.trim();
    mutation.mutate({
      kind: mode,
      accountId: source.id,
      txnDate,
      totalAmount: totalSatang,
      ...(trimmedMemo ? { memo: trimmedMemo } : {}),
      lines: lines.map((line, i) => {
        const note = line.note.trim();
        return { targetAccountId: line.targetAccountId, amount: lineSatang[i]!, ...(note ? { note } : {}) };
      }),
    });
  };

  const inputClass = (field: string) => `pt-glass-input${fieldErrors[field] ? ' pt-glass-input--error' : ''}`;

  const targetGroups = allowedTypes
    .map((type) => ({ type, items: targets.filter((t) => t.type === type) }))
    .filter((group) => group.items.length > 0);

  const remainingLabel =
    remaining === 0 ? 'Fully allocated' : remaining > 0 ? 'Still to allocate' : 'Over-allocated';

  const tabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { ...secondaryButton, backgroundColor: colors.cobalt, color: colors.porcelain, border: 'none' }
      : secondaryButton;

  return (
    <AppShell>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <p style={{ margin: 0, marginBottom: space[2], fontSize: font.size.sm }}>
          <Link
            to="/"
            className="pt-icon-link"
            style={{ color: colors.textSecondary, display: 'inline-flex', alignItems: 'center', gap: space[1] }}
          >
            <Icon name="arrow_back" size={1.125} />
            <span>Back to dashboard</span>
          </Link>
        </p>
        <h2 style={{ fontSize: font.size['2xl'], fontWeight: font.weight.semibold, color: colors.textPrimary, marginBottom: space[4] }}>
          New transaction
        </h2>

        <div role="tablist" aria-label="Transaction type" style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], marginBottom: space[5] }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'PAYMENT'}
            data-testid="tab-payment"
            onClick={() => changeMode('PAYMENT')}
            style={tabStyle(mode === 'PAYMENT')}
          >
            Payment
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'RECEIPT'}
            data-testid="tab-receipt"
            onClick={() => changeMode('RECEIPT')}
            style={tabStyle(mode === 'RECEIPT')}
          >
            Receive
          </button>
        </div>

        {accountsQuery.isError && (
          <ErrorBanner
            message={errorMessage(accountsQuery.error, 'Unable to load your accounts. Please try again.')}
            onRetry={() => void accountsQuery.refetch()}
          />
        )}

        {accountsQuery.isPending || (accountsQuery.isError && accountsQuery.isFetching) ? (
          <FormSkeleton />
        ) : accountsQuery.isSuccess && sources.length === 0 ? (
          <div data-testid="transaction-form-empty" className="pt-card" style={cardStyle}>
            <p style={{ margin: 0, color: colors.textSecondary }}>
              {config.emptyMessage} <Link to="/">Return to the dashboard</Link>.
            </p>
          </div>
        ) : accountsQuery.isSuccess ? (
          <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
            <section className="pt-card" style={cardStyle} aria-label={config.detailsLabel}>
              <div style={fieldGrid}>
                <div>
                  <label htmlFor={`${testIdPrefix}-source`} style={labelStyle}>
                    {config.sourceLabel}
                  </label>
                  <select
                    id={`${testIdPrefix}-source`}
                    data-testid={`${testIdPrefix}-source`}
                    className={inputClass('accountId')}
                    value={sourceId}
                    onChange={(event) => changeSource(event.target.value)}
                  >
                    <option value="">Choose an account</option>
                    {config.sourceGroups.map((group) => (
                      <optgroup key={group.type} label={group.label}>
                        {sources
                          .filter((a) => a.type === group.type)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <FieldError id={`${testIdPrefix}-source-error`} message={fieldErrors.accountId} />
                </div>

                <div>
                  <label htmlFor={`${testIdPrefix}-date`} style={labelStyle}>
                    Date
                  </label>
                  <input
                    id={`${testIdPrefix}-date`}
                    data-testid={`${testIdPrefix}-date`}
                    className={inputClass('txnDate')}
                    type="date"
                    max={today}
                    value={txnDate}
                    onChange={(event) => {
                      clearErrors();
                      setTxnDate(event.target.value);
                    }}
                  />
                  <FieldError id={`${testIdPrefix}-date-error`} message={fieldErrors.txnDate} />
                </div>

                <div>
                  <label htmlFor={`${testIdPrefix}-total`} style={labelStyle}>
                    Total amount (THB)
                  </label>
                  <input
                    id={`${testIdPrefix}-total`}
                    data-testid={`${testIdPrefix}-total`}
                    className={inputClass('totalAmount')}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={total}
                    onChange={(event) => {
                      clearErrors();
                      setTotal(event.target.value);
                    }}
                    aria-invalid={total !== '' && totalSatang === null}
                  />
                  <FieldError
                    id={`${testIdPrefix}-total-error`}
                    message={
                      fieldErrors.totalAmount ??
                      (total !== '' && totalSatang === null
                        ? 'Enter an amount from 0.01 to 100,000,000.00 THB.'
                        : undefined)
                    }
                  />
                </div>

                <div>
                  <label htmlFor={`${testIdPrefix}-memo`} style={labelStyle}>
                    Memo (optional)
                  </label>
                  <input
                    id={`${testIdPrefix}-memo`}
                    data-testid={`${testIdPrefix}-memo`}
                    className={inputClass('memo')}
                    type="text"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="pt-card" style={cardStyle} aria-labelledby="lines-heading">
              <h3 id="lines-heading" style={{ marginTop: 0, marginBottom: space[4], fontSize: font.size.lg, color: colors.textPrimary }}>
                Allocation lines
              </h3>
              {!source && (
                <p style={{ marginTop: 0, color: colors.textMuted, fontSize: font.size.sm }}>{config.targetHint}</p>
              )}

              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: space[4] }}>
                {lines.map((line, i) => {
                  const amountInvalid = line.amount !== '' && lineSatang[i] === null;
                  return (
                    <li
                      key={line.key}
                      data-testid={`line-${i}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
                        gap: space[3],
                        alignItems: 'start',
                        paddingBottom: space[4],
                        borderBottom: i < lines.length - 1 ? `1px solid ${colors.border}` : 'none',
                      }}
                    >
                      <div>
                        <label htmlFor={`line-target-${i}`} style={labelStyle}>
                          Line {i + 1} account
                        </label>
                        <select
                          id={`line-target-${i}`}
                          data-testid={`line-target-${i}`}
                          className={inputClass(`lines.${i}.targetAccountId`)}
                          value={line.targetAccountId}
                          disabled={!source}
                          onChange={(event) => updateLine(line.key, { targetAccountId: event.target.value })}
                        >
                          <option value="">Choose an account</option>
                          {targetGroups.map((group) => (
                            <optgroup key={group.type} label={TYPE_GROUP_LABEL[group.type]}>
                              {group.items.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <FieldError id={`line-target-${i}-error`} message={fieldErrors[`lines.${i}.targetAccountId`]} />
                      </div>

                      <div>
                        <label htmlFor={`line-amount-${i}`} style={labelStyle}>
                          Amount (THB)
                        </label>
                        <input
                          id={`line-amount-${i}`}
                          data-testid={`line-amount-${i}`}
                          className={inputClass(`lines.${i}.amount`)}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0.00"
                          value={line.amount}
                          onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                          aria-invalid={amountInvalid}
                        />
                        <FieldError
                          id={`line-amount-${i}-error`}
                          message={
                            fieldErrors[`lines.${i}.amount`] ??
                            (amountInvalid ? 'Enter an amount from 0.01 to 100,000,000.00 THB.' : undefined)
                          }
                        />
                      </div>

                      <div>
                        <label htmlFor={`line-note-${i}`} style={labelStyle}>
                          Note (optional)
                        </label>
                        <input
                          id={`line-note-${i}`}
                          data-testid={`line-note-${i}`}
                          className="pt-glass-input"
                          type="text"
                          value={line.note}
                          onChange={(event) => updateLine(line.key, { note: event.target.value })}
                        />
                      </div>

                      {lines.length > 1 && (
                        <div style={{ alignSelf: 'end' }}>
                          <button
                            type="button"
                            data-testid={`remove-line-${i}`}
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() => {
                              clearErrors();
                              setLines((current) => current.filter((l) => l.key !== line.key));
                            }}
                            style={{ ...secondaryButton, display: 'inline-flex', alignItems: 'center', gap: space[1] }}
                          >
                            <Icon name="delete" size={1.125} />
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              <button
                type="button"
                data-testid="add-line"
                onClick={() => {
                  clearErrors();
                  setLines((current) => [...current, newLine()]);
                }}
                style={{ ...secondaryButton, marginTop: space[4], display: 'inline-flex', alignItems: 'center', gap: space[1] }}
              >
                <Icon name="add" size={1.125} />
                Add line
              </button>
              <FieldError id="lines-error" message={fieldErrors.lines} />
            </section>

            <section
              aria-label="Allocation summary"
              aria-live="polite"
              data-testid="allocation-summary"
              className="pt-card" style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: space[3] }}
            >
              {[
                { label: 'Total', value: totalSatang ?? 0, testId: 'summary-total' },
                { label: 'Allocated', value: allocated, testId: 'summary-allocated' },
                { label: 'Remaining to allocate', value: remaining, testId: 'summary-remaining' },
              ].map((item) => (
                <div key={item.testId}>
                  <div style={{ fontSize: font.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </div>
                  <div
                    data-testid={item.testId}
                    style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatSatang(item.value)}
                  </div>
                </div>
              ))}
              <div data-testid="summary-status" style={{ alignSelf: 'center', fontSize: font.size.sm, color: remaining === 0 ? colors.textSecondary : '#8B2525', fontWeight: font.weight.medium }}>
                {remainingLabel}
              </div>
            </section>

            {serverError && (
              <div role="alert" data-testid={`${testIdPrefix}-error`} className="pt-error-banner" style={{ marginBottom: 0 }}>
                {serverError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2], flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate('/')} disabled={mutation.isPending} style={secondaryButton}>
                Cancel
              </button>
              <button
                type="submit"
                data-testid={`${testIdPrefix}-submit`}
                disabled={!canSubmit}
                className="pt-btn-primary"
                // Same width for "Save payment" and "Save receipt" (and "Saving…"), so the button never resizes.
                style={{ minWidth: '9.5rem' }}
              >
                {mutation.isPending ? 'Saving…' : config.submitLabel}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
};
