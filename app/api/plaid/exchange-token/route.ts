import { NextResponse } from "next/server";

import {
  exchangePublicTokenAndFetchLiabilities,
  getMockLiabilities,
  isPlaidConfigured,
} from "@/lib/plaid/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExchangeBody = {
  public_token?: string;
  publicToken?: string;
  institutionName?: string;
};

export async function POST(request: Request) {
  let body: ExchangeBody = {};
  try {
    body = (await request.json()) as ExchangeBody;
  } catch {
    body = {};
  }

  const publicToken = body.public_token ?? body.publicToken;

  if (!isPlaidConfigured() || !publicToken) {
    return NextResponse.json({
      configured: isPlaidConfigured(),
      source: "mock",
      accounts: getMockLiabilities(),
      message: "Returned sandbox mock liabilities because Plaid is not configured or no public token was provided.",
    });
  }

  try {
    const accounts = await exchangePublicTokenAndFetchLiabilities({
      publicToken,
      institutionName: body.institutionName,
    });
    return NextResponse.json({
      configured: true,
      source: "plaid",
      accounts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not exchange the Plaid public token.";
    return NextResponse.json(
      {
        configured: true,
        source: "mock",
        accounts: getMockLiabilities(),
        error: message,
        message: "Plaid exchange failed. Loaded offline mock liabilities instead.",
      },
      { status: 200 }
    );
  }
}
