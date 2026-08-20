import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import featureSpec from "../../ml/feature_spec.json";
import {
  asNumber,
  cashbackRate,
  daysSinceStatementClose,
  daysUntilDue,
  rankCardsForPurchase,
  type RankableCard,
  type ScoredPurchaseCard,
  utilizationRatio,
} from "./calculator";

const FEATURE_NAMES = featureSpec.feature_names;
const CATEGORIES = featureSpec.categories as Record<string, number>;
const DEFAULT_CATEGORY_ID = featureSpec.default_category_id;

export type RankerSource = "onnx" | "python" | "fallback";

export type RankedRecommendation = ScoredPurchaseCard & {
  features: number[];
};

function projectRoot(): string {
  return process.cwd();
}

function encodeCategory(category: string): number {
  return CATEGORIES[category.trim().toLowerCase()] ?? DEFAULT_CATEGORY_ID;
}

export function buildFeatureVector(
  amount: number,
  category: string,
  card: RankableCard,
  referenceDate: Date
): number[] {
  return [
    amount,
    encodeCategory(category),
    asNumber(card.apr),
    daysUntilDue(card, referenceDate),
    daysSinceStatementClose(card, referenceDate),
    utilizationRatio(card, amount),
    cashbackRate(card, category),
  ];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function scoreWithOnnx(featureMatrix: number[][]): Promise<number[] | null> {
  const onnxPath = path.join(projectRoot(), "ml", "artifacts", "card_ranker.onnx");
  if (!(await fileExists(onnxPath))) return null;

  try {
    const ort = await import("onnxruntime-node");
    const session = await ort.InferenceSession.create(onnxPath);
    const flat = Float32Array.from(featureMatrix.flat());
    const tensor = new ort.Tensor("float32", flat, [featureMatrix.length, FEATURE_NAMES.length]);
    const results = await session.run({ features: tensor });
    const output = results.utility;
    return Array.from(output.data as Float32Array);
  } catch {
    return null;
  }
}

function runPythonInfer(payload: unknown): Promise<{
  rankings: Array<{ cardId?: string; score: number }>;
  source: string;
}> {
  const script = path.join(projectRoot(), "ml", "infer.py");
  const pythonBin = process.env.PYTHON_BIN ?? "python";

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [script], {
      cwd: projectRoot(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `infer.py exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function attachFeatures(
  amount: number,
  category: string,
  scored: ScoredPurchaseCard[],
  referenceDate: Date
): RankedRecommendation[] {
  return scored.map((item) => ({
    ...item,
    features: buildFeatureVector(amount, category, item.card, referenceDate),
  }));
}

export async function rankCardsWithModel(input: {
  amount: number;
  category: string;
  cards: RankableCard[];
  referenceDate: Date;
}): Promise<{ rankings: RankedRecommendation[]; source: RankerSource }> {
  const { amount, category, cards, referenceDate } = input;
  const fallback = attachFeatures(
    amount,
    category,
    rankCardsForPurchase(amount, category, cards, referenceDate),
    referenceDate
  );

  const featureMatrix = cards.map((card) =>
    buildFeatureVector(amount, category, card, referenceDate)
  );

  const onnxScores = featureMatrix.length > 0 ? await scoreWithOnnx(featureMatrix) : null;
  if (onnxScores && onnxScores.length === cards.length) {
    const scored = cards
      .map((card, index) => {
        const utilizationAfter = utilizationRatio(card, amount);
        const eligible = utilizationAfter <= 1;
        const rate = cashbackRate(card, category);
        return {
          card,
          score: eligible ? onnxScores[index] : -1,
          eligible,
          cashbackRate: rate,
          rewardAmount: amount * rate,
          daysUntilDue: daysUntilDue(card, referenceDate),
          daysSinceStatementClose: daysSinceStatementClose(card, referenceDate),
          utilizationAfter,
          features: featureMatrix[index],
        };
      })
      .sort((a, b) => b.score - a.score);
    return { rankings: scored, source: "onnx" };
  }

  try {
    const pythonResult = await runPythonInfer({
      amount,
      category,
      referenceDate: referenceDate.toISOString(),
      cards: cards.map((card) => ({
        id: card.id,
        cardName: card.cardName,
        institutionName: card.institutionName,
        lastFourDigits: card.lastFourDigits,
        creditLimit: card.creditLimit,
        currentBalance: card.currentBalance,
        apr: card.apr,
        statementClosingDay: card.statementClosingDay,
        paymentDueDay: card.paymentDueDay,
        cashbackCategory: card.cashbackCategory,
      })),
    });

    const byId = new Map(pythonResult.rankings.map((row) => [row.cardId, row.score]));
    const scored = attachFeatures(
      amount,
      category,
      rankCardsForPurchase(amount, category, cards, referenceDate),
      referenceDate
    )
      .map((item) => ({
        ...item,
        score: byId.get(item.card.id) ?? item.score,
      }))
      .sort((a, b) => b.score - a.score);

    return { rankings: scored, source: "python" };
  } catch {
    return { rankings: fallback, source: "fallback" };
  }
}
