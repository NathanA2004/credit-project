"use client";

import { useState, type FormEvent } from "react";
import { Info, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney, formatPercent } from "@/lib/dashboard";
import { purchaseCategories } from "@/lib/data/seed-cards";
import type { RankableCard } from "@/lib/engine/calculator";

type RecommendResponse = {
  recommended: {
    id: string;
    institutionName: string;
    cardName: string;
    maskedNumber: string;
    score: number;
    cashbackRate: number;
    rewardAmount: number;
    daysUntilDue: number;
    utilizationAfter: number;
  } | null;
  explanation: string;
  explanationSource: string;
  rankerSource: string;
  error?: string;
};

export function PurchaseAdvisor({
  cards,
  referenceDate,
}: {
  cards: RankableCard[];
  referenceDate: string;
}) {
  const [amount, setAmount] = useState("150");
  const [category, setCategory] = useState("groceries");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          referenceDate,
          cards,
        }),
      });
      const payload = (await response.json()) as RecommendResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "The ranker could not complete this request.");
      }
      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Smart purchase advisor
        </CardDescription>
        <CardTitle>Which card should I use?</CardTitle>
        <p className="text-sm text-muted-foreground">
          The ONNX ranker scores rewards, grace period, and utilization, then an LLM writes a two-sentence
          explanation.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              min="1"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="200"
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {purchaseCategories.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={loading || !amount} type="submit">
            {loading ? <Loader2 className="animate-spin" /> : null}
            Recommend
          </Button>
        </form>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        {result?.recommended ? (
          <div className="mt-5 space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Use this card</p>
                <p className="text-lg font-semibold">
                  {result.recommended.institutionName} {result.recommended.cardName}
                </p>
                <p className="font-mono text-sm text-muted-foreground">{result.recommended.maskedNumber}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{formatPercent(result.recommended.cashbackRate)} back</Badge>
                <Badge variant="outline">{formatMoney(result.recommended.rewardAmount)} rewards</Badge>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm leading-relaxed">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="mt-0.5 rounded-full text-muted-foreground hover:text-foreground"
                    type="button"
                  >
                    <Info className="h-4 w-4" />
                    <span className="sr-only">Why this card</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Ranker {result.rankerSource} · explanation {result.explanationSource} · score{" "}
                  {result.recommended.score.toFixed(3)} · {result.recommended.daysUntilDue} days until due ·{" "}
                  {formatPercent(result.recommended.utilizationAfter)} utilization after purchase
                </TooltipContent>
              </Tooltip>
              <p>{result.explanation}</p>
            </div>
          </div>
        ) : null}

        {result && !result.recommended && !error ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No card can cover this purchase without going over a limit.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
