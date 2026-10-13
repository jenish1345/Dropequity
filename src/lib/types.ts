export type Address = `0x${string}`;

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
export const TOTAL_SHARES = 1_000_000n * 10n ** 18n;
export const BPS = 10_000n;
export const REFERRAL_BONUS_BPS = 1_000;

export type DropKind = "Song" | "Art drop" | "Video" | "Collection";

export type CampaignMeta = {
  title: string;
  tagline: string;
  kind: DropKind;
  creatorName: string;
};

export type Campaign = {
  id: number;
  address: Address;
  governance: Address;
  creator: Address;
  meta: CampaignMeta;
  goal: bigint;
  raised: bigint;
  /** Unix seconds. */
  deadline: number;
  fanShareBps: number;
  referralBonusBps: number;
  contributorPool: bigint;
  attentionPool: bigint;
  attentionMinted: bigint;
  totalSupply: bigint;
  totalRevenue: bigint;
  contributorCount: number;
  finalized: boolean;
};

export type CampaignStatus = "funding" | "goal-hit" | "finalized" | "expired";

export type Position = {
  contributed: bigint;
  shares: bigint;
  bonusShares: bigint;
  conversions: number;
  claimable: bigint;
};

export type LeaderRow = {
  referrer: Address;
  conversions: number;
  bonusShares: bigint;
  code?: string;
};

export type Proposal = {
  id: number;
  proposer: Address;
  description: string;
  options: string[];
  votes: bigint[];
  startTime: number;
  endTime: number;
  totalVotes: bigint;
  executed: boolean;
  winningOption: number;
  /** Option index the connected account voted for, if any. */
  myVote: number | null;
};

export type CreateCampaignInput = {
  meta: CampaignMeta;
  goal: bigint;
  fanSharePercent: number;
  attentionPoolPercent: number;
  /** Unix seconds. */
  deadline: number;
};

export type ActivityEvent = {
  /** Unix seconds. */
  timestamp: number;
  contributor: Address;
  amount: bigint;
  /** Set only when the referral converted and paid a bonus. */
  referrer: Address | null;
  bonusShares: bigint;
  txHash?: string;
};

export type Activity = {
  /** Where the feed came from. "unavailable" means live mode with no indexer configured. */
  source: "envio" | "sandbox" | "unavailable";
  /** Newest first. */
  events: ActivityEvent[];
  revenue: { total: bigint; fanCut: bigint; creatorCut: bigint; fanClaimed: bigint };
};

/** `simulated` is true when nothing left the browser (demo sandbox). */
export type TxResult = { hash?: string; simulated: boolean };

export interface DataSource {
  readonly mode: "demo" | "live";
  votingPeriod(): Promise<number>;
  listCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | null>;
  getPosition(id: number, account: Address): Promise<Position>;
  getCreatorClaimable(id: number): Promise<bigint>;
  getLeaderboard(id: number): Promise<LeaderRow[]>;
  getGlobalLeaderboard(): Promise<LeaderRow[]>;
  getActivity(id: number): Promise<Activity>;
  getCode(account: Address): Promise<string>;
  /** Accepts a referral code or a raw address. Resolves to null when unknown. */
  resolveReferrer(input: string): Promise<Address | null>;
  registerCode(account: Address, code: string): Promise<TxResult>;
  createCampaign(account: Address, input: CreateCampaignInput): Promise<TxResult & { id: number }>;
  contribute(account: Address, id: number, amount: bigint, referrer: Address | null): Promise<TxResult>;
  finalize(account: Address, id: number): Promise<TxResult>;
  refund(account: Address, id: number): Promise<TxResult>;
  distributeRevenue(account: Address, id: number, amount: bigint): Promise<TxResult>;
  claimRevenue(account: Address, id: number): Promise<TxResult>;
  withdrawCreatorRevenue(account: Address, id: number): Promise<TxResult>;
  getProposals(id: number, account: Address | null): Promise<Proposal[]>;
  createProposal(account: Address, id: number, description: string, options: string[]): Promise<TxResult>;
  castVote(account: Address, id: number, proposalId: number, optionIndex: number): Promise<TxResult>;
  executeProposal(account: Address, id: number, proposalId: number): Promise<TxResult>;
}

export function statusOf(c: Campaign, nowSec: number): CampaignStatus {
  if (c.finalized) return "finalized";
  if (c.raised >= c.goal) return "goal-hit";
  if (nowSec >= c.deadline) return "expired";
  return "funding";
}
