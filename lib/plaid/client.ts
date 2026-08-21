import {
  Configuration,
  CountryCode,
  CreditAccountSubtype,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type AccountBase,
  type CreditCardLiability,
  type LiabilitiesGetResponse,
} from "plaid";

import { mockPlaidLiabilities } from "./mock-liabilities";
import type { PlaidLiabilitySnapshot } from "./types";

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
}

function plaidEnvironment() {
  const env = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (env === "production") return PlaidEnvironments.production;
  if (env === "development") return PlaidEnvironments.development;
  return PlaidEnvironments.sandbox;
}

let cachedClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.");
  }

  if (cachedClient) return cachedClient;

  const configuration = new Configuration({
    basePath: plaidEnvironment(),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
        "Plaid-Version": "2020-09-14",
      },
    },
  });

  cachedClient = new PlaidApi(configuration);
  return cachedClient;
}

export async function createPlaidLinkToken(clientUserId: string): Promise<string> {
  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: "Smart Credit Card Tracker",
    language: "en",
    country_codes: [CountryCode.Us],
    products: [Products.Liabilities],
    account_filters: {
      credit: {
        account_subtypes: [CreditAccountSubtype.CreditCard],
      },
    },
  });

  return response.data.link_token;
}

function purchaseApr(credit: CreditCardLiability | undefined): number | null {
  const aprs = credit?.aprs ?? [];
  const purchase = aprs.find((item) => item.apr_type === "purchase_apr");
  const percentage = purchase?.apr_percentage ?? aprs[0]?.apr_percentage;
  return typeof percentage === "number" ? percentage : null;
}

export function mapLiabilitiesResponse(
  payload: Pick<LiabilitiesGetResponse, "accounts" | "item" | "liabilities">,
  institutionName = "Linked bank"
): PlaidLiabilitySnapshot[] {
  const accounts = payload.accounts ?? [];
  const creditByAccount = new Map(
    (payload.liabilities?.credit ?? [])
      .filter((credit): credit is CreditCardLiability & { account_id: string } => Boolean(credit.account_id))
      .map((credit) => [credit.account_id, credit])
  );
  const itemInstitution = payload.item?.institution_name ?? institutionName;

  return accounts
    .filter((account) => account.type === "credit" || creditByAccount.has(account.account_id))
    .map((account: AccountBase) => {
      const credit = creditByAccount.get(account.account_id);
      const lastStatementBalance = credit?.last_statement_balance ?? null;
      const current =
        account.balances.current ??
        account.balances.available ??
        lastStatementBalance ??
        null;

      return {
        plaidAccountId: account.account_id,
        institutionName: itemInstitution || institutionName,
        cardName: account.official_name || account.name || "Credit card",
        lastFourDigits: (account.mask ?? "0000").slice(-4),
        nextPaymentDueDate: credit?.next_payment_due_date ?? null,
        lastStatementBalance,
        minimumPaymentAmount: credit?.minimum_payment_amount ?? null,
        currentBalance: current,
        creditLimit: account.balances.limit ?? null,
        apr: purchaseApr(credit),
        lastStatementIssueDate: credit?.last_statement_issue_date ?? null,
      } satisfies PlaidLiabilitySnapshot;
    });
}

export async function exchangePublicTokenAndFetchLiabilities(input: {
  publicToken: string;
  institutionName?: string;
}): Promise<PlaidLiabilitySnapshot[]> {
  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: input.publicToken });
  const liabilities = await client.liabilitiesGet({ access_token: exchange.data.access_token });
  return mapLiabilitiesResponse(liabilities.data, input.institutionName);
}

export function getMockLiabilities(): PlaidLiabilitySnapshot[] {
  return mockPlaidLiabilities;
}
