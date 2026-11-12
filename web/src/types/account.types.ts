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
