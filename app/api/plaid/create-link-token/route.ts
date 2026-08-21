import { NextResponse } from "next/server";

import { createPlaidLinkToken, isPlaidConfigured } from "@/lib/plaid/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isPlaidConfigured()) {
    return NextResponse.json({
      configured: false,
      linkToken: null,
      message: "Plaid sandbox keys are not set. The app will use offline mock liabilities.",
    });
  }

  try {
    const linkToken = await createPlaidLinkToken(
      process.env.PLAID_CLIENT_USER_ID ?? "demo-user-alex-rivera"
    );
    return NextResponse.json({ configured: true, linkToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create a Plaid Link token.";
    return NextResponse.json({ configured: true, linkToken: null, error: message }, { status: 502 });
  }
}
