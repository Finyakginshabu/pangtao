import { handleResponse } from './http';
import { Account, AccountsResponse } from '../types/account.types';

export const accountsQueryKey = ['accounts'] as const;

/** GET /api/v1/accounts: the caller's accounts with derived balances, in display order. */
export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/v1/accounts', { credentials: 'include' });
  const data = await handleResponse<AccountsResponse>(res);
  return data.items;
}
