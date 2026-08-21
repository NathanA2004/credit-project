import {
  calculateNextDueDate,
  calculateRemainingGracePeriod,
  lastStatementClose,
  listStatementCycles,
  startOfDay,
  utilizationRatio,
  type RankableCard,
  type StatementCycle,
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

const knownCardSkins: Record<string, string> = {
  Chase: "from-slate-800 via-blue-900 to-slate-950",
  Amex: "from-sky-900 via-slate-800 to-cyan-950",
  RBC: "from-rose-900 via-slate-900 to-zinc-950",
};

const extraCardSkins = [
  "from-emerald-900 via-slate-800 to-teal-950",
  "from-violet-900 via-indigo-950 to-slate-950",
  "from-orange-900 via-amber-950 to-stone-950",
  "from-fuchsia-900 via-slate-900 to-purple-950",
];

const knownTimelineBars: Record<string, string> = {
  Chase: "bg-blue-500/30",
  Amex: "bg-cyan-500/30",
  RBC: "bg-rose-500/30",
};

const extraTimelineBars = ["bg-emerald-500/30", "bg-violet-500/30", "bg-orange-500/30", "bg-fuchsia-500/30"];

function institutionHash(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getCardSkin(institutionName: string): string {
  return knownCardSkins[institutionName] ?? extraCardSkins[institutionHash(institutionName) % extraCardSkins.length];
}

export function getTimelineBarClass(institutionName: string): string {
  return (
    knownTimelineBars[institutionName] ?? extraTimelineBars[institutionHash(institutionName) % extraTimelineBars.length]
  );
}

export function getTimelineRange(referenceDate: Date) {
  const start = startOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
  const end = startOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 2, 0));
  return { start, end };
}

export function percentAlong(date: Date, rangeStart: Date, rangeEnd: Date): number {
  const start = startOfDay(rangeStart).getTime();
  const end = startOfDay(rangeEnd).getTime();
  if (end <= start) return 0;
  return ((startOfDay(date).getTime() - start) / (end - start)) * 100;
}

export type TimelineCycle = StatementCycle & {
  daysRemaining: number;
  tone: DueTone;
  left: number;
  width: number;
  closeLeft: number;
  dueLeft: number;
};

export type TimelineRow = {
  card: RankableCard;
  barClass: string;
  cycles: TimelineCycle[];
};

export function getTimelineRows(cards: RankableCard[], referenceDate: Date): TimelineRow[] {
  const { start, end } = getTimelineRange(referenceDate);

  return cards.map((card) => ({
    card,
    barClass: getTimelineBarClass(card.institutionName),
    cycles: listStatementCycles(card.statementClosingDay, card.paymentDueDay, start, end).map((cycle) => {
      const daysRemaining = calculateRemainingGracePeriod(cycle.dueDate, referenceDate);
      const closeLeft = Math.min(100, Math.max(0, percentAlong(cycle.statementClose, start, end)));
      const dueLeft = Math.min(100, Math.max(0, percentAlong(cycle.dueDate, start, end)));
      return {
        ...cycle,
        daysRemaining,
        tone: dueTone(daysRemaining),
        left: Math.min(closeLeft, dueLeft),
        width: Math.max(Math.abs(dueLeft - closeLeft), 1.2),
        closeLeft,
        dueLeft,
      };
    }),
  }));
}

export function timelineAxisTicks(rangeStart: Date, rangeEnd: Date) {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const ticks: { date: Date; left: number; label: string; isMonthStart: boolean }[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const isMonthStart = cursor.getDate() === 1;
    const showTick = isMonthStart || cursor.getDate() === 15 || cursor.getDate() % 5 === 0;
    if (showTick) {
      ticks.push({
        date: new Date(cursor),
        left: percentAlong(cursor, start, end),
        label: isMonthStart
          ? cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : String(cursor.getDate()),
        isMonthStart,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return ticks;
}
