import { handleResponse } from './http';
import {
  CreateTransactionInput,
  HistoryTransaction,
  Transaction,
  TransactionDetailResponse,
  TransactionHistoryPage,
  TransactionResponse,
} from '../types/transaction.types';

/** Prefix of every history query key, so a new transaction can invalidate them all. */
export const transactionsQueryKey = ['transactions'] as const;

/** POST /api/v1/transactions — User only (f-05/f-06 §2.1). */
export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const data = await handleResponse<TransactionResponse>(res);
  return data.transaction;
}

/** GET /api/v1/transactions?limit&offset — newest first (f-07 §2.1). */
export async function fetchTransactions(limit: number, offset: number): Promise<TransactionHistoryPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`/api/v1/transactions?${params.toString()}`, { credentials: 'include' });
  return handleResponse<TransactionHistoryPage>(res);
}

/** GET /api/v1/transactions/:id — one transaction with every line (f-07 §2.1, FR-25). */
export async function fetchTransaction(id: string): Promise<HistoryTransaction> {
  const res = await fetch(`/api/v1/transactions/${encodeURIComponent(id)}`, { credentials: 'include' });
  const data = await handleResponse<TransactionDetailResponse>(res);
  return data.transaction;
}
