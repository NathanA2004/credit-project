import {
  calculateNextDueDate,
  calculateRemainingGracePeriod,
  lastStatementClose,
  utilizationRatio,
  type RankableCard,
} from "@/lib/engine/calculator";

export type DueTone = "success" | "warning" | "danger";

export function dueTone(daysRemaining: number): DueTone {
  if (daysRemaining < 2) return "danger";
  if (daysRemaining <= 7) return "warning";
  return "success";
}

export function dueLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} days overdue`;
  if (daysRemaining === 0) return "Due today";
  if (daysRemaining === 1) return "Due tomorrow";
  return `${daysRemaining} days left`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ordinal(day: number): string {
  const remainder = day % 10;
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return `${day}th`;
  if (remainder === 1) return `${day}st`;
  if (remainder === 2) return `${day}nd`;
  if (remainder === 3) return `${day}rd`;
  return `${day}th`;
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function getDashboardMetrics(cards: RankableCard[], referenceDate: Date) {
  const totalOwed = cards.reduce((sum, card) => sum + card.currentBalance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
  const utilization = totalLimit > 0 ? totalOwed / totalLimit : 0;

  const upcoming = cards.map((card) => {
    const dueDate = calculateNextDueDate(card.statementClosingDay, card.paymentDueDay, referenceDate);
    const daysRemaining = calculateRemainingGracePeriod(dueDate, referenceDate);
    return { card, dueDate, daysRemaining };
  });

  upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const next = upcoming[0];

  return {
    totalOwed,
    totalLimit,
    utilization,
    nextDueDate: next?.dueDate ?? null,
    nextDueCard: next?.card ?? null,
    daysUntilNextDue: next?.daysRemaining ?? 0,
  };
}

export function getCardPresentation(card: RankableCard, referenceDate: Date) {
  const dueDate = calculateNextDueDate(card.statementClosingDay, card.paymentDueDay, referenceDate);
  const statementDate = lastStatementClose(card.statementClosingDay, referenceDate);
  const daysRemaining = calculateRemainingGracePeriod(dueDate, referenceDate);
  const utilization = utilizationRatio(card);

  return {
    dueDate,
    statementDate,
    daysRemaining,
    utilization,
    tone: dueTone(daysRemaining),
  };
}
