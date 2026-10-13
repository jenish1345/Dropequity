/**
 * DropOwn demo seeding for Monad Testnet.
 *
 *   forge build && npm run seed            deploy + seed (needs DEPLOYER_PRIVATE_KEY in .env.local)
 *   npm run seed -- --dry-run              print the plan, touch nothing
 *
 * What it does, in order:
 *   1. Deploys DropOwnFactory (which deploys the ReferralRegistry).
 *   2. Creates two campaigns: one near its goal, one just launched.
 *   3. Generates throwaway fan wallets in memory, funds them from the deployer,
 *      registers referral codes and makes 8 contributions, 5 of them referred.
 *   4. Writes the deployed addresses to src/config/deployments.json and indexer/config.yaml.
 *
 * Everything this creates is DEMO DATA on a testnet. The fan wallets' keys are never
 * printed or written to disk; whatever dust they hold afterwards is abandoned.
 * Run this yourself with a throwaway, testnet-only key. Never use a key that holds real funds.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  parseEventLogs,
  type Abi,
  type Account,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { campaignAbi, factoryAbi, registryAbi } from "../src/lib/abi";
import { encodeMeta } from "../src/lib/format";
import type { CampaignMeta } from "../src/lib/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");

/** Gas allowance sent to each fan wallet on top of what it contributes. */
const FAN_GAS_BUFFER = parseEther("0.08");

type CampaignPlan = {
  meta: CampaignMeta;
  goal: string;
  fanSharePercent: number;
  attentionPoolPercent: number;
  days: number;
  /** [fan code, amount in MON, referrer code or null] */
  contributions: [string, string, string | null][];
};

const PLAN: CampaignPlan[] = [
  {
    meta: {
      title: "Midnight Static",
      tagline: "A late-night synth single, mastered and pressed by the people who heard it first.",
      kind: "Song",
      creatorName: "Lumen Arcade (demo)",
    },
    goal: "1",
    fanSharePercent: 20,
    attentionPoolPercent: 10,
    days: 3,
    contributions: [
      ["nova", "0.22", null],
      ["kairo", "0.14", "nova"],
      ["juno", "0.12", "nova"],
      ["sable", "0.08", "kairo"],
      ["indie", "0.06", null],
      ["rhea", "0.06", "nova"],
      ["otto", "0.04", "juno"],
    ],
  },
  {
    meta: {
      title: "Paper Suns",
      tagline: "Forty risograph prints, one generative sibling each. The edition opens when the goal does.",
      kind: "Art drop",
      creatorName: "Studio Halcyon (demo)",
    },
    goal: "5",
    fanSharePercent: 25,
    attentionPoolPercent: 10,
    days: 21,
    contributions: [["mira", "0.1", null]],
  },
];

function loadEnvFile() {
  const file = resolve(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function printPlan() {
  const fans = new Set(PLAN.flatMap((c) => c.contributions.map(([code]) => code)));
  const contributed = PLAN.flatMap((c) => c.contributions).reduce((sum, [, amount]) => sum + parseEther(amount), 0n);
  const referred = PLAN.flatMap((c) => c.contributions).filter(([, , ref]) => ref).length;

  console.log("DropOwn seed plan — DEMO DATA, Monad Testnet (chain 10143)\n");
  for (const c of PLAN) {
    const raised = c.contributions.reduce((sum, [, amount]) => sum + parseEther(amount), 0n);
    const pct = Number((raised * 100n) / parseEther(c.goal));
    console.log(`  ${c.meta.title}: goal ${c.goal} MON, ${c.contributions.length} contributions -> ${pct}% funded`);
  }
  console.log(`\n  ${fans.size} throwaway fan wallets, ${referred} referral conversions`);
  console.log(`  Contributions total ${formatEther(contributed)} MON`);
  console.log(`  Fan gas buffers     ${formatEther(FAN_GAS_BUFFER * BigInt(fans.size))} MON`);
  console.log("  Plus deployment gas. Fund the deployer with about 2.5 testnet MON.\n");
  return { fans: [...fans], contributed };
}

async function main() {
  loadEnvFile();
  const { fans: fanCodes, contributed } = printPlan();

  if (DRY_RUN) {
    console.log("Dry run: nothing was deployed, signed or sent.");
    return;
  }

  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY (0x + 64 hex chars) in .env.local. Use a throwaway testnet-only key.");
  }
  const artifactPath = resolve(ROOT, "out/DropOwnFactory.sol/DropOwnFactory.json");
  if (!existsSync(artifactPath)) throw new Error("Contract artifacts not found. Run `forge build` first.");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: Abi; bytecode: { object: Hex } };

  const transport = http(process.env.MONAD_RPC_URL || undefined);
  const publicClient = createPublicClient({ chain: monadTestnet, transport });

  // Hard stop on anything that isn't Monad Testnet, whatever the RPC URL says.
  const chainId = await publicClient.getChainId();
  if (chainId !== monadTestnet.id) throw new Error(`Refusing to run: RPC reports chain ${chainId}, expected ${monadTestnet.id}.`);

  const deployer = privateKeyToAccount(key as Hex);
  const walletFor = (account: Account) => createWalletClient({ account, chain: monadTestnet, transport });
  const deployerWallet = walletFor(deployer);

  const confirm = async (hash: Hex, what: string) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${what} reverted (${hash})`);
    console.log(`  ok  ${what}`);
    return receipt;
  };

  const balance = await publicClient.getBalance({ address: deployer.address });
  const needed = contributed + FAN_GAS_BUFFER * BigInt(fanCodes.length) + parseEther("1");
  console.log(`Deployer ${deployer.address} holds ${formatEther(balance)} MON`);
  if (balance < needed) {
    throw new Error(`Deployer needs roughly ${formatEther(needed)} MON. Top up from the Monad testnet faucet and retry.`);
  }

  // 1. Deploy
  const votingPeriod = BigInt(process.env.VOTING_PERIOD || "600");
  console.log("\nDeploying");
  const deployHash = await deployerWallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [votingPeriod],
  });
  const deployReceipt = await confirm(deployHash, "DropOwnFactory");
  const factory = deployReceipt.contractAddress as Address;
  const registry = await publicClient.readContract({ address: factory, abi: factoryAbi, functionName: "registry" });
  console.log(`  factory  ${factory}\n  registry ${registry}`);

  // 2. Campaigns
  console.log("\nCreating campaigns");
  const campaigns: Address[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (const plan of PLAN) {
    const hash = await deployerWallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createCampaign",
      args: [
        parseEther(plan.goal),
        BigInt(plan.fanSharePercent),
        BigInt(plan.attentionPoolPercent),
        BigInt(now + plan.days * 86_400),
        encodeMeta(plan.meta),
      ],
    });
    const receipt = await confirm(hash, `campaign "${plan.meta.title}"`);
    const [created] = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: "CampaignCreated" });
    campaigns.push(created.args.campaign);
  }

  // 3. Fans: in-memory wallets only.
  console.log("\nFunding fan wallets and registering codes");
  const fans = new Map(fanCodes.map((code) => [code, privateKeyToAccount(generatePrivateKey())]));
  for (const [code, account] of fans) {
    const spend = PLAN.flatMap((c) => c.contributions)
      .filter(([who]) => who === code)
      .reduce((sum, [, amount]) => sum + parseEther(amount), 0n);
    await confirm(
      await deployerWallet.sendTransaction({ to: account.address, value: spend + FAN_GAS_BUFFER, gas: 60_000n }),
      `fund ${code}`,
    );
    await confirm(
      await walletFor(account).writeContract({ address: registry, abi: registryAbi, functionName: "registerCode", args: [code] }),
      `register code "${code}"`,
    );
  }

  console.log("\nContributing");
  for (const [i, plan] of PLAN.entries()) {
    for (const [code, amount, ref] of plan.contributions) {
      const referrer = ref ? fans.get(ref)!.address : "0x0000000000000000000000000000000000000000";
      await confirm(
        await walletFor(fans.get(code)!).writeContract({
          address: campaigns[i],
          abi: campaignAbi,
          functionName: "contribute",
          args: [referrer],
          value: parseEther(amount),
        }),
        `${code} backs "${plan.meta.title}" with ${amount} MON${ref ? ` via ${ref}` : ""}`,
      );
    }
  }

  // 4. Config for the frontend
  const config = {
    chainId: monadTestnet.id,
    factory,
    registry,
    votingPeriod: Number(votingPeriod),
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(ROOT, "src/config/deployments.json"), JSON.stringify(config, null, 2) + "\n");

  // Point the Envio indexer at the new factory, starting from its deployment block.
  const indexerConfig = resolve(ROOT, "indexer/config.yaml");
  if (existsSync(indexerConfig)) {
    const yaml = readFileSync(indexerConfig, "utf8")
      .replace(/start_block: \d+/, `start_block: ${deployReceipt.blockNumber}`)
      .replace(/(- name: DropOwnFactory\s+address: )"0x[0-9a-fA-F]{40}"/, `$1"${factory}"`);
    writeFileSync(indexerConfig, yaml);
    console.log(`  indexer/config.yaml -> factory ${factory}, start_block ${deployReceipt.blockNumber}`);
  }

  console.log("\nDone. Addresses written to src/config/deployments.json:");
  console.log(config);
  campaigns.forEach((address, i) => console.log(`  campaign ${i}  ${address}`));
  console.log("\nRebuild or redeploy the frontend to switch it from the sandbox to live mode.");
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
