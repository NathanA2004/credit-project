export type PlaidLiabilitySnapshot = {
  plaidAccountId: string;
  institutionName: string;
  cardName: string;
  lastFourDigits: string;
  nextPaymentDueDate: string | null;
  lastStatementBalance: number | null;
  minimumPaymentAmount: number | null;
  currentBalance: number | null;
  creditLimit: number | null;
  apr: number | null;
  lastStatementIssueDate: string | null;
};
