import React, { useEffect, useState } from 'react';
import { createOpeningBalance } from '../api/accounts.api';
import { errorMessage } from '../api/http';
import { Account, OpeningBalanceTransaction } from '../types/account.types';
import { parseThbToSatang } from '../utils/money';
import { bangkokToday, isFutureDate } from '../utils/date';
import { colors, font, radius, shadow, space, zIndex } from '../styles/theme';

interface OpeningBalanceDialogProps {
  account: Account;
  onClose: () => void;
  onSaved: (transaction: OpeningBalanceTransaction) => void;
}

/** BR-04: 100,000,000.00 THB in integer satang. */
const MAX_AMOUNT_SATANG = 10_000_000_000;

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: space[2],
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: colors.textSecondary,
};

/**
 * f-04 §2.2: amount in THB (converted to satang) and a date no later than today in
 * Bangkok. Inline validation runs before any request; the server stays authoritative.
 */
export const OpeningBalanceDialog: React.FC<OpeningBalanceDialogProps> = ({
  account,
  onClose,
  onSaved,
}) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(bangkokToday());
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const today = bangkokToday();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const close = () => {
    if (!isSaving) onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    setServerError(null);

    const satang = parseThbToSatang(amount);
    if (satang === null) {
      setFieldError('Enter a valid amount in THB with at most 2 decimal places.');
      return;
    }
    if (satang > MAX_AMOUNT_SATANG) {
      setFieldError('Amount must not exceed 100,000,000.00 THB.');
      return;
    }
    if (!date) {
      setFieldError('Choose a date.');
      return;
    }
    if (isFutureDate(date)) {
      setFieldError('Date cannot be later than today.');
      return;
    }

    setIsSaving(true);
    try {
      const transaction = await createOpeningBalance(account.id, { amount: satang, date });
      onSaved(transaction);
    } catch (error) {
      setServerError(errorMessage(error, 'Unable to save the opening balance. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        backgroundColor: 'rgba(15, 30, 51, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[4],
      }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-balance-title"
        data-testid="opening-balance-dialog"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          backgroundColor: colors.surfaceSolid,
          borderRadius: radius.xl,
          boxShadow: shadow.card,
          padding: space[6],
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="opening-balance-title"
          style={{
            marginTop: 0,
            marginBottom: space[2],
            fontSize: font.size.lg,
            color: colors.textPrimary,
          }}
        >
          Set opening balance — {account.name}
        </h3>
        <p style={{ marginTop: 0, marginBottom: space[5], color: colors.textSecondary, fontSize: font.size.sm }}>
          Record what this account already held before you started logging transactions. It is
          not counted as income or expense.
        </p>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div style={{ marginBottom: space[4] }}>
            <label htmlFor="opening-amount" style={labelStyle}>
              Amount (THB)
            </label>
            <input
              id="opening-amount"
              data-testid="opening-amount"
              className={`pt-glass-input${fieldError ? ' pt-glass-input--error' : ''}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? 'opening-balance-error' : undefined}
            />
          </div>

          <div style={{ marginBottom: space[4] }}>
            <label htmlFor="opening-date" style={labelStyle}>
              Date
            </label>
            <input
              id="opening-date"
              data-testid="opening-date"
              className="pt-glass-input"
              type="date"
              max={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          {fieldError && (
            <div
              id="opening-balance-error"
              data-testid="opening-balance-error"
              role="alert"
              className="pt-field-error"
              style={{ marginBottom: space[4] }}
            >
              {fieldError}
            </div>
          )}

          {serverError && (
            <div role="alert" className="pt-error-banner" style={{ marginBottom: space[4] }}>
              {serverError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
            <button
              type="button"
              onClick={close}
              disabled={isSaving}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.porcelain,
                color: colors.textPrimary,
                fontWeight: font.weight.medium,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="opening-balance-save"
              disabled={isSaving}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: radius.md,
                border: 'none',
                backgroundColor: colors.cobalt,
                color: colors.porcelain,
                fontWeight: font.weight.semibold,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving…' : 'Save opening balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
