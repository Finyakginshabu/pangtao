import { handleResponse } from './http';
import { Summary } from '../types/summary.types';

/** Prefix of every summary query key, so a new transaction can invalidate them all. */
export const summaryQueryKey = ['summary'] as const;

/** GET /api/v1/summary/income-expense?from&to — integer satang (f-08 §2.1). */
export async function fetchSummary(from: string, to: string): Promise<Summary> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/v1/summary/income-expense?${params.toString()}`, {
    credentials: 'include',
  });
  return handleResponse<Summary>(res);
}
