"use client";

import { CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  dueLabel,
  formatDate,
  getTimelineRange,
  getTimelineRows,
  percentAlong,
  timelineAxisTicks,
} from "@/lib/dashboard";
import { maskedCardNumber, startOfDay, type RankableCard } from "@/lib/engine/calculator";
import { cn } from "@/lib/utils";

const dueMarkerClass = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export function PaymentCalendar({
  cards,
  referenceDate,
}: {
  cards: RankableCard[];
  referenceDate: Date;
}) {
  const { start, end } = getTimelineRange(referenceDate);
  const rows = getTimelineRows(cards, referenceDate);
  const ticks = timelineAxisTicks(start, end);
  const today = percentAlong(referenceDate, start, end);
  const todayInRange = today >= 0 && today <= 100;
  const todayMs = startOfDay(referenceDate).getTime();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Payment calendar</h2>
        <p className="text-sm text-muted-foreground">
          Statement closing windows versus payment due dates for the current and next month.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardDescription className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              {formatDate(start)} – {formatDate(end)}
            </CardDescription>
            <CardTitle>Statement windows vs due dates</CardTitle>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-teal-500" />
              Statement close
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-6 rounded-full bg-blue-500/40" />
              Payment window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rotate-45 rounded-[2px] bg-amber-500" />
              Payment due
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-px bg-foreground" />
              Today
            </span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-6">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a card to plot its statement and due dates.</p>
          ) : (
            <div className="min-w-[40rem]">
              <div className="flex gap-3">
                <div className="w-40 shrink-0 sm:w-44">
                  <div className="h-8" />
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={row.card.id} className="flex h-12 flex-col justify-center">
                        <p className="truncate text-sm font-medium">
                          {row.card.institutionName} {row.card.cardName}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {maskedCardNumber(row.card.lastFourDigits)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative min-w-0 flex-1">
                  {todayInRange ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/50"
                      style={{ left: `${today}%` }}
                    />
                  ) : null}

                  <div className="relative h-8">
                    {ticks.map((tick) => (
                      <div
                        key={tick.date.toISOString()}
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${tick.left}%` }}
                      >
                        <p
                          className={cn(
                            "text-[10px] leading-none text-muted-foreground",
                            tick.isMonthStart && "font-semibold text-foreground"
                          )}
                        >
                          {tick.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={row.card.id} className="relative h-12 rounded-md bg-muted/50">
                        {row.cycles.map((cycle) => (
                          <div key={`${row.card.id}-${cycle.statementClose.toISOString()}`}>
                            <div
                              className={cn("absolute top-1/2 h-3 -translate-y-1/2 rounded-full", row.barClass)}
                              style={{ left: `${cycle.left}%`, width: `${cycle.width}%` }}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="absolute top-1/2 z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500 ring-2 ring-background"
                                  style={{ left: `${cycle.closeLeft}%` }}
                                  type="button"
                                >
                                  <span className="sr-only">
                                    {row.card.cardName} statement closes {formatDate(cycle.statementClose)}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Statement closes {formatDate(cycle.statementClose)}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    "absolute top-1/2 z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-background",
                                    dueMarkerClass[cycle.tone]
                                  )}
                                  style={{ left: `${cycle.dueLeft}%` }}
                                  type="button"
                                >
                                  <span className="sr-only">
                                    {row.card.cardName} payment due {formatDate(cycle.dueDate)}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Due {formatDate(cycle.dueDate)} · {dueLabel(cycle.daysRemaining)}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {rows.map((row) => {
                  const nextDue = row.cycles
                    .filter((cycle) => cycle.dueDate.getTime() >= todayMs)
                    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
                  if (!nextDue) return null;
                  return (
                    <Badge key={row.card.id} variant={nextDue.tone}>
                      {row.card.cardName}: due {formatDate(nextDue.dueDate)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
