/** f-08 §2.1: aggregated totals for a date range, all integer satang. */
export interface Summary {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
  income: number;
  expense: number;
  /** Exactly income − expense. */
  net: number;
}
