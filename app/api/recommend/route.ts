import { NextResponse } from "next/server";

import { generateExplanation } from "@/lib/engine/advisor";
import { asNumber, maskedCardNumber, type RankableCard } from "@/lib/engine/calculator";
import { rankCardsWithModel } from "@/lib/engine/ranker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecommendBody = {
  amount?: number | string;
  category?: string;
  referenceDate?: string;
  cards?: Array<Record<string, unknown>>;
};

function parseCard(raw: Record<string, unknown>, index: number): RankableCard {
  const lastFour = String(raw.lastFourDigits ?? "");
  return {
    id: String(raw.id ?? `card-${index}`),
    institutionName: String(raw.institutionName ?? "Unknown"),
    cardName: String(raw.cardName ?? "Card"),
    lastFourDigits: lastFour.slice(-4),
    creditLimit: asNumber(raw.creditLimit as number | string),
    currentBalance: asNumber(raw.currentBalance as number | string),
    apr: asNumber(raw.apr as number | string),
    statementClosingDay: Number(raw.statementClosingDay),
    paymentDueDay: Number(raw.paymentDueDay),
    gracePeriodDays: raw.gracePeriodDays == null ? undefined : Number(raw.gracePeriodDays),
    cashbackCategory: (raw.cashbackCategory as RankableCard["cashbackCategory"]) ?? {},
  };
}

function publicCard(item: {
  card: RankableCard;
  score: number;
  eligible: boolean;
  cashbackRate: number;
  rewardAmount: number;
  daysUntilDue: number;
  daysSinceStatementClose: number;
  utilizationAfter: number;
}) {
  return {
    id: item.card.id,
    institutionName: item.card.institutionName,
    cardName: item.card.cardName,
    maskedNumber: maskedCardNumber(item.card.lastFourDigits),
    score: item.score,
    eligible: item.eligible,
    cashbackRate: item.cashbackRate,
    rewardAmount: item.rewardAmount,
    daysUntilDue: item.daysUntilDue,
    daysSinceStatementClose: item.daysSinceStatementClose,
    utilizationAfter: item.utilizationAfter,
  };
}

export async function POST(request: Request) {
  let body: RecommendBody;
  try {
    body = (await request.json()) as RecommendBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const amount = asNumber(body.amount ?? NaN);
  const category = String(body.category ?? "").trim().toLowerCase();
  const cards = (body.cards ?? []).map(parseCard);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "category is required." }, { status: 400 });
  }
  if (cards.length === 0) {
    return NextResponse.json({ error: "cards must include at least one credit card." }, { status: 400 });
  }

  const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    return NextResponse.json({ error: "referenceDate must be a valid ISO date." }, { status: 400 });
  }

  const { rankings, source: rankerSource } = await rankCardsWithModel({
    amount,
    category,
    cards,
    referenceDate,
  });

  const explanation = await generateExplanation({ amount, category, rankings });
  const recommended = rankings.find((item) => item.eligible) ?? null;

  return NextResponse.json({
    recommended: recommended ? publicCard(recommended) : null,
    alternatives: rankings
      .filter((item) => item.card.id !== recommended?.card.id)
      .map(publicCard),
    explanation: explanation.text,
    explanationSource: explanation.source,
    rankerSource,
  });
}
