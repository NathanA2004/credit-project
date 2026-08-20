import type { RankedRecommendation } from "./ranker";
import { maskedCardNumber } from "./calculator";

export type ExplanationSource = "ollama" | "openai" | "template";

function round(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function buildMetricDeltas(
  amount: number,
  category: string,
  rankings: RankedRecommendation[]
): string {
  const [winner, runnerUp] = rankings;
  if (!winner) return "No eligible cards were provided.";

  const winnerName = `${winner.card.institutionName} ${winner.card.cardName}`;
  const lines = [
    `Recommend ${winnerName} (${maskedCardNumber(winner.card.lastFourDigits)}) for a $${round(amount, 2)} ${category} purchase.`,
    `Model utility score: ${round(winner.score, 3)}.`,
    `Cash back: ${round(winner.cashbackRate * 100, 2)}% ($${round(winner.rewardAmount, 2)}).`,
    `Days until payment due: ${winner.daysUntilDue}.`,
    `Days since statement close: ${winner.daysSinceStatementClose} (purchases just after a close have the longest float).`,
    `Utilization after this purchase: ${round(winner.utilizationAfter * 100, 1)}%.`,
  ];

  if (runnerUp) {
    const otherName = `${runnerUp.card.institutionName} ${runnerUp.card.cardName}`;
    const rewardDelta = winner.rewardAmount - runnerUp.rewardAmount;
    const dueDelta = winner.daysUntilDue - runnerUp.daysUntilDue;
    lines.push(
      `Compared with ${otherName}: ${rewardDelta >= 0 ? "+" : ""}${round(rewardDelta, 2)} cash back and ${dueDelta >= 0 ? "+" : ""}${dueDelta} days until due.`
    );
  }

  return lines.join(" ");
}

export function templateExplanation(
  amount: number,
  category: string,
  rankings: RankedRecommendation[]
): string {
  const winner = rankings.find((item) => item.eligible) ?? rankings[0];
  if (!winner) {
    return "No card can cover this purchase without exceeding a credit limit. Split the charge or pay down a balance first.";
  }

  const name = `${winner.card.institutionName} ${winner.card.cardName}`;
  const runnerUp = rankings.find((item) => item.card.id !== winner.card.id);
  const graceBit =
    winner.daysSinceStatementClose <= 3
      ? `its statement closed ${winner.daysSinceStatementClose} day${winner.daysSinceStatementClose === 1 ? "" : "s"} ago, so you keep a long grace window`
      : `you still have ${winner.daysUntilDue} day${winner.daysUntilDue === 1 ? "" : "s"} until the payment is due`;

  const second =
    runnerUp && winner.rewardAmount >= runnerUp.rewardAmount
      ? `It earns ${round(winner.cashbackRate * 100, 2)}% back ($${round(winner.rewardAmount, 2)}), ahead of ${runnerUp.card.cardName}.`
      : `It earns ${round(winner.cashbackRate * 100, 2)}% back and ${graceBit}.`;

  return `Use your ${name} for this $${round(amount, 2)} ${category} purchase. ${second}`;
}

async function completeChat(input: {
  url: string;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
}): Promise<string | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;

  const response = await fetch(input.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });

  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  return text || null;
}

const SYSTEM_PROMPT =
  "You are a concise credit-card advisor. Output ONLY two sentences. Do not recalculate math, invent numbers, or mention models. Use only the facts in the user message.";

export async function generateExplanation(input: {
  amount: number;
  category: string;
  rankings: RankedRecommendation[];
}): Promise<{ text: string; source: ExplanationSource }> {
  const facts = buildMetricDeltas(input.amount, input.category, input.rankings);
  const fallback = templateExplanation(input.amount, input.category, input.rankings);

  const ollamaBase = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "phi3";

  try {
    const ollamaText = await completeChat({
      url: `${ollamaBase.replace(/\/$/, "")}/chat/completions`,
      model: ollamaModel,
      system: SYSTEM_PROMPT,
      user: facts,
    });
    if (ollamaText) return { text: ollamaText, source: "ollama" };
  } catch {
    // Local SLM is optional.
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiText = await completeChat({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        system: SYSTEM_PROMPT,
        user: facts,
      });
      if (openaiText) return { text: openaiText, source: "openai" };
    } catch {
      // Fall through to the deterministic summary.
    }
  }

  return { text: fallback, source: "template" };
}
