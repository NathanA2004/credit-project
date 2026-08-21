import { CreditWorkspace } from "@/components/credit-workspace";
import { seedCards } from "@/lib/data/seed-cards";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <CreditWorkspace initialCards={seedCards} referenceDateIso={new Date().toISOString()} />;
}
