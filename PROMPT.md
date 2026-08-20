# Role & Goal
You are an expert full-stack engineer and AI architect. Your task is to build a "Smart Credit Card Tracker & AI Financial Advisor" web application. 

The application helps users manage multiple credit cards with overlapping payment due dates, statement closing dates, and grace periods. It alerts users about upcoming deadlines and provides intelligent advice on which card to use for specific transactions to maximize cash-back, maintain liquidity, and avoid late fees or interest charges.

---

# Architecture & Tech Stack
1. **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, Shadcn UI components, Lucide Icons.
2. **Backend / API**: Next.js Route Handlers / Server Actions.
3. **Database**: PostgreSQL (via Supabase or local Docker) with Prisma ORM (or Drizzle ORM).
4. **Data Aggregation / Sandbox**: Plaid API (Sandbox mode) via `plaid-node` SDK for retrieving test credit liabilities, balances, and statement dates.
5. **Deterministic Logic Engine**: Pure TypeScript utility functions for date calculations, grace periods, and payment prioritization.
6. **AI Advisor Engine**: Lightweight rules-based scoring engine + OpenAI API / LangChain integration to format natural language financial advice.

---

# Data Model & Schema (`schema.prisma`)

Please generate the ORM schema for the following models:

1. **User**: `id`, `email`, `name`, `createdAt`, `updatedAt`
2. **CreditCard**:
   - `id`, `userId`
   - `institutionName` (e.g., "Chase", "RBC", "Amex")
   - `cardName` (e.g., "Sapphire Preferred", "Cash Magnet")
   - `lastFourDigits` (String)
   - `creditLimit` (Decimal)
   - `currentBalance` (Decimal)
   - `apr` (Decimal)
   - `statementClosingDay` (Int: 1-31)
   - `paymentDueDay` (Int: 1-31)
   - `gracePeriodDays` (Int, calculated or manual)
   - `cashbackCategory` (JSON / Map, e.g., `{ "groceries": 0.03, "dining": 0.02, "default": 0.01 }`)
   - `plaidAccountId` (String, optional)
3. **Transaction**:
   - `id`, `cardId`
   - `amount` (Decimal)
   - `category` (String, e.g., "groceries", "dining", "travel", "rent")
   - `merchant` (String)
   - `transactionDate` (DateTime)
   - `isPaid` (Boolean)
4. **PaymentAlert**:
   - `id`, `cardId`
   - `dueDate` (DateTime)
   - `amountDue` (Decimal)
   - `isPaid` (Boolean)
   - `status` ("UPCOMING", "URGENT", "OVERDUE", "SETTLED")

---

# Core Functional Modules to Build

### Module 1: Deterministic Date & Interest Engine (`/lib/engine/calculator.ts`)
Write pure TypeScript functions with zero side effects:
- `calculateNextDueDate(statementClosingDay: number, paymentDueDay: number, referenceDate: Date)`: Calculates the exact upcoming due date.
- `calculateRemainingGracePeriod(dueDate: Date, referenceDate: Date)`: Returns days remaining until interest begins accruing.
- `getPaymentPriorityOrder(cards: CreditCard[])`: Ranks cards by urgency based on:
  1. Imminent due date (< 3 days).
  2. APR height (for interest-bearing balances).
  3. Credit utilization percentage `(balance / creditLimit)`.

### Module 2: Hybrid AI Recommendation Engine (`/ml/ranker.py` & `/lib/engine/advisor.ts`)

Build a two-stage hybrid recommendation pipeline:

#### Stage 1: Custom PyTorch Deep Neural Network (Ranker)
- Implement a PyTorch Multi-Layer Perceptron (MLP) in `/ml/ranker.py` that takes a normalized input vector:
  `[purchase_amount, category_id, card_apr, days_until_due, days_since_statement_close, utilization_ratio, cashback_rate]`
- The model outputs continuous utility scores for each user card.
- Export/Run model via ONNX Runtime (`onnxruntime-node`) or a local Python bridge script (`/ml/infer.py`) to execute fast inference directly inside the Next.js API route.

#### Stage 2: Local SLM / LLM Explanation Generator
- Take the top-ranked card output from the PyTorch model and construct a prompt containing raw metric deltas (e.g., "Card A scored highest due to 45-day grace period vs Card B's 3 days").
- Send this structured data to a local SLM (e.g., Llama-3-8B / Phi-3 via Ollama local endpoint `http://localhost:11434/v1`) or GPT-4o-mini API.
- Require the LLM to output ONLY a clean 2-sentence user summary without re-calculating the underlying math.

#### Fallback Rules Engine
- Include pure TypeScript fallback logic (`/lib/engine/calculator.ts`) that runs standard heuristic ranking if local PyTorch weights or local LLM endpoints are unreachable.

### Module 3: Plaid Sandbox Integration (`/lib/plaid/client.ts`)
- Implement Plaid Link client setup for Sandbox environment.
- Create route handlers `/api/plaid/create-link-token` and `/api/plaid/exchange-token`.
- Fetch liabilities using `/liabilities/get` endpoint to automatically populate `next_payment_due_date`, `last_statement_balance`, and `minimum_payment_amount`.
- Provide a local mock JSON fallback (`/prisma/seed.ts`) so the app can run entirely offline without API keys during testing.

### Module 4: Frontend UI Components
- **Dashboard Overview**: Metrics displaying Total Owed, Next Upcoming Payment Deadline (with color-coded badge: Green > 7 days, Yellow < 5 days, Red < 2 days), and Overall Credit Utilization.
- **Card Manager Screen**: Visual cards displaying APR, Due Date, Statement Date, and current progress bar for credit limit utilization.
- **Smart Purchase Advisor Widget**: An interactive form where the user inputs an amount (e.g., "$200") and a category (e.g., "Dining"), and the widget dynamically recommends the optimal card with an explanatory tooltip.
- **Payment Calendar Timeline**: A timeline component showing statement closing windows vs. payment due dates across all user cards.

---

# Instructions for Cursor
1. Start by initializing the Prisma schema in `prisma/schema.prisma` and seeding initial mock data for 3 test credit cards with realistic dates.
2. Build the TypeScript calculator utilities in `lib/engine/calculator.ts` and write unit tests for edge-case date calculations (e.g., month-end boundaries).
3. Implement the server actions and UI components using Shadcn UI.
4. Ensure all financial data rendered on screen sanitizes real credit card numbers (showing `**** **** **** 1234` only).