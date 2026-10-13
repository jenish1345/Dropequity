"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parseEther } from "viem";
import { explorerUrl } from "@/lib/chain-source";
import { simulateReferredFan } from "@/lib/demo-source";
import { finePercent, formatAmount, formatShares, isValidCode, percentOf, shortAddress, timeLeft } from "@/lib/format";
import { useAction, useLoad, useNow, useStore } from "@/lib/store";
import { BPS, statusOf, type Campaign, type CampaignStatus, type Position } from "@/lib/types";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { Certificate } from "./Certificate";
import { CopilotAsk } from "./Copilot";
import { Leaderboard } from "./Leaderboard";
import { ProgressRing } from "./ProgressRing";
import { SplitBar } from "./SplitBar";
import { ActionStatus, Button, DemoTag, ErrorBlock, Field, Label, LinkButton, PageSkeleton, PageShell, Panel, Stat } from "./ui";

function parseAmount(v: string): bigint | null {
  try {
    const wei = parseEther(v.trim() as `${number}`);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<CampaignStatus, { text: string; className: string }> = {
  funding: { text: "● Open to back", className: "border-signal text-ink bg-signal-soft" },
  "goal-hit": { text: "✓ Goal hit — ready to unlock", className: "border-go text-ink bg-go-soft" },
  finalized: { text: "✓ Unlocked — revenue split live", className: "border-go text-ink bg-go-soft" },
  expired: { text: "✕ Closed — refunds open", className: "border-stop text-ink bg-stop-soft" },
};

/** Shown in place of an action when live mode has no wallet connected. */
function ConnectGate({ children }: { children: React.ReactNode }) {
  const { account, connect, connecting } = useStore();
  if (account) return <>{children}</>;
  return (
    <Button tone="ink" onClick={connect} busy={connecting} busyLabel="Waiting for your passkey…" className="w-full">
      Sign in with passkey to continue
    </Button>
  );
}

function ContributePanel({
  campaign,
  initialRef,
  action,
}: {
  campaign: Campaign;
  initialRef: string;
  action: ReturnType<typeof useAction>;
}) {
  const { account, source } = useStore();
  const [amount, setAmount] = useState("10");
  const [ref, setRef] = useState(initialRef);
  // Adopt the ?ref= value once it has been read from the URL after hydration.
  const [seenRef, setSeenRef] = useState(initialRef);
  if (initialRef !== seenRef) {
    setSeenRef(initialRef);
    setRef(initialRef);
  }

  const wei = parseAmount(amount);
  const remaining = campaign.goal - campaign.raised;
  const accepted = wei === null ? 0n : wei > remaining ? remaining : wei;
  const shares = (accepted * campaign.contributorPool) / campaign.goal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    if (wei === null) return action.fail("Enter an amount greater than zero.");
    let referrer = null;
    if (ref.trim()) {
      referrer = await source.resolveReferrer(ref).catch(() => null);
      if (!referrer) return action.fail("That referral code isn't registered. Clear it or check the spelling.");
    }
    await action.run(
      "contribute",
      () => source.contribute(account, campaign.id, wei, referrer),
      `You now own a piece of this drop. ${formatShares(shares)} DropShares are yours.`,
    );
  }

  return (
    <Panel tone="white" id="back-form" className="scroll-mt-20">
      <Label as="h2">Back this drop</Label>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Field
          id="amount"
          label="Amount"
          suffix="MON"
          mono
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={`${formatAmount(remaining)} MON left to goal. Anything over the goal is returned.`}
        />
        <Field
          id="referral"
          label="Referral code (optional)"
          mono
          autoComplete="off"
          placeholder="code or 0x address"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          hint="Whoever sent you here earns bonus DropShares from the Attention Pool. It costs you nothing."
        />
        <div className="flex items-baseline justify-between border-y border-ink/10 py-3">
          <Label as="span" className="text-ink/65">
            You receive
          </Label>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatShares(shares)} <span className="text-xs font-normal text-ink/65">DROP</span>
          </span>
        </div>
        <ConnectGate>
          <Button type="submit" tone="signal" className="w-full" busy={action.pending === "contribute"} busyLabel="Securing your DropShares…">
            Back this drop
          </Button>
        </ConnectGate>
      </form>
    </Panel>
  );
}

/**
 * Bonus DropShares with a mint moment: when the number rises, a gold ring pulses out
 * from it and a chip with the newly minted amount lifts away. Transform and opacity only.
 */
function BonusCounter({ shares }: { shares: bigint }) {
  const previous = useRef<bigint | null>(null);
  const [minted, setMinted] = useState<{ id: number; amount: bigint } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = shares;
    if (before === null || shares <= before) return;
    const id = Date.now();
    setMinted({ id, amount: shares - before });
    const timer = setTimeout(() => setMinted((m) => (m?.id === id ? null : m)), 2_200);
    return () => clearTimeout(timer);
  }, [shares]);

  return (
    <span className="relative inline-block">
      <AnimatePresence>
        {minted && (
          <motion.span
            key={`ring-${minted.id}`}
            aria-hidden
            className="absolute -inset-x-3 -inset-y-1 rounded-[8px] border-2 border-gold"
            initial={{ opacity: 0.9, scale: 0.9 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}
        {minted && (
          <motion.span
            key={`chip-${minted.id}`}
            role="status"
            className="absolute -top-7 left-0 whitespace-nowrap rounded-[4px] bg-gold px-1.5 py-0.5 text-[11px] font-semibold text-ink"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, times: [0, 0.15, 0.75, 1] }}
          >
            +{formatShares(minted.amount)} minted
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span
        key={String(shares)}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative inline-block origin-left"
      >
        +{formatShares(shares)}
      </motion.span>
    </span>
  );
}

function ReferralPanel({ campaign, position, code, open }: { campaign: Campaign; position: Position | null; code: string; open: boolean }) {
  const { account, source, mode, connect } = useStore();
  const action = useAction();
  const [newCode, setNewCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(window.location.origin), []);

  const poolLeft = campaign.attentionPool - campaign.attentionMinted;
  const link = account ? `${origin}/campaign/${campaign.id}?ref=${code || account}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      action.fail("We couldn't copy that for you. Select the link and copy it by hand.");
    }
  }

  return (
    <Panel tone="gold">
      <div className="flex items-center justify-between gap-3">
        <Label as="h2">Attention Mining</Label>
        <DemoTag />
      </div>
      <p className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        Invite fans, earn bonus ownership
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        Every new backer who arrives through your link mints you a {campaign.referralBonusBps / 100}% bonus on their
        DropShares, paid from this drop&apos;s Attention Pool.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3 border-y border-gold py-4">
        <Stat label="Your bonus" value={<BonusCounter shares={position?.bonusShares ?? 0n} />} />
        <Stat label="Converted" value={position?.conversions ?? 0} />
        <Stat label="Pool left" value={formatShares(poolLeft)} sub={`of ${formatShares(campaign.attentionPool)}`} />
      </div>

      {!account ? (
        <Button tone="ink" onClick={connect} className="mt-5 w-full">
          Sign in with passkey to get your link
        </Button>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-ink/65">Your referral link</Label>
            <div className="mt-1.5 flex gap-2">
              <input
                readOnly
                aria-label="Your referral link"
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-[8px] border border-ink/25 bg-white px-3 py-2.5 font-mono text-xs text-ink"
              />
              <Button tone="ink" onClick={copy} aria-live="polite">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {!code && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!isValidCode(newCode)) return action.fail("Codes are 3-20 characters: a-z, 0-9 and hyphens.");
                void action.run("code", () => source.registerCode(account, newCode), `"${newCode}" is yours. Your link just got easier to share.`);
              }}
            >
              <div className="flex-1">
                <Field
                  id="new-code"
                  label="Claim a short code"
                  mono
                  placeholder="your-name"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toLowerCase())}
                />
              </div>
              <Button type="submit" tone="ghost-ink" busy={action.pending === "code"} busyLabel="Claiming…">
                Claim
              </Button>
            </form>
          )}

          {mode === "demo" && open && (
            <div className="rounded-[8px] border border-dashed border-ink/40 p-3">
              <Button
                tone="gold"
                className="w-full !border-ink"
                busy={action.pending === "sim"}
                onClick={() =>
                  void action.run(
                    "sim",
                    async () => {
                      await simulateReferredFan(campaign.id, account);
                      return { simulated: true };
                    },
                    "Your link just converted. Bonus DropShares are yours.",
                  )
                }
              >
                Simulate a referred fan
              </Button>
              <p className="mt-2 text-xs text-ink/65">
                Sandbox only: a simulated fan contributes up to 25 MON via your link so you can watch the bonus land.
              </p>
            </div>
          )}
          {mode === "live" && (
            <p className="text-xs text-ink/65">
              To try it yourself, open your link in another browser profile, create a second passkey account there and back the drop.
            </p>
          )}
        </div>
      )}
      <ActionStatus state={action} className="mt-4" />
    </Panel>
  );
}

function RevenuePanel({ campaign, position, creatorClaimable }: { campaign: Campaign; position: Position | null; creatorClaimable: bigint }) {
  const { account, source, mode } = useStore();
  const action = useAction();
  const [amount, setAmount] = useState("100");
  const fanPercent = campaign.fanShareBps / 100;
  const isCreator = account?.toLowerCase() === campaign.creator.toLowerCase();
  const fanPaid = (campaign.totalRevenue * BigInt(campaign.fanShareBps)) / BPS;

  return (
    <Panel tone="paper" className="lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <Label as="h2">Revenue split</Label>
        <DemoTag />
      </div>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <SplitBar fanPercent={fanPercent} />
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-ink/10 pt-4">
            <Stat label="Revenue in" value={`${formatAmount(campaign.totalRevenue)} MON`} />
            <Stat label="To fan pool" value={`${formatAmount(fanPaid)} MON`} />
            <Stat label="Your claimable" value={`${formatAmount(position?.claimable ?? 0n, 4)} MON`} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <ConnectGate>
              <Button
                tone="signal"
                disabled={!position || position.claimable === 0n}
                busy={action.pending === "claim"}
                busyLabel="Sending your share…"
                onClick={() => account && void action.run("claim", () => source.claimRevenue(account, campaign.id), "Your share is in your account. Enjoy it.")}
              >
                Claim my share
              </Button>
            </ConnectGate>
            {isCreator && (
              <Button
                tone="ghost-ink"
                disabled={creatorClaimable === 0n}
                busy={action.pending === "withdraw"}
                onClick={() => account && void action.run("withdraw", () => source.withdrawCreatorRevenue(account, campaign.id), "Creator revenue is in your account.")}
              >
                Withdraw creator {formatAmount(creatorClaimable)} MON
              </Button>
            )}
            <Link
              href={`/governance/${campaign.id}`}
              className="inline-flex min-h-11 items-center font-semibold text-signal underline underline-offset-4 hover:text-ink"
            >
              Vote on what drops next →
            </Link>
          </div>
        </div>

        <form
          className="space-y-3 rounded-[8px] border border-ink/15 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const wei = parseAmount(amount);
            if (!account) return;
            if (wei === null) return action.fail("Enter an amount greater than zero.");
            void action.run(
              "revenue",
              () => source.distributeRevenue(account, campaign.id, wei),
              `${formatAmount(wei)} MON split between the creator and every shareholder.`,
            );
          }}
        >
          <Label as="h3">{mode === "demo" ? "Simulate release revenue" : "Send release revenue"}</Label>
          <p className="text-xs leading-relaxed text-ink/65">
            Anyone can pay revenue into the split. {fanPercent}% goes to DropShare holders pro-rata, the rest to the
            creator.
          </p>
          <Field id="revenue" label="Amount" suffix="MON" mono inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <ConnectGate>
            <Button type="submit" tone="ghost-ink" className="w-full" busy={action.pending === "revenue"} busyLabel="Splitting the revenue…">
              Distribute revenue
            </Button>
          </ConnectGate>
        </form>
      </div>
      <ActionStatus state={action} className="mt-4" />
    </Panel>
  );
}

/** Small screens: keeps the primary action in reach whenever the contribute form is off screen. */
function MobileBackBar({ percent, remaining }: { percent: number; remaining: bigint }) {
  const [formVisible, setFormVisible] = useState(true);

  useEffect(() => {
    const form = document.getElementById("back-form");
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={formVisible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-paper/15 bg-ink px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-300 lg:hidden ${
        formVisible ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <p className="min-w-0 flex-1 font-mono text-xs leading-tight text-paper">
          <span className="block font-semibold">{percent}% funded</span>
          <span className="text-paper/70">{formatAmount(remaining)} MON to go</span>
        </p>
        <Button
          tone="signal"
          tabIndex={formVisible ? -1 : 0}
          className="hover:!border-paper hover:!bg-paper hover:!text-ink"
          onClick={() => {
            document.getElementById("back-form")?.scrollIntoView({ block: "center" });
            document.getElementById("amount")?.focus({ preventScroll: true });
          }}
        >
          Back this drop
        </Button>
      </div>
    </div>
  );
}

export function CampaignView({ id }: { id: number }) {
  const { account, source, mode, refresh } = useStore();
  const now = useNow();
  const action = useAction();
  const [initialRef, setInitialRef] = useState("");

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ref) setInitialRef(ref.slice(0, 42));
  }, []);

  const campaign = useLoad((s) => s.getCampaign(id), [id]);
  const board = useLoad((s) => s.getLeaderboard(id), [id]);
  const mine = useLoad(
    async (s) => {
      if (!account) return { position: null, code: "" };
      const [position, code] = await Promise.all([s.getPosition(id, account), s.getCode(account)]);
      return { position, code };
    },
    [id, account],
  );
  const creatorClaimable = useLoad((s) => s.getCreatorClaimable(id), [id]);
  const proposals = useLoad((s) => s.getProposals(id, null).catch(() => []), [id]);

  if (campaign.loading && campaign.data === undefined) {
    return (
      <PageShell>
        <PageSkeleton label="Setting the stage…" />
      </PageShell>
    );
  }
  if (campaign.error && !campaign.data) {
    return (
      <PageShell>
        <ErrorBlock message={campaign.error} onRetry={refresh} />
      </PageShell>
    );
  }
  const c = campaign.data;
  if (!c) {
    return (
      <PageShell>
        <Label className="text-paper/70">Campaign {id}</Label>
        <h1 className="mt-3 font-display text-4xl font-bold">This drop doesn&apos;t exist yet.</h1>
        <LinkButton href="/dashboard" tone="paper" className="mt-6">
          Explore campaigns
        </LinkButton>
      </PageShell>
    );
  }

  const status = statusOf(c, now);
  const percent = percentOf(c.raised, c.goal);
  const position = mine.data?.position ?? null;
  const code = mine.data?.code ?? "";
  const progressLine =
    status === "funding"
      ? `${percent}% funded — ${timeLeft(c.deadline, now)}`
      : status === "expired"
        ? `${percent}% funded — deadline passed`
        : "100% funded — goal reached";

  return (
    <PageShell>
      <header className="on-ink">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-paper/70">
            {c.meta.kind} / {c.meta.creatorName}
          </Label>
          <span className={`rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_LABEL[status].className}`}>
            {STATUS_LABEL[status].text}
          </span>
          <DemoTag className="text-paper" />
        </div>
        <h1 className="mt-4 font-display break-words text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.01em]">
          {c.meta.title}
        </h1>
        {c.meta.tagline && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper/70">{c.meta.tagline}</p>}
        <p className="mt-3 font-mono text-xs text-paper/65">
          Campaign{" "}
          {mode === "live" ? (
            <a className="underline hover:text-paper" href={`${explorerUrl}/address/${c.address}`} target="_blank" rel="noreferrer">
              {shortAddress(c.address)}
            </a>
          ) : (
            `${shortAddress(c.address)} (simulated)`
          )}{" "}
          · Creator {shortAddress(c.creator)}
        </p>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Panel tone="paper">
          <div className="flex items-center justify-between gap-3">
            <Label as="h2">Funding progress</Label>
            <DemoTag />
          </div>
          <div className="mt-6">
            <ProgressRing
              percent={percent}
              tone={status === "expired" ? "stop" : status === "funding" ? "signal" : "go"}
              label={`Funding progress: ${progressLine}`}
            >
              <span className="font-display text-6xl font-bold leading-none tracking-tight">{percent}%</span>
              <Label as="span" className="mt-1 text-ink/65">
                funded
              </Label>
            </ProgressRing>
          </div>
          <p className="mt-5 text-center font-mono text-sm font-medium">{progressLine}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink/10 pt-5 sm:grid-cols-4">
            <Stat label="Raised" value={formatAmount(c.raised)} sub={`of ${formatAmount(c.goal)} MON`} />
            <Stat label="Backers" value={c.contributorCount} />
            <Stat label="Fan pool" value={`${c.fanShareBps / 100}%`} sub="of revenue" />
            <Stat label="Attention pool" value={`${percentOf(c.attentionPool, c.contributorPool + c.attentionPool)}%`} sub="of shares" />
          </div>
        </Panel>

        <div className="space-y-5">
          {status === "funding" && <ContributePanel campaign={c} initialRef={initialRef} action={action} />}

          {status === "goal-hit" && (
            <Panel tone="white" className="border-l-2 !border-l-go">
              <Label as="h2">✓ Goal hit</Label>
              <p className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">Unlock the release.</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">
                Fans did it. Unlocking sends the raise to the creator, locks in who owns what, and switches on the
                revenue split. Anyone can do the honours.
              </p>
              <div className="mt-5">
                <ConnectGate>
                  <Button
                    tone="signal"
                    className="w-full"
                    busy={action.pending === "finalize"}
                    busyLabel="Unlocking the release…"
                    onClick={() => account && void action.run("finalize", () => source.finalize(account, id), "The drop is unlocked. The revenue split is live.")}
                  >
                    Unlock this drop
                  </Button>
                </ConnectGate>
              </div>
            </Panel>
          )}

          {status === "expired" && (
            <Panel tone="white" className="border-l-2 !border-l-stop">
              <Label as="h2">✕ Goal missed</Label>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                This drop closed short of its goal. Every backer can take their contribution back in full.
              </p>
              <div className="mt-5">
                <ConnectGate>
                  <Button
                    tone="ink"
                    className="w-full"
                    disabled={!position || position.contributed === 0n}
                    busy={action.pending === "refund"}
                    busyLabel="Returning your contribution…"
                    onClick={() => account && void action.run("refund", () => source.refund(account, id), "Your contribution is back in your account.")}
                  >
                    Take back {formatAmount(position?.contributed ?? 0n)} MON
                  </Button>
                </ConnectGate>
              </div>
            </Panel>
          )}

          <ActionStatus state={action} />

          <Panel tone="white">
            <div className="flex items-center justify-between gap-3">
              <Label as="h2">Your stake</Label>
              <DemoTag />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat label="Contributed" value={formatAmount(position?.contributed ?? 0n)} sub="MON" />
              <Stat label="DropShares" value={formatShares(position?.shares ?? 0n)} />
              <Stat label="Fan pool claim" value={`${finePercent(position?.shares ?? 0n, c.totalSupply)}%`} />
            </div>
          </Panel>
        </div>

        {status === "finalized" && (
          <RevenuePanel campaign={c} position={position} creatorClaimable={creatorClaimable.data ?? 0n} />
        )}

        <ReferralPanel campaign={c} position={position} code={code} open={status === "funding"} />

        <Panel tone="white">
          <Leaderboard rows={board.data ?? []} loading={board.loading && !board.data} account={account} />
        </Panel>

        <AnalyticsPanel campaign={c} />

        <CopilotAsk campaign={c} position={position} proposals={proposals.data ?? []} now={now} />

        {position && position.shares > 0n && account && (
          <div className="lg:col-span-2">
            <Label className="mb-3 text-paper/70">Your certificate</Label>
            <Certificate
              className="max-w-2xl"
              title={c.meta.title}
              creator={c.meta.creatorName}
              holder={account}
              shares={formatShares(position.shares)}
              claim={`${finePercent(position.shares, c.totalSupply)}%`}
              bonus={`+${formatShares(position.bonusShares)}`}
              serial={String(c.id + 1).padStart(6, "0")}
              stamp={mode === "demo" ? "Sandbox · demo data" : "Testnet · demo data"}
            />
          </div>
        )}
      </div>

      {status === "funding" && <MobileBackBar percent={percent} remaining={c.goal - c.raised} />}

      <p className={`mt-10 text-sm text-paper/65 ${status === "funding" ? "max-lg:pb-20" : ""}`}>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center underline hover:text-paper">
          ← All campaigns
        </Link>
      </p>
    </PageShell>
  );
}
