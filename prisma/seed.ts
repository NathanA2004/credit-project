import { PrismaClient, AlertStatus } from "@prisma/client";

const prisma = new PrismaClient();

/** Offline mock fallback for Plaid `/liabilities/get` when PLAID_* keys are missing. */
export { mockPlaidLiabilities } from "../lib/plaid/mock-liabilities";

const mockUser = {
  email: "alex.rivera@example.com",
  name: "Alex Rivera",
};

const mockCards = [
  {
    institutionName: "Chase",
    cardName: "Sapphire Preferred",
    lastFourDigits: "4242",
    creditLimit: "15000.00",
    currentBalance: "2340.50",
    apr: "21.49",
    statementClosingDay: 28,
    paymentDueDay: 21,
    gracePeriodDays: 25,
    cashbackCategory: {
      dining: 0.03,
      travel: 0.05,
      groceries: 0.01,
      default: 0.01,
    },
    plaidAccountId: "plaid-sandbox-chase-sapphire",
    transactions: [
      {
        amount: "86.40",
        category: "dining",
        merchant: "The Ordinary Pub",
        transactionDate: new Date("2026-08-14T19:42:00.000Z"),
        isPaid: false,
      },
      {
        amount: "412.18",
        category: "travel",
        merchant: "United Airlines",
        transactionDate: new Date("2026-08-08T11:15:00.000Z"),
        isPaid: false,
      },
      {
        amount: "64.22",
        category: "groceries",
        merchant: "Whole Foods",
        transactionDate: new Date("2026-07-22T16:05:00.000Z"),
        isPaid: true,
      },
    ],
    paymentAlert: {
      dueDate: new Date("2026-08-21T23:59:59.000Z"),
      amountDue: "2340.50",
      isPaid: false,
      status: AlertStatus.URGENT,
    },
  },
  {
    institutionName: "Amex",
    cardName: "Cash Magnet",
    lastFourDigits: "1008",
    creditLimit: "8000.00",
    currentBalance: "6120.00",
    apr: "19.99",
    statementClosingDay: 3,
    paymentDueDay: 27,
    gracePeriodDays: 24,
    cashbackCategory: {
      groceries: 0.03,
      gas: 0.03,
      dining: 0.015,
      default: 0.015,
    },
    plaidAccountId: "plaid-sandbox-amex-cash-magnet",
    transactions: [
      {
        amount: "214.67",
        category: "groceries",
        merchant: "Trader Joe's",
        transactionDate: new Date("2026-08-16T14:20:00.000Z"),
        isPaid: false,
      },
      {
        amount: "58.90",
        category: "gas",
        merchant: "Shell",
        transactionDate: new Date("2026-08-11T08:03:00.000Z"),
        isPaid: false,
      },
      {
        amount: "1899.00",
        category: "shopping",
        merchant: "Best Buy",
        transactionDate: new Date("2026-08-02T17:44:00.000Z"),
        isPaid: false,
      },
    ],
    paymentAlert: {
      dueDate: new Date("2026-08-27T23:59:59.000Z"),
      amountDue: "6120.00",
      isPaid: false,
      status: AlertStatus.UPCOMING,
    },
  },
  {
    institutionName: "RBC",
    cardName: "Avion Visa Infinite",
    lastFourDigits: "8891",
    creditLimit: "12000.00",
    currentBalance: "450.00",
    apr: "20.99",
    statementClosingDay: 16,
    paymentDueDay: 10,
    gracePeriodDays: 25,
    cashbackCategory: {
      travel: 0.02,
      dining: 0.02,
      groceries: 0.01,
      default: 0.01,
    },
    plaidAccountId: "plaid-sandbox-rbc-avion",
    transactions: [
      {
        amount: "132.50",
        category: "travel",
        merchant: "Air Canada",
        transactionDate: new Date("2026-08-18T09:10:00.000Z"),
        isPaid: false,
      },
      {
        amount: "47.80",
        category: "dining",
        merchant: "Cactus Club Cafe",
        transactionDate: new Date("2026-08-09T20:31:00.000Z"),
        isPaid: false,
      },
      {
        amount: "980.00",
        category: "rent",
        merchant: "PadSplit Housing",
        transactionDate: new Date("2026-07-05T12:00:00.000Z"),
        isPaid: true,
      },
    ],
    paymentAlert: {
      dueDate: new Date("2026-09-10T23:59:59.000Z"),
      amountDue: "450.00",
      isPaid: false,
      status: AlertStatus.UPCOMING,
    },
  },
];

async function main() {
  await prisma.paymentAlert.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: mockUser,
  });

  for (const card of mockCards) {
    const { transactions, paymentAlert, ...cardData } = card;

    await prisma.creditCard.create({
      data: {
        ...cardData,
        userId: user.id,
        transactions: { create: transactions },
        paymentAlerts: { create: paymentAlert },
      },
    });
  }

  console.log(`Seeded user ${user.email} with ${mockCards.length} credit cards.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
