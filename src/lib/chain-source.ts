import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Abi,
  type LocalAccount,
} from "viem";
import { monadTestnet } from "viem/chains";
import deployments from "@/config/deployments.json";
import { campaignAbi, factoryAbi, governanceAbi, registryAbi } from "./abi";
import { envioEnabled, fetchActivity, fetchCampaignLeaderboard, fetchGlobalLeaderboard } from "./envio";
import { decodeMeta, encodeMeta, isAddress } from "./format";
import {
  ZERO_ADDRESS,
  type Address,
  type Campaign,
  type DataSource,
  type LeaderRow,
  type Proposal,
  type TxResult,
} from "./types";

/** Live mode: reads from Monad Testnet over public RPC, writes signed by the visitor's Mera passkey account. */

const config = deployments as {
  chainId: number;
  factory: string | null;
  registry: string | null;
  votingPeriod: number;
};

export const liveAvailable = Boolean(config.factory && config.registry);
export const explorerUrl = monadTestnet.blockExplorers.default.url;

const factory = (config.factory ?? ZERO_ADDRESS) as Address;
const registry = (config.registry ?? ZERO_ADDRESS) as Address;

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(undefined, { batch: true }),
});

let signer: LocalAccount | null = null;

/** The unlocked Mera passkey account, or null. Set by the store; the key never leaves the signing session. */
export function setSigner(account: LocalAccount | null) {
  signer = account;
}

export async function getBalance(address: Address): Promise<bigint> {
  return publicClient.getBalance({ address });
}

type WriteArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/** Signed in this tab by the passkey-derived account and sent straight to the RPC. No extension, no relayer. */
async function send(account: Address, call: WriteArgs) {
  if (!signer || signer.address.toLowerCase() !== account.toLowerCase()) {
    throw new Error("Unlock your passkey account to continue.");
  }
  const wallet = createWalletClient({ account: signer, chain: monadTestnet, transport: http() });
  const hash = await wallet.writeContract({ ...call, account: signer, chain: monadTestnet });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction reverted.");
  return receipt;
}

async function write(account: Address, call: WriteArgs): Promise<TxResult> {
  const receipt = await send(account, call);
  return { hash: receipt.transactionHash, simulated: false };
}

async function campaignAddresses(): Promise<readonly Address[]> {
  return publicClient.readContract({ address: factory, abi: factoryAbi, functionName: "getCampaigns" });
}

async function addressOf(id: number): Promise<Address> {
  const all = await campaignAddresses();
  const address = all[id];
  if (!address) throw new Error("Campaign not found.");
  return address;
}

async function readCampaign(id: number, address: Address): Promise<Campaign> {
  const [s, governance] = await Promise.all([
    publicClient.readContract({ address, abi: campaignAbi, functionName: "getSummary" }),
    publicClient.readContract({ address: factory, abi: factoryAbi, functionName: "governanceOf", args: [address] }),
  ]);
  return {
    id,
    address,
    governance,
    creator: s.creator,
    meta: decodeMeta(s.metadataURI),
    goal: s.goal,
    raised: s.totalRaised,
    deadline: Number(s.deadline),
    fanShareBps: Number(s.fanShareBps),
    referralBonusBps: Number(s.referralBonusBps),
    contributorPool: s.contributorPool,
    attentionPool: s.attentionPool,
    attentionMinted: s.attentionMinted,
    totalSupply: s.totalSupply,
    totalRevenue: s.totalRevenue,
    contributorCount: Number(s.contributorCount),
    finalized: s.finalized,
  };
}

async function withCodes(
  rows: readonly [readonly Address[], readonly bigint[], readonly bigint[]],
): Promise<LeaderRow[]> {
  const [referrers, conversions, bonusShares] = rows;
  const codes = await Promise.all(
    referrers.map((r) =>
      publicClient.readContract({ address: registry, abi: registryAbi, functionName: "codeOf", args: [r] }),
    ),
  );
  return referrers.map((referrer, i) => ({
    referrer,
    conversions: Number(conversions[i]),
    bonusShares: bonusShares[i],
    code: codes[i] || undefined,
  }));
}

async function attachCodes(rows: LeaderRow[]): Promise<LeaderRow[]> {
  const codes = await Promise.all(
    rows.map((r) =>
      publicClient.readContract({ address: registry, abi: registryAbi, functionName: "codeOf", args: [r.referrer] }),
    ),
  );
  return rows.map((row, i) => ({ ...row, code: codes[i] || undefined }));
}

async function governanceOf(id: number): Promise<Address> {
  const address = await addressOf(id);
  return publicClient.readContract({ address: factory, abi: factoryAbi, functionName: "governanceOf", args: [address] });
}

export const chainSource: DataSource = {
  mode: "live",

  async votingPeriod() {
    return config.votingPeriod;
  },

  async listCampaigns() {
    const all = await campaignAddresses();
    return Promise.all(all.map((address, id) => readCampaign(id, address)));
  },

  async getCampaign(id) {
    const all = await campaignAddresses();
    return all[id] ? readCampaign(id, all[id]) : null;
  },

  async getPosition(id, account) {
    const address = await addressOf(id);
    const [contributed, shares, bonusShares, conversions, claimable] = await publicClient.readContract({
      address,
      abi: campaignAbi,
      functionName: "positionOf",
      args: [account],
    });
    return { contributed, shares, bonusShares, conversions: Number(conversions), claimable };
  },

  async getCreatorClaimable(id) {
    const address = await addressOf(id);
    return publicClient.readContract({ address, abi: campaignAbi, functionName: "creatorClaimable" });
  },

  async getLeaderboard(id) {
    const address = await addressOf(id);
    // With an indexer configured, the leaderboard is built from indexed ReferralRewarded events.
    if (envioEnabled) return attachCodes(await fetchCampaignLeaderboard(address));
    return withCodes(await publicClient.readContract({ address, abi: campaignAbi, functionName: "getLeaderboard" }));
  },

  async getActivity(id) {
    if (!envioEnabled) {
      return { source: "unavailable", events: [], revenue: { total: 0n, fanCut: 0n, creatorCut: 0n, fanClaimed: 0n } };
    }
    return fetchActivity(await addressOf(id));
  },

  async getGlobalLeaderboard() {
    if (envioEnabled) return attachCodes(await fetchGlobalLeaderboard());
    return withCodes(
      await publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getLeaderboard" }),
    );
  },

  async getCode(account) {
    return publicClient.readContract({ address: registry, abi: registryAbi, functionName: "codeOf", args: [account] });
  },

  async resolveReferrer(input) {
    const v = input.trim();
    if (!v) return null;
    if (isAddress(v)) return v;
    const owner = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "referrerOf",
      args: [v.toLowerCase()],
    });
    return owner === ZERO_ADDRESS ? null : owner;
  },

  registerCode(account, code) {
    return write(account, { address: registry, abi: registryAbi, functionName: "registerCode", args: [code] });
  },

  async createCampaign(account, input) {
    const receipt = await send(account, {
      address: factory,
      abi: factoryAbi,
      functionName: "createCampaign",
      args: [
        input.goal,
        BigInt(input.fanSharePercent),
        BigInt(input.attentionPoolPercent),
        BigInt(input.deadline),
        encodeMeta(input.meta),
      ],
    });
    const [created] = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: "CampaignCreated" });
    if (!created) throw new Error("Campaign was created but its id could not be read. Check the dashboard.");
    return { hash: receipt.transactionHash, simulated: false, id: Number(created.args.campaignId) };
  },

  async contribute(account, id, amount, referrer) {
    return write(account, {
      address: await addressOf(id),
      abi: campaignAbi,
      functionName: "contribute",
      args: [referrer ?? ZERO_ADDRESS],
      value: amount,
    });
  },

  async finalize(account, id) {
    return write(account, { address: await addressOf(id), abi: campaignAbi, functionName: "finalizeCampaign" });
  },

  async refund(account, id) {
    return write(account, { address: await addressOf(id), abi: campaignAbi, functionName: "refund" });
  },

  async distributeRevenue(account, id, amount) {
    return write(account, {
      address: await addressOf(id),
      abi: campaignAbi,
      functionName: "distributeRevenue",
      value: amount,
    });
  },

  async claimRevenue(account, id) {
    return write(account, { address: await addressOf(id), abi: campaignAbi, functionName: "claimRevenue" });
  },

  async withdrawCreatorRevenue(account, id) {
    return write(account, { address: await addressOf(id), abi: campaignAbi, functionName: "withdrawCreatorRevenue" });
  },

  async getProposals(id, account) {
    const address = await governanceOf(id);
    const count = Number(
      await publicClient.readContract({ address, abi: governanceAbi, functionName: "proposalCount" }),
    );
    return Promise.all(
      Array.from({ length: count }, async (_, i): Promise<Proposal> => {
        const [p, vote] = await Promise.all([
          publicClient.readContract({ address, abi: governanceAbi, functionName: "getProposal", args: [BigInt(i)] }),
          account
            ? publicClient.readContract({
                address,
                abi: governanceAbi,
                functionName: "voteOf",
                args: [BigInt(i), account],
              })
            : Promise.resolve(0n),
        ]);
        return {
          id: i,
          proposer: p.proposer,
          description: p.description,
          options: [...p.options],
          votes: [...p.votes],
          startTime: Number(p.startTime),
          endTime: Number(p.endTime),
          totalVotes: p.totalVotes,
          executed: p.executed,
          winningOption: Number(p.winningOption),
          myVote: vote > 0n ? Number(vote) - 1 : null,
        };
      }),
    );
  },

  async createProposal(account, id, description, options) {
    return write(account, {
      address: await governanceOf(id),
      abi: governanceAbi,
      functionName: "createProposal",
      args: [description, options],
    });
  },

  async castVote(account, id, proposalId, optionIndex) {
    return write(account, {
      address: await governanceOf(id),
      abi: governanceAbi,
      functionName: "castVote",
      args: [BigInt(proposalId), BigInt(optionIndex)],
    });
  },

  async executeProposal(account, id, proposalId) {
    return write(account, {
      address: await governanceOf(id),
      abi: governanceAbi,
      functionName: "executeProposal",
      args: [BigInt(proposalId)],
    });
  },
};
