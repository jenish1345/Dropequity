import type { Activity, Address, LeaderRow } from "./types";

/**
 * Envio HyperIndex client. The indexer in /indexer turns DropOwn's events into queryable
 * rows; this reads them over its GraphQL endpoint. Configure with NEXT_PUBLIC_ENVIO_URL
 * (e.g. http://localhost:8080/v1/graphql for `envio dev`, or the hosted endpoint).
 */

const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_URL ?? "";
export const envioEnabled = /^https?:\/\//.test(ENVIO_URL);

async function query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENVIO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  if (!response.ok) throw new Error(`Envio indexer responded ${response.status}.`);
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? "Envio indexer returned no data.");
  return body.data;
}

type ReferrerRow = { referrer?: string; id: string; conversions: number; bonusShares: string };

const toRows = (rows: ReferrerRow[]): LeaderRow[] =>
  rows.map((r) => ({
    referrer: (r.referrer ?? r.id) as Address,
    conversions: r.conversions,
    bonusShares: BigInt(r.bonusShares),
  }));

export async function fetchCampaignLeaderboard(campaign: Address): Promise<LeaderRow[]> {
  const data = await query<{ CampaignReferrer: ReferrerRow[] }>(
    `query Leaderboard($campaign: String!) {
      CampaignReferrer(where: { campaign: { _eq: $campaign } }, order_by: { bonusShares: desc }, limit: 10) {
        id referrer conversions bonusShares
      }
    }`,
    { campaign: campaign.toLowerCase() },
  );
  return toRows(data.CampaignReferrer);
}

export async function fetchGlobalLeaderboard(): Promise<LeaderRow[]> {
  const data = await query<{ Referrer: ReferrerRow[] }>(
    `query GlobalLeaderboard {
      Referrer(order_by: { bonusShares: desc }, limit: 10) { id conversions bonusShares }
    }`,
    {},
  );
  return toRows(data.Referrer);
}

type ActivityData = {
  Contribution: {
    contributor: string;
    referrer: string | null;
    amount: string;
    bonusShares: string;
    timestamp: number;
    txHash: string;
  }[];
  Campaign: { totalRevenue: string; creatorRevenue: string; fanRevenue: string; fanRevenueClaimed: string }[];
};

export async function fetchActivity(campaign: Address): Promise<Activity> {
  const data = await query<ActivityData>(
    `query Activity($campaign: String!) {
      Contribution(where: { campaign: { _eq: $campaign } }, order_by: { timestamp: desc }, limit: 500) {
        contributor referrer amount bonusShares timestamp txHash
      }
      Campaign(where: { id: { _eq: $campaign } }) {
        totalRevenue creatorRevenue fanRevenue fanRevenueClaimed
      }
    }`,
    { campaign: campaign.toLowerCase() },
  );
  const row = data.Campaign[0];
  return {
    source: "envio",
    events: data.Contribution.map((c) => ({
      timestamp: c.timestamp,
      contributor: c.contributor as Address,
      amount: BigInt(c.amount),
      referrer: (c.referrer as Address | null) ?? null,
      bonusShares: BigInt(c.bonusShares),
      txHash: c.txHash,
    })),
    revenue: {
      total: BigInt(row?.totalRevenue ?? 0),
      fanCut: BigInt(row?.fanRevenue ?? 0),
      creatorCut: BigInt(row?.creatorRevenue ?? 0),
      fanClaimed: BigInt(row?.fanRevenueClaimed ?? 0),
    },
  };
}
