import type { RankableCard } from "@/lib/engine/calculator";
import type { PlaidLiabilitySnapshot } from "./types";

function dayFromIso(value: string | null): number | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  const day = Number(parts[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return undefined;
  return day;
}

function matchesCard(card: RankableCard, snapshot: PlaidLiabilitySnapshot): boolean {
  if (card.plaidAccountId && card.plaidAccountId === snapshot.plaidAccountId) return true;
  return card.lastFourDigits === snapshot.lastFourDigits;
}

function snapshotToCard(snapshot: PlaidLiabilitySnapshot): RankableCard {
  const paymentDueDay = dayFromIso(snapshot.nextPaymentDueDate) ?? 15;
  const statementClosingDay = dayFromIso(snapshot.lastStatementIssueDate) ?? 1;
  const currentBalance = snapshot.currentBalance ?? snapshot.lastStatementBalance ?? 0;
  const creditLimit = snapshot.creditLimit && snapshot.creditLimit > 0 ? snapshot.creditLimit : Math.max(currentBalance, 1);

  return {
    id: snapshot.plaidAccountId,
    institutionName: snapshot.institutionName,
    cardName: snapshot.cardName,
    lastFourDigits: snapshot.lastFourDigits.slice(-4).padStart(4, "0"),
    creditLimit,
    currentBalance,
    apr: snapshot.apr ?? 0,
    statementClosingDay,
    paymentDueDay,
    gracePeriodDays: 25,
    cashbackCategory: { default: 0.01 },
    plaidAccountId: snapshot.plaidAccountId,
  };
}

function mergeSnapshot(card: RankableCard, snapshot: PlaidLiabilitySnapshot): RankableCard {
  const paymentDueDay = dayFromIso(snapshot.nextPaymentDueDate) ?? card.paymentDueDay;
  const statementClosingDay = dayFromIso(snapshot.lastStatementIssueDate) ?? card.statementClosingDay;
  const currentBalance = snapshot.currentBalance ?? snapshot.lastStatementBalance ?? card.currentBalance;
  const creditLimit = snapshot.creditLimit && snapshot.creditLimit > 0 ? snapshot.creditLimit : card.creditLimit;

  return {
    ...card,
    currentBalance,
    creditLimit,
    apr: snapshot.apr ?? card.apr,
    paymentDueDay,
    statementClosingDay,
    plaidAccountId: snapshot.plaidAccountId,
  };
}

export function applyPlaidLiabilities(
  cards: RankableCard[],
  snapshots: PlaidLiabilitySnapshot[]
): RankableCard[] {
  const next = [...cards];
  const used = new Set<string>();

  for (const snapshot of snapshots) {
    const index = next.findIndex((card) => !used.has(card.id) && matchesCard(card, snapshot));
    if (index >= 0) {
      used.add(next[index].id);
      next[index] = mergeSnapshot(next[index], snapshot);
    } else {
      next.push(snapshotToCard(snapshot));
    }
  }

  return next;
}
