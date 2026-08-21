export type CashbackCategory = Record<string, number>;

export type RankableCard = {
  id: string;
  institutionName: string;
  cardName: string;
  lastFourDigits: string;
  creditLimit: number;
  currentBalance: number;
  apr: number;
  statementClosingDay: number;
  paymentDueDay: number;
  gracePeriodDays?: number;
  cashbackCategory: CashbackCategory;
};

export function maskedCardNumber(lastFourDigits: string): string {
  return `**** **** **** ${lastFourDigits}`;
}

export function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = daysInMonth(year, monthIndex);
  return new Date(year, monthIndex, Math.min(Math.max(day, 1), lastDay));
}

export function shiftMonth(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const absolute = year * 12 + monthIndex + delta;
  return { year: Math.floor(absolute / 12), monthIndex: ((absolute % 12) + 12) % 12 };
}

export function dueDateForStatementMonth(
  year: number,
  monthIndex: number,
  statementClosingDay: number,
  paymentDueDay: number
): Date {
  if (paymentDueDay > statementClosingDay) {
    return clampDay(year, monthIndex, paymentDueDay);
  }
  const next = shiftMonth(year, monthIndex, 1);
  return clampDay(next.year, next.monthIndex, paymentDueDay);
}

export function calculateNextDueDate(
  statementClosingDay: number,
  paymentDueDay: number,
  referenceDate: Date
): Date {
  const ref = startOfDay(referenceDate);
  const upcoming: Date[] = [];

  for (let delta = -1; delta <= 2; delta += 1) {
    const { year, monthIndex } = shiftMonth(ref.getFullYear(), ref.getMonth(), delta);
    const due = dueDateForStatementMonth(year, monthIndex, statementClosingDay, paymentDueDay);
    if (due.getTime() >= ref.getTime()) {
      upcoming.push(due);
    }
  }

  if (upcoming.length === 0) {
    const { year, monthIndex } = shiftMonth(ref.getFullYear(), ref.getMonth(), 3);
    return dueDateForStatementMonth(year, monthIndex, statementClosingDay, paymentDueDay);
  }

  return upcoming.reduce((earliest, date) =>
    date.getTime() < earliest.getTime() ? date : earliest
  );
}

export function lastStatementClose(statementClosingDay: number, referenceDate: Date): Date {
  const ref = startOfDay(referenceDate);
  const thisClose = clampDay(ref.getFullYear(), ref.getMonth(), statementClosingDay);
  if (thisClose.getTime() <= ref.getTime()) {
    return thisClose;
  }
  const previous = shiftMonth(ref.getFullYear(), ref.getMonth(), -1);
  return clampDay(previous.year, previous.monthIndex, statementClosingDay);
}

export function nextStatementClose(statementClosingDay: number, referenceDate: Date): Date {
  const ref = startOfDay(referenceDate);
  const thisClose = clampDay(ref.getFullYear(), ref.getMonth(), statementClosingDay);
  if (thisClose.getTime() >= ref.getTime()) {
    return thisClose;
  }
  const next = shiftMonth(ref.getFullYear(), ref.getMonth(), 1);
  return clampDay(next.year, next.monthIndex, statementClosingDay);
}

export type StatementCycle = {
  statementClose: Date;
  dueDate: Date;
};

export function listStatementCycles(
  statementClosingDay: number,
  paymentDueDay: number,
  rangeStart: Date,
  rangeEnd: Date
): StatementCycle[] {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const from = shiftMonth(start.getFullYear(), start.getMonth(), -1);
  const to = shiftMonth(end.getFullYear(), end.getMonth(), 1);
  const cycles: StatementCycle[] = [];

  for (let abs = from.year * 12 + from.monthIndex; abs <= to.year * 12 + to.monthIndex; abs += 1) {
    const year = Math.floor(abs / 12);
    const monthIndex = abs % 12;
    const statementClose = clampDay(year, monthIndex, statementClosingDay);
    const dueDate = dueDateForStatementMonth(year, monthIndex, statementClosingDay, paymentDueDay);
    if (dueDate.getTime() >= start.getTime() && statementClose.getTime() <= end.getTime()) {
      cycles.push({ statementClose, dueDate });
    }
  }

  return cycles;
}

export function calculateRemainingGracePeriod(dueDate: Date, referenceDate: Date): number {
  const due = startOfDay(dueDate).getTime();
  const ref = startOfDay(referenceDate).getTime();
  return Math.round((due - ref) / 86_400_000);
}

export function daysUntilDue(card: RankableCard, referenceDate: Date): number {
  return calculateRemainingGracePeriod(
    calculateNextDueDate(card.statementClosingDay, card.paymentDueDay, referenceDate),
    referenceDate
  );
}

export function daysSinceStatementClose(card: RankableCard, referenceDate: Date): number {
  const ref = startOfDay(referenceDate);
  const close = lastStatementClose(card.statementClosingDay, referenceDate);
  return Math.round((ref.getTime() - close.getTime()) / 86_400_000);
}

export function utilizationRatio(card: RankableCard, extraAmount = 0): number {
  const limit = Math.max(asNumber(card.creditLimit), 1e-6);
  return (asNumber(card.currentBalance) + extraAmount) / limit;
}

export function cashbackRate(card: RankableCard, category: string): number {
  const map = card.cashbackCategory ?? {};
  const key = category.trim().toLowerCase();
  if (typeof map[key] === "number") return map[key];
  if (typeof map.default === "number") return map.default;
  return 0;
}

export type ScoredPurchaseCard = {
  card: RankableCard;
  score: number;
  eligible: boolean;
  cashbackRate: number;
  rewardAmount: number;
  daysUntilDue: number;
  daysSinceStatementClose: number;
  utilizationAfter: number;
};

function heuristicPurchaseScore(input: {
  cashbackRate: number;
  daysUntilDue: number;
  daysSinceStatementClose: number;
  utilizationAfter: number;
  apr: number;
}): number {
  if (input.utilizationAfter >= 1) return -1;

  const reward = Math.min(Math.max(input.cashbackRate / 0.06, 0), 1);
  const grace =
    0.6 * Math.min(Math.max(input.daysUntilDue / 45, 0), 1) +
    0.4 * Math.min(Math.max(1 - input.daysSinceStatementClose / 30, 0), 1);
  const utilizationImpact = 1 - Math.min(Math.max(input.utilizationAfter, 0), 1);
  const aprPenalty =
    Math.min(Math.max(input.apr / 30, 0), 1) * Math.min(Math.max(input.utilizationAfter, 0), 1);

  return 0.5 * reward + 0.3 * grace + 0.2 * utilizationImpact - 0.05 * aprPenalty;
}

export function rankCardsForPurchase(
  amount: number,
  category: string,
  cards: RankableCard[],
  referenceDate: Date = new Date()
): ScoredPurchaseCard[] {
  return cards
    .map((card) => {
      const rate = cashbackRate(card, category);
      const dueIn = daysUntilDue(card, referenceDate);
      const sinceClose = daysSinceStatementClose(card, referenceDate);
      const utilizationAfter = utilizationRatio(card, amount);
      const eligible = utilizationAfter <= 1;
      const score = heuristicPurchaseScore({
        cashbackRate: rate,
        daysUntilDue: dueIn,
        daysSinceStatementClose: sinceClose,
        utilizationAfter,
        apr: asNumber(card.apr),
      });

      return {
        card,
        score: eligible ? score : -1,
        eligible,
        cashbackRate: rate,
        rewardAmount: amount * rate,
        daysUntilDue: dueIn,
        daysSinceStatementClose: sinceClose,
        utilizationAfter,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function getPaymentPriorityOrder(
  cards: RankableCard[],
  referenceDate: Date = new Date()
): RankableCard[] {
  return [...cards].sort((a, b) => {
    const aDue = daysUntilDue(a, referenceDate);
    const bDue = daysUntilDue(b, referenceDate);
    const aImminent = aDue < 3 ? 1 : 0;
    const bImminent = bDue < 3 ? 1 : 0;
    if (aImminent !== bImminent) return bImminent - aImminent;
    if (aImminent && bImminent) return aDue - bDue;

    const aApr = asNumber(a.apr);
    const bApr = asNumber(b.apr);
    if (aApr !== bApr) return bApr - aApr;

    return utilizationRatio(b) - utilizationRatio(a);
  });
}
