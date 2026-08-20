import type { RankableCard } from "@/lib/engine/calculator";

export const seedCards: RankableCard[] = [
  {
    id: "chase-sapphire-preferred",
    institutionName: "Chase",
    cardName: "Sapphire Preferred",
    lastFourDigits: "4242",
    creditLimit: 15000,
    currentBalance: 2340.5,
    apr: 21.49,
    statementClosingDay: 28,
    paymentDueDay: 21,
    gracePeriodDays: 25,
    cashbackCategory: {
      dining: 0.03,
      travel: 0.05,
      groceries: 0.01,
      default: 0.01,
    },
  },
  {
    id: "amex-cash-magnet",
    institutionName: "Amex",
    cardName: "Cash Magnet",
    lastFourDigits: "1008",
    creditLimit: 8000,
    currentBalance: 6120,
    apr: 19.99,
    statementClosingDay: 3,
    paymentDueDay: 27,
    gracePeriodDays: 24,
    cashbackCategory: {
      groceries: 0.03,
      gas: 0.03,
      dining: 0.015,
      default: 0.015,
    },
  },
  {
    id: "rbc-avion",
    institutionName: "RBC",
    cardName: "Avion Visa Infinite",
    lastFourDigits: "8891",
    creditLimit: 12000,
    currentBalance: 450,
    apr: 20.99,
    statementClosingDay: 16,
    paymentDueDay: 10,
    gracePeriodDays: 25,
    cashbackCategory: {
      travel: 0.02,
      dining: 0.02,
      groceries: 0.01,
      default: 0.01,
    },
  },
];

export const purchaseCategories = [
  { value: "groceries", label: "Groceries" },
  { value: "dining", label: "Dining" },
  { value: "travel", label: "Travel" },
  { value: "gas", label: "Gas" },
  { value: "rent", label: "Rent" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
] as const;
