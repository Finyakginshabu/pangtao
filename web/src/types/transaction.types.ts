/** f-05/f-06 §2.1 request: amounts are integer satang, `txnDate` is `YYYY-MM-DD`. */
export interface CreateTransactionInput {
  kind: 'PAYMENT' | 'RECEIPT';
  accountId: string;
  txnDate: string;
  totalAmount: number;
  memo?: string;
  lines: Array<{ targetAccountId: string; amount: number; note?: string }>;
}

export interface AllocationLine {
  id: string;
  targetAccountId: string;
  /** Integer satang. */
  amount: number;
  note: string | null;
}

/** f-05/f-06 §2.1 response. */
export interface Transaction {
  id: string;
  kind: 'PAYMENT' | 'RECEIPT';
  accountId: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
  memo: string | null;
  lines: AllocationLine[];
}

export interface TransactionResponse {
  transaction: Transaction;
}

export type TransactionKind = 'PAYMENT' | 'RECEIPT' | 'OPENING_BALANCE';

/** f-07 §2.1 line: amounts are integer satang. */
export interface HistoryLine {
  id: string;
  targetAccountId: string;
  targetAccountName: string;
  amount: number;
  note: string | null;
}

/** f-07 §2.1 history item and detail. */
export interface HistoryTransaction {
  id: string;
  kind: TransactionKind;
  accountId: string;
  accountName: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
  memo: string | null;
  lines: HistoryLine[];
}

export interface TransactionHistoryPage {
  items: HistoryTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionDetailResponse {
  transaction: HistoryTransaction;
}
