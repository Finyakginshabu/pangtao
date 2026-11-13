export type AccountType = 'CASH' | 'LOAN_TAKEN' | 'LOAN_GIVEN' | 'INCOME' | 'EXPENSE';
export type AccountSubtype = 'WALLET' | 'BANK' | 'CREDIT_CARD' | 'OTHER';

export interface OpeningBalance {
  transactionId: string;
  /** Integer satang. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  isArchived: boolean;
  /** Integer satang, derived by the server; may be negative (D-02). */
  balance: number;
  openingBalance: OpeningBalance | null;
}

export interface AccountsResponse {
  items: Account[];
}

/** f-04 §2.1: the created opening-balance transaction. */
export interface OpeningBalanceTransaction {
  id: string;
  kind: 'OPENING_BALANCE';
  accountId: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
}

export interface OpeningBalanceResponse {
  transaction: OpeningBalanceTransaction;
}

export interface CreateOpeningBalanceInput {
  /** Integer satang. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}
