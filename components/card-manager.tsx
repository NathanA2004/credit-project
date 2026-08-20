import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  dueLabel,
  formatDate,
  formatMoney,
  formatPercent,
  getCardPresentation,
  ordinal,
} from "@/lib/dashboard";
import type { RankableCard } from "@/lib/engine/calculator";
import { maskedCardNumber } from "@/lib/engine/calculator";
import { cn } from "@/lib/utils";

const cardSkins: Record<string, string> = {
  Chase: "from-slate-800 via-blue-900 to-slate-950",
  Amex: "from-sky-900 via-slate-800 to-cyan-950",
  RBC: "from-rose-900 via-slate-900 to-zinc-950",
};

function utilizationBarClass(utilization: number): string {
  if (utilization >= 0.7) return "bg-red-500";
  if (utilization >= 0.3) return "bg-amber-500";
  return "bg-emerald-500";
}

export function CardManager({
  cards,
  referenceDate,
}: {
  cards: RankableCard[];
  referenceDate: Date;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Card manager</h2>
        <p className="text-sm text-muted-foreground">
          Limits, APRs, and statement windows. Card numbers are masked to the last four digits.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const presentation = getCardPresentation(card, referenceDate);
          return (
            <Card key={card.id} className="overflow-hidden py-0">
              <div
                className={cn(
                  "bg-gradient-to-br p-5 text-white",
                  cardSkins[card.institutionName] ?? "from-slate-800 to-slate-950"
                )}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">{card.institutionName}</p>
                <p className="mt-6 font-mono text-lg tracking-widest">
                  {maskedCardNumber(card.lastFourDigits)}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{card.cardName}</p>
                    <p className="text-xs text-white/70">Closes on the {ordinal(card.statementClosingDay)}</p>
                  </div>
                  <p className="text-sm font-semibold">{card.apr.toFixed(2)}% APR</p>
                </div>
              </div>
              <CardContent className="space-y-4 py-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium">
                    {formatMoney(card.currentBalance)} / {formatMoney(card.creditLimit)}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Utilization</span>
                    <span>{formatPercent(presentation.utilization)}</span>
                  </div>
                  <Progress
                    value={Math.min(presentation.utilization * 100, 100)}
                    indicatorClassName={utilizationBarClass(presentation.utilization)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Statement closed</p>
                    <p className="font-medium">{formatDate(presentation.statementDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment due</p>
                    <div className="flex flex-col items-start gap-1">
                      <p className="font-medium">{formatDate(presentation.dueDate)}</p>
                      <Badge variant={presentation.tone}>{dueLabel(presentation.daysRemaining)}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
