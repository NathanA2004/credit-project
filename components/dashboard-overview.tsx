import { CalendarClock, Percent, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dueLabel,
  dueTone,
  formatDate,
  formatMoney,
  formatPercent,
  getDashboardMetrics,
} from "@/lib/dashboard";
import type { RankableCard } from "@/lib/engine/calculator";
import { maskedCardNumber } from "@/lib/engine/calculator";

export function DashboardOverview({
  cards,
  referenceDate,
}: {
  cards: RankableCard[];
  referenceDate: Date;
}) {
  const metrics = getDashboardMetrics(cards, referenceDate);
  const tone = dueTone(metrics.daysUntilNextDue);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Total owed
          </CardDescription>
          <CardTitle className="text-3xl tracking-tight">{formatMoney(metrics.totalOwed)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Across {cards.length} cards · {formatMoney(metrics.totalLimit)} combined limit
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Next due date
          </CardDescription>
          <CardTitle className="text-3xl tracking-tight">
            {metrics.nextDueDate ? formatDate(metrics.nextDueDate) : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant={tone}>{dueLabel(metrics.daysUntilNextDue)}</Badge>
          {metrics.nextDueCard ? (
            <p className="text-sm text-muted-foreground">
              {metrics.nextDueCard.institutionName} {metrics.nextDueCard.cardName}{" "}
              {maskedCardNumber(metrics.nextDueCard.lastFourDigits)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Credit utilization
          </CardDescription>
          <CardTitle className="text-3xl tracking-tight">{formatPercent(metrics.utilization)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatMoney(metrics.totalOwed)} of {formatMoney(metrics.totalLimit)} used
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
