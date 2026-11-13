import { handleResponse } from './http';
import { CreateTransactionInput, Transaction, TransactionResponse } from '../types/transaction.types';

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
