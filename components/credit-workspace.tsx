"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { AddCardDialog } from "@/components/add-card-dialog";
import { CardManager } from "@/components/card-manager";
import { ConnectPlaidButton } from "@/components/connect-plaid-button";
import { DashboardOverview } from "@/components/dashboard-overview";
import { PaymentCalendar } from "@/components/payment-calendar";
import { PurchaseAdvisor } from "@/components/purchase-advisor";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RankableCard } from "@/lib/engine/calculator";

export function CreditWorkspace({
  initialCards,
  referenceDateIso,
}: {
  initialCards: RankableCard[];
  referenceDateIso: string;
}) {
  const [cards, setCards] = useState(initialCards);
  const [addOpen, setAddOpen] = useState(false);
  const referenceDate = useMemo(() => new Date(referenceDateIso), [referenceDateIso]);

  function handleAdd(card: RankableCard) {
    setCards((current) => [...current, card]);
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_oklch(0.96_0.02_180)_0%,_transparent_42%)]">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Credit tracker
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Alex Rivera&apos;s cards</h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Watch overlapping due dates, keep utilization in range, and ask the advisor which card to use
                before you spend.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap items-start gap-2">
                <ConnectPlaidButton cards={cards} onCardsChange={setCards} />
                <Button onClick={() => setAddOpen(true)} type="button">
                  <Plus />
                  Add custom card
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Demo data · last four digits only</p>
            </div>
          </header>

          <DashboardOverview cards={cards} referenceDate={referenceDate} />
          <PurchaseAdvisor cards={cards} referenceDate={referenceDateIso} />
          <PaymentCalendar cards={cards} referenceDate={referenceDate} />
          <CardManager cards={cards} onAddCard={() => setAddOpen(true)} referenceDate={referenceDate} />
        </main>
      </div>
      <AddCardDialog onAdd={handleAdd} onOpenChange={setAddOpen} open={addOpen} showTrigger={false} />
    </TooltipProvider>
  );
}
