import { handleResponse } from './http';
import { CreatePaymentInput, Transaction, TransactionResponse } from '../types/transaction.types';

/** POST /api/v1/transactions — User only (f-05 §2.1). */
export async function createTransaction(input: CreatePaymentInput): Promise<Transaction> {
  const res = await fetch('/api/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const data = await handleResponse<TransactionResponse>(res);
  return data.transaction;
}
