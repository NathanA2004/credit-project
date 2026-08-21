"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Landmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyPlaidLiabilities } from "@/lib/plaid/apply";
import type { PlaidLiabilitySnapshot } from "@/lib/plaid/types";
import type { RankableCard } from "@/lib/engine/calculator";

const PlaidLinkLauncher = dynamic(
  () => import("./plaid-link-launcher").then((mod) => mod.PlaidLinkLauncher),
  { ssr: false }
);

type LinkTokenResponse = {
  configured: boolean;
  linkToken: string | null;
  message?: string;
  error?: string;
};

type ExchangeResponse = {
  configured: boolean;
  source: "plaid" | "mock";
  accounts: PlaidLiabilitySnapshot[];
  message?: string;
  error?: string;
};

export function ConnectPlaidButton({
  cards,
  onCardsChange,
}: {
  cards: RankableCard[];
  onCardsChange: (cards: RankableCard[]) => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLiabilities(body?: Record<string, string>) {
    const response = await fetch("/api/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const payload = (await response.json()) as ExchangeResponse;
    if (!Array.isArray(payload.accounts)) {
      throw new Error(payload.error ?? "Plaid did not return any accounts.");
    }
    onCardsChange(applyPlaidLiabilities(cards, payload.accounts));
    setStatus(
      payload.source === "plaid"
        ? `Imported ${payload.accounts.length} card${payload.accounts.length === 1 ? "" : "s"} from Plaid.`
        : payload.message ?? "Plaid keys are not set. Loaded sandbox mock liabilities instead."
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const payload = (await response.json()) as LinkTokenResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start Plaid Link.");
      }

      if (payload.configured && payload.linkToken) {
        setLinkToken(payload.linkToken);
        return;
      }

      await loadLiabilities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Plaid.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlaidSuccess(publicToken: string, metadata: { institution: { name: string } | null }) {
    setLinkToken(null);
    setLoading(true);
    setError(null);
    try {
      await loadLiabilities({
        public_token: publicToken,
        institutionName: metadata.institution?.name ?? "Linked bank",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not exchange the Plaid token.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button disabled={loading || Boolean(linkToken)} onClick={handleClick} type="button" variant="outline">
        {loading ? <Loader2 className="animate-spin" /> : <Landmark />}
        Connect Bank via Plaid
      </Button>
      {status ? <p className="max-w-xs text-xs text-muted-foreground sm:text-right">{status}</p> : null}
      {error ? <p className="max-w-xs text-xs text-destructive sm:text-right">{error}</p> : null}
      {linkToken ? (
        <PlaidLinkLauncher
          onExit={() => setLinkToken(null)}
          onSuccess={handlePlaidSuccess}
          token={linkToken}
        />
      ) : null}
    </div>
  );
}
