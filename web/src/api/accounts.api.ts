import { handleResponse } from './http';
import {
  Account,
  AccountsResponse,
  CreateOpeningBalanceInput,
  OpeningBalanceResponse,
  OpeningBalanceTransaction,
} from '../types/account.types';

export const accountsQueryKey = ['accounts'] as const;

/** GET /api/v1/accounts: the caller's accounts with derived balances, in display order. */
export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/v1/accounts', { credentials: 'include' });
  const data = await handleResponse<AccountsResponse>(res);
  return data.items;
}

/** POST /api/v1/accounts/:id/opening-balance — User only (f-04 §2.1). */
export async function createOpeningBalance(
  accountId: string,
  input: CreateOpeningBalanceInput
): Promise<OpeningBalanceTransaction> {
  const res = await fetch(`/api/v1/accounts/${encodeURIComponent(accountId)}/opening-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const data = await handleResponse<OpeningBalanceResponse>(res);
  return data.transaction;
}
