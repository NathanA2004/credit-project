import type { PlaidLiabilitySnapshot } from "./types";

/**
 * Offline stand-in for Plaid `/liabilities/get` when PLAID_* keys are missing.
 * Kept in sync with the three seeded demo cards.
 */
export const mockPlaidLiabilities: PlaidLiabilitySnapshot[] = [
  {
    plaidAccountId: "plaid-sandbox-chase-sapphire",
    institutionName: "Chase",
    cardName: "Sapphire Preferred",
    lastFourDigits: "4242",
    nextPaymentDueDate: "2026-08-21",
    lastStatementBalance: 2340.5,
    minimumPaymentAmount: 47.0,
    currentBalance: 2340.5,
    creditLimit: 15000,
    apr: 21.49,
    lastStatementIssueDate: "2026-07-28",
  },
  {
    plaidAccountId: "plaid-sandbox-amex-cash-magnet",
    institutionName: "Amex",
    cardName: "Cash Magnet",
    lastFourDigits: "1008",
    nextPaymentDueDate: "2026-08-27",
    lastStatementBalance: 6120.0,
    minimumPaymentAmount: 125.0,
    currentBalance: 6120.0,
    creditLimit: 8000,
    apr: 19.99,
    lastStatementIssueDate: "2026-08-03",
  },
  {
    plaidAccountId: "plaid-sandbox-rbc-avion",
    institutionName: "RBC",
    cardName: "Avion Visa Infinite",
    lastFourDigits: "8891",
    nextPaymentDueDate: "2026-09-10",
    lastStatementBalance: 450.0,
    minimumPaymentAmount: 25.0,
    currentBalance: 450.0,
    creditLimit: 12000,
    apr: 20.99,
    lastStatementIssueDate: "2026-08-16",
  },
];
