import { CardManager } from "@/components/card-manager";
import { DashboardOverview } from "@/components/dashboard-overview";
import { PurchaseAdvisor } from "@/components/purchase-advisor";
import { TooltipProvider } from "@/components/ui/tooltip";
import { seedCards } from "@/lib/data/seed-cards";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const referenceDate = new Date();

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
            <p className="text-sm text-muted-foreground">Demo data · last four digits only</p>
          </header>

          <DashboardOverview cards={seedCards} referenceDate={referenceDate} />
          <PurchaseAdvisor cards={seedCards} referenceDate={referenceDate.toISOString()} />
          <CardManager cards={seedCards} referenceDate={referenceDate} />
        </main>
      </div>
    </TooltipProvider>
  );
}
