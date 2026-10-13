import { parseEther } from "viem";
import { isAddress, isValidCode } from "./format";
import {
  BPS,
  REFERRAL_BONUS_BPS,
  TOTAL_SHARES,
  type Activity,
  type ActivityEvent,
  type Address,
  type Campaign,
  type CampaignMeta,
  type CreateCampaignInput,
  type DataSource,
  type LeaderRow,
  type Position,
  type Proposal,
  type TxResult,
} from "./types";

/**
 * Demo sandbox: a browser-only simulation of the DropOwn contracts.
 * It mirrors the Solidity arithmetic so the numbers behave like the real thing,
 * but nothing here touches a wallet or a chain. Everything it shows is DEMO DATA.
 */

const STORAGE_KEY = "dropown.demo.v2";
const PRECISION = 10n ** 27n;
export const DEMO_VOTING_PERIOD = 90;

/** The visitor's simulated wallet in the sandbox. */
export const DEMO_ACCOUNT: Address = "0xd0d0000000000000000000000000000000000001";

const fan = (n: number): Address => `0xfa${n.toString(16).padStart(38, "0")}`;
const DEMO_FANS: { address: Address; code: string }[] = [
  { address: fan(1), code: "nova" },
  { address: fan(2), code: "kairo" },
  { address: fan(3), code: "juno" },
  { address: fan(4), code: "sable" },
  { address: fan(5), code: "indie" },
  { address: fan(6), code: "rhea" },
  { address: fan(7), code: "otto" },
  { address: fan(8), code: "mira" },
];

type Ledger = Record<string, bigint>;

type DemoProposal = Omit<Proposal, "myVote"> & { voters: Record<string, number> };

type DemoCampaign = {
  id: number;
  address: Address;
  governance: Address;
  creator: Address;
  meta: CampaignMeta;
  goal: bigint;
  raised: bigint;
  deadline: number;
  fanShareBps: number;
  contributorPool: bigint;
  attentionPool: bigint;
  attentionMinted: bigint;
  totalSupply: bigint;
  totalRevenue: bigint;
  finalized: boolean;
  revenuePerShare: bigint;
  creatorClaimable: bigint;
  contributions: Ledger;
  balances: Ledger;
  bonus: Ledger;
  conversions: Record<string, number>;
  claimed: Ledger;
  contributors: Address[];
  referrers: Address[];
  proposals: DemoProposal[];
  /** Contribution feed, oldest first. Stands in for indexed Contributed / ReferralRewarded events. */
  log: ActivityEvent[];
  fanClaimed: bigint;
};

type DemoState = {
  campaigns: DemoCampaign[];
  codes: Record<string, Address>;
  nextFan: number;
};

const now = () => Math.floor(Date.now() / 1000);
const key = (a: string) => a.toLowerCase();

class DemoError extends Error {
  override name = "DemoError";
}

function newCampaign(id: number, creator: Address, input: CreateCampaignInput): DemoCampaign {
  if (input.goal <= 0n) throw new DemoError("Goal must be greater than zero.");
  if (input.fanSharePercent < 1 || input.fanSharePercent > 100) throw new DemoError("Fan share must be 1-100%.");
  if (input.attentionPoolPercent < 0 || input.attentionPoolPercent > 50) {
    throw new DemoError("Attention Pool must be 0-50%.");
  }
  if (input.deadline <= now()) throw new DemoError("Deadline must be in the future.");
  const attentionPool = (TOTAL_SHARES * BigInt(input.attentionPoolPercent * 100)) / BPS;
  return {
    id,
    address: `0xc0de${id.toString(16).padStart(36, "0")}`,
    governance: `0x90f0${id.toString(16).padStart(36, "0")}`,
    creator,
    meta: input.meta,
    goal: input.goal,
    raised: 0n,
    deadline: input.deadline,
    fanShareBps: input.fanSharePercent * 100,
    contributorPool: TOTAL_SHARES - attentionPool,
    attentionPool,
    attentionMinted: 0n,
    totalSupply: 0n,
    totalRevenue: 0n,
    finalized: false,
    revenuePerShare: 0n,
    creatorClaimable: 0n,
    contributions: {},
    balances: {},
    bonus: {},
    conversions: {},
    claimed: {},
    contributors: [],
    referrers: [],
    proposals: [],
    log: [],
    fanClaimed: 0n,
  };
}

/** Mirrors DropCampaign.contribute, including the goal cap and first-contribution referral rule. */
function applyContribution(c: DemoCampaign, from: Address, amount: bigint, referrer: Address | null, at = now()) {
  if (c.finalized || now() >= c.deadline || c.raised >= c.goal) throw new DemoError("This campaign is closed.");
  if (amount <= 0n) throw new DemoError("Enter an amount greater than zero.");

  const remaining = c.goal - c.raised;
  const accepted = amount > remaining ? remaining : amount;
  const k = key(from);
  const isNew = !c.contributions[k];
  const shares = (accepted * c.contributorPool) / c.goal;

  c.raised += accepted;
  c.contributions[k] = (c.contributions[k] ?? 0n) + accepted;
  c.balances[k] = (c.balances[k] ?? 0n) + shares;
  c.totalSupply += shares;
  if (isNew) c.contributors.push(from);

  const entry: ActivityEvent = { timestamp: at, contributor: from, amount: accepted, referrer: null, bonusShares: 0n };
  c.log.push(entry);

  if (isNew && referrer && key(referrer) !== k) {
    let bonus = (shares * BigInt(REFERRAL_BONUS_BPS)) / BPS;
    const left = c.attentionPool - c.attentionMinted;
    if (bonus > left) bonus = left;
    if (bonus > 0n) {
      const r = key(referrer);
      if (!c.conversions[r]) c.referrers.push(referrer);
      c.conversions[r] = (c.conversions[r] ?? 0) + 1;
      c.bonus[r] = (c.bonus[r] ?? 0n) + bonus;
      c.balances[r] = (c.balances[r] ?? 0n) + bonus;
      c.attentionMinted += bonus;
      c.totalSupply += bonus;
      entry.referrer = referrer;
      entry.bonusShares = bonus;
    }
  }
}

function seed(): DemoState {
  const t = now();
  const state: DemoState = { campaigns: [], codes: {}, nextFan: 100 };
  for (const f of DEMO_FANS) state.codes[f.code] = f.address;
  const byCode = (code: string) => state.codes[code];

  const midnight = newCampaign(0, "0xc7ea000000000000000000000000000000000001", {
    meta: {
      title: "Midnight Static",
      tagline: "A late-night synth single, mastered and pressed by the people who heard it first.",
      kind: "Song",
      creatorName: "Lumen Arcade",
    },
    goal: parseEther("500"),
    fanSharePercent: 20,
    attentionPoolPercent: 10,
    deadline: t + 3 * 86_400 + 5 * 3_600,
  });
  // [fan, MON, referrer, hours ago]
  const backers: [string, string, string | null, number][] = [
    ["nova", "110", null, 92],
    ["kairo", "70", "nova", 70],
    ["juno", "60", "nova", 51],
    ["sable", "40", "kairo", 44],
    ["indie", "30", null, 27],
    ["rhea", "30", "nova", 9],
    ["otto", "20", "juno", 3],
  ];
  for (const [who, amount, ref, hoursAgo] of backers) {
    applyContribution(midnight, byCode(who), parseEther(amount), ref ? byCode(ref) : null, t - hoursAgo * 3_600);
  }

  const suns = newCampaign(1, "0xc7ea000000000000000000000000000000000002", {
    meta: {
      title: "Paper Suns",
      tagline: "Forty risograph prints, one generative sibling each. The edition opens when the goal does.",
      kind: "Art drop",
      creatorName: "Studio Halcyon",
    },
    goal: parseEther("1200"),
    fanSharePercent: 25,
    attentionPoolPercent: 10,
    deadline: t + 21 * 86_400,
  });
  applyContribution(suns, byCode("mira"), parseEther("24"), null, t - 2 * 3_600);

  state.campaigns.push(midnight, suns);
  return state;
}

// ------------------------------------------------------------------ persistence

function serialize(state: DemoState): string {
  return JSON.stringify(state, (_, v) => (typeof v === "bigint" ? `${v}n` : v));
}

function deserialize(raw: string): DemoState {
  return JSON.parse(raw, (_, v) => (typeof v === "string" && /^-?\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v));
}

let memory: DemoState | null = null;

function load(): DemoState {
  if (memory) return memory;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      memory = deserialize(raw);
      return memory;
    }
  } catch {
    // Storage unavailable or corrupted: fall through to a fresh seed.
  }
  memory = seed();
  save();
  return memory;
}

function save() {
  if (!memory || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialize(memory));
  } catch {
    // Private mode etc. The sandbox still works for this page view.
  }
}

/** Wipe the sandbox back to its seeded starting point. */
export function resetDemo() {
  memory = seed();
  save();
}

// ------------------------------------------------------------------ source

const SIMULATED: TxResult = { simulated: true };

function toCampaign(c: DemoCampaign): Campaign {
  return {
    id: c.id,
    address: c.address,
    governance: c.governance,
    creator: c.creator,
    meta: c.meta,
    goal: c.goal,
    raised: c.raised,
    deadline: c.deadline,
    fanShareBps: c.fanShareBps,
    referralBonusBps: REFERRAL_BONUS_BPS,
    contributorPool: c.contributorPool,
    attentionPool: c.attentionPool,
    attentionMinted: c.attentionMinted,
    totalSupply: c.totalSupply,
    totalRevenue: c.totalRevenue,
    contributorCount: c.contributors.length,
    finalized: c.finalized,
  };
}

function claimable(c: DemoCampaign, account: string): bigint {
  const k = key(account);
  return ((c.balances[k] ?? 0n) * c.revenuePerShare) / PRECISION - (c.claimed[k] ?? 0n);
}

function codeFor(state: DemoState, account: string): string {
  const k = key(account);
  return Object.keys(state.codes).find((code) => key(state.codes[code]) === k) ?? "";
}

function get(id: number): DemoCampaign {
  const c = load().campaigns[id];
  if (!c) throw new DemoError("Campaign not found.");
  return c;
}

/** Pause briefly so sandbox actions still show a pending state. */
const settle = () => new Promise<void>((r) => setTimeout(r, 450));

async function mutate<T>(fn: () => T): Promise<T> {
  await settle();
  const out = fn();
  save();
  return out;
}

export const demoSource: DataSource = {
  mode: "demo",

  async votingPeriod() {
    return DEMO_VOTING_PERIOD;
  },

  async listCampaigns() {
    return load().campaigns.map(toCampaign);
  },

  async getCampaign(id) {
    const c = load().campaigns[id];
    return c ? toCampaign(c) : null;
  },

  async getPosition(id, account): Promise<Position> {
    const c = get(id);
    const k = key(account);
    return {
      contributed: c.contributions[k] ?? 0n,
      shares: c.balances[k] ?? 0n,
      bonusShares: c.bonus[k] ?? 0n,
      conversions: c.conversions[k] ?? 0,
      claimable: claimable(c, account),
    };
  },

  async getCreatorClaimable(id) {
    return get(id).creatorClaimable;
  },

  async getLeaderboard(id): Promise<LeaderRow[]> {
    const state = load();
    const c = get(id);
    return c.referrers.map((referrer) => ({
      referrer,
      conversions: c.conversions[key(referrer)] ?? 0,
      bonusShares: c.bonus[key(referrer)] ?? 0n,
      code: codeFor(state, referrer) || undefined,
    }));
  },

  async getGlobalLeaderboard(): Promise<LeaderRow[]> {
    const state = load();
    const totals = new Map<string, LeaderRow>();
    for (const c of state.campaigns) {
      for (const referrer of c.referrers) {
        const k = key(referrer);
        const row = totals.get(k) ?? { referrer, conversions: 0, bonusShares: 0n, code: codeFor(state, referrer) || undefined };
        row.conversions += c.conversions[k] ?? 0;
        row.bonusShares += c.bonus[k] ?? 0n;
        totals.set(k, row);
      }
    }
    return [...totals.values()];
  },

  async getActivity(id): Promise<Activity> {
    const c = get(id);
    const fanCut = (c.totalRevenue * BigInt(c.fanShareBps)) / BPS;
    return {
      source: "sandbox",
      events: [...c.log].reverse(),
      revenue: { total: c.totalRevenue, fanCut, creatorCut: c.totalRevenue - fanCut, fanClaimed: c.fanClaimed },
    };
  },

  async getCode(account) {
    return codeFor(load(), account);
  },

  async resolveReferrer(input) {
    const v = input.trim();
    if (!v) return null;
    if (isAddress(v)) return v.toLowerCase() as Address;
    return load().codes[v.toLowerCase()] ?? null;
  },

  registerCode(account, code) {
    return mutate(() => {
      const state = load();
      if (!isValidCode(code)) throw new DemoError("Codes are 3-20 characters: a-z, 0-9 and hyphens.");
      if (codeFor(state, account)) throw new DemoError("This wallet already has a referral code.");
      if (state.codes[code]) throw new DemoError("That code is taken.");
      state.codes[code] = account;
      return SIMULATED;
    });
  },

  createCampaign(account, input) {
    return mutate(() => {
      const state = load();
      const c = newCampaign(state.campaigns.length, account, input);
      state.campaigns.push(c);
      return { ...SIMULATED, id: c.id };
    });
  },

  contribute(account, id, amount, referrer) {
    return mutate(() => {
      applyContribution(get(id), account, amount, referrer);
      return SIMULATED;
    });
  },

  finalize(_account, id) {
    return mutate(() => {
      const c = get(id);
      if (c.finalized) throw new DemoError("Already finalized.");
      if (c.raised < c.goal) throw new DemoError("The goal has not been reached yet.");
      c.finalized = true;
      return SIMULATED;
    });
  },

  refund(account, id) {
    return mutate(() => {
      const c = get(id);
      const k = key(account);
      if (c.finalized || now() < c.deadline || c.raised >= c.goal) throw new DemoError("Refunds are not open.");
      const amount = c.contributions[k] ?? 0n;
      if (amount === 0n) throw new DemoError("Nothing to refund.");
      c.contributions[k] = 0n;
      c.totalSupply -= c.balances[k] ?? 0n;
      c.balances[k] = 0n;
      c.raised -= amount;
      return SIMULATED;
    });
  },

  distributeRevenue(_account, id, amount) {
    return mutate(() => {
      const c = get(id);
      if (!c.finalized) throw new DemoError("Revenue opens after the campaign is finalized.");
      if (amount <= 0n) throw new DemoError("Enter an amount greater than zero.");
      const fanCut = (amount * BigInt(c.fanShareBps)) / BPS;
      c.revenuePerShare += (fanCut * PRECISION) / c.totalSupply;
      c.creatorClaimable += amount - fanCut;
      c.totalRevenue += amount;
      return SIMULATED;
    });
  },

  claimRevenue(account, id) {
    return mutate(() => {
      const c = get(id);
      const amount = claimable(c, account);
      if (amount === 0n) throw new DemoError("Nothing to claim yet.");
      c.claimed[key(account)] = (c.claimed[key(account)] ?? 0n) + amount;
      c.fanClaimed += amount;
      return SIMULATED;
    });
  },

  withdrawCreatorRevenue(account, id) {
    return mutate(() => {
      const c = get(id);
      if (key(account) !== key(c.creator)) throw new DemoError("Only the creator can withdraw this.");
      if (c.creatorClaimable === 0n) throw new DemoError("Nothing to withdraw yet.");
      c.creatorClaimable = 0n;
      return SIMULATED;
    });
  },

  async getProposals(id, account): Promise<Proposal[]> {
    return get(id).proposals.map(({ voters, ...p }) => ({
      ...p,
      myVote: account && voters[key(account)] !== undefined ? voters[key(account)] : null,
    }));
  },

  createProposal(account, id, description, options) {
    return mutate(() => {
      const c = get(id);
      const k = key(account);
      if (!c.finalized) throw new DemoError("Voting opens once the campaign is finalized.");
      if (k !== key(c.creator) && !(c.balances[k] > 0n)) throw new DemoError("Only DropShare holders can propose.");
      if (!description.trim()) throw new DemoError("Ask a question.");
      if (options.length < 2 || options.length > 8 || options.some((o) => !o.trim())) {
        throw new DemoError("Give 2-8 non-empty options.");
      }
      const start = now();
      c.proposals.push({
        id: c.proposals.length,
        proposer: account,
        description,
        options,
        votes: options.map(() => 0n),
        startTime: start,
        endTime: start + DEMO_VOTING_PERIOD,
        totalVotes: 0n,
        executed: false,
        winningOption: 0,
        voters: {},
      });
      return SIMULATED;
    });
  },

  castVote(account, id, proposalId, optionIndex) {
    return mutate(() => {
      const c = get(id);
      const p = c.proposals[proposalId];
      const k = key(account);
      if (!p) throw new DemoError("Proposal not found.");
      if (now() >= p.endTime) throw new DemoError("Voting has closed.");
      if (p.voters[k] !== undefined) throw new DemoError("You already voted on this one.");
      const weight = c.balances[k] ?? 0n;
      if (weight === 0n) throw new DemoError("You need DropShares in this drop to vote.");
      p.voters[k] = optionIndex;
      p.votes[optionIndex] += weight;
      p.totalVotes += weight;
      return SIMULATED;
    });
  },

  executeProposal(_account, id, proposalId) {
    return mutate(() => {
      const p = get(id).proposals[proposalId];
      if (!p) throw new DemoError("Proposal not found.");
      if (now() < p.endTime) throw new DemoError("Voting is still open.");
      if (p.executed) throw new DemoError("Already executed.");
      let best = 0n;
      p.votes.forEach((v, i) => {
        if (v > best) {
          best = v;
          p.winningOption = i;
        }
      });
      p.executed = true;
      return SIMULATED;
    });
  },
};

/**
 * Sandbox-only: a brand-new simulated fan backs the drop through `referrer`'s link,
 * so a visitor can watch Attention Mining pay out without a second wallet.
 */
export async function simulateReferredFan(id: number, referrer: Address): Promise<{ amount: bigint }> {
  return mutate(() => {
    const state = load();
    const c = get(id);
    const remaining = c.goal - c.raised;
    if (remaining <= 0n) throw new DemoError("This campaign is already fully funded.");
    const amount = remaining < parseEther("25") ? remaining : parseEther("25");
    applyContribution(c, fan(state.nextFan), amount, referrer);
    state.nextFan += 1;
    return { amount };
  });
}

/** Sandbox-only: the seeded fans vote so a visitor's proposal has a visible tally. */
export async function simulateFanVotes(id: number, proposalId: number): Promise<void> {
  return mutate(() => {
    const c = get(id);
    const p = c.proposals[proposalId];
    if (!p || now() >= p.endTime) throw new DemoError("Voting has closed.");
    c.contributors.forEach((addr, i) => {
      const k = key(addr);
      const weight = c.balances[k] ?? 0n;
      if (k === key(DEMO_ACCOUNT) || p.voters[k] !== undefined || weight === 0n) return;
      const choice = (i * 7 + proposalId) % p.options.length;
      p.voters[k] = choice;
      p.votes[choice] += weight;
      p.totalVotes += weight;
    });
  });
}
