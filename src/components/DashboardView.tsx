"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { countdown, finePercent, formatAmount, formatShares, percentOf, timeLeft } from "@/lib/format";
import { useLoad, useNow, useStore } from "@/lib/store";
import { statusOf, type Campaign, type Position, type Proposal } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";
import { Button, DemoTag, EmptyState, ErrorBlock, Label, LinkButton, PageShell, Panel, Skeleton } from "./ui";

const STATUS_TEXT = { funding: "Funding", "goal-hit": "Goal hit", finalized: "Unlocked", expired: "Closed" } as const;
const STATUS_MARK = { funding: "bg-signal", "goal-hit": "bg-go", finalized: "bg-go", expired: "bg-stop" } as const;

const textLink = "font-medium text-signal underline underline-offset-2 hover:text-ink";

function CampaignCard({ campaign, now, index }: { campaign: Campaign; now: number; index: number }) {
  const status = statusOf(campaign, now);
  const percent = percentOf(campaign.raised, campaign.goal);

  return (
    <motion.li initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.08 }}>
      <Link
        href={`/campaign/${campaign.id}`}
        className="group flex h-full flex-col rounded-[10px] border border-ink/10 bg-paper p-5 text-ink shadow-drop transition-colors hover:border-signal sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <Label className="text-ink/65">
            {campaign.meta.kind} / {campaign.meta.creatorName}
          </Label>
          <Label className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-[2px] ${STATUS_MARK[status]}`} />
            {STATUS_TEXT[status]}
          </Label>
        </div>
        <h3 className="mt-4 font-display text-4xl font-bold leading-none tracking-tight group-hover:text-signal">
          {campaign.meta.title}
        </h3>
        <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-ink/65">{campaign.meta.tagline}</p>

        <div className="mt-6 h-2 overflow-hidden rounded-[3px] bg-ink/10" aria-hidden>
          <motion.div
            className={`h-full w-full origin-left ${STATUS_MARK[status]}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: percent / 100 }}
            transition={{ duration: 0.8, delay: 0.2 + index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-sm">
          <span className="font-semibold">
            {percent}% funded{status === "funding" && ` — ${timeLeft(campaign.deadline, now)}`}
          </span>
          <span className="tabular-nums text-ink/65">
            {formatAmount(campaign.raised)} / {formatAmount(campaign.goal)} MON
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

function CardSkeleton() {
  return (
    <li className="rounded-[10px] border border-paper/15 p-6 text-paper/25">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-5 h-9 w-3/4" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-8 h-2 w-full" />
      <Skeleton className="mt-4 h-3 w-1/2" />
    </li>
  );
}

function RowsSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-4 space-y-3 text-ink/15" role="status">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

type Vote = { campaign: Campaign; proposal: Proposal };

export function DashboardView() {
  const { account, connect, connecting, mode, refresh } = useStore();
  const now = useNow();
  const campaigns = useLoad((s) => s.listCampaigns(), []);
  const global = useLoad((s) => s.getGlobalLeaderboard(), []);
  const positions = useLoad(
    async (s): Promise<{ campaign: Campaign; position: Position }[]> => {
      if (!account) return [];
      const all = await s.listCampaigns();
      const rows = await Promise.all(all.map(async (campaign) => ({ campaign, position: await s.getPosition(campaign.id, account) })));
      return rows.filter((r) => r.position.shares > 0n || r.position.contributed > 0n);
    },
    [account],
  );
  const votes = useLoad(
    async (s): Promise<Vote[]> => {
      const unlocked = (await s.listCampaigns()).filter((c) => c.finalized);
      const lists = await Promise.all(
        unlocked.map(async (campaign) => (await s.getProposals(campaign.id, account)).map((proposal) => ({ campaign, proposal }))),
      );
      return lists.flat().sort((a, b) => b.proposal.endTime - a.proposal.endTime);
    },
    [account],
  );

  const list = campaigns.data ?? [];
  const mine = list.filter((c) => account && c.creator.toLowerCase() === account.toLowerCase());
  const pending = (positions.data ?? []).reduce((sum, r) => sum + r.position.claimable, 0n);

  return (
    <PageShell>
      <header className="on-ink flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-paper/70">Dashboard / {mode === "live" ? "Monad Testnet" : "Demo sandbox"}</Label>
            <DemoTag className="text-paper" />
          </div>
          <h1 className="mt-4 font-display break-words text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.01em]">
            Drops in motion.
          </h1>
          <p className="mt-3 max-w-lg text-lg leading-relaxed text-paper/75">
            Back a release, see what you own, and watch who is bringing the crowd.
          </p>
        </div>
        <LinkButton href="/create" tone="paper">
          Launch a campaign
        </LinkButton>
      </header>

      <section aria-labelledby="all-campaigns" className="mt-12">
        <Label as="h2" className="text-paper/70">
          <span id="all-campaigns">Open to back</span>
        </Label>
        {campaigns.loading && !campaigns.data ? (
          <ul className="mt-4 grid gap-5 md:grid-cols-2" aria-label="Lining up the drops…">
            <CardSkeleton />
            <CardSkeleton />
          </ul>
        ) : campaigns.error && !campaigns.data ? (
          <div className="mt-4">
            <ErrorBlock message={campaigns.error} onRetry={refresh} />
          </div>
        ) : list.length === 0 ? (
          <Panel tone="paper" className="mt-4 max-w-xl">
            <EmptyState art="stage" title="The stage is empty.">
              No one has launched a drop here yet. Yours could be the first release fans get to own. Use{" "}
              <span className="font-medium text-ink">Launch a campaign</span> above to open it.
            </EmptyState>
          </Panel>
        ) : (
          <ul className="mt-4 grid gap-5 md:grid-cols-2">
            {list.map((c, i) => (
              <CampaignCard key={c.id} campaign={c} now={now} index={i} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel tone="white" aria-labelledby="my-shares">
          <div className="flex items-center justify-between gap-3">
            <Label as="h2">
              <span id="my-shares">What you own</span>
            </Label>
            <DemoTag />
          </div>

          {!account ? (
            <div className="mt-4">
              <EmptyState
                art="certificate"
                title="Your certificates live here."
                action={
                  <Button tone="ink" onClick={connect} busy={connecting} busyLabel="Waiting for your passkey…">
                    Sign in with passkey
                  </Button>
                }
              >
                Sign in with a passkey to see the drops you co-own and any revenue waiting for you.
              </EmptyState>
            </div>
          ) : positions.loading && !positions.data ? (
            <RowsSkeleton label="Finding your stake…" />
          ) : (positions.data ?? []).length === 0 ? (
            <div className="mt-4">
              <EmptyState art="certificate" title="Your first certificate is one drop away.">
                Back any release above and your DropShares appear here the moment the contribution lands.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-baseline justify-between border-y border-ink/10 py-3">
                <Label as="span" className="text-ink/65">
                  Revenue waiting for you
                </Label>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatAmount(pending, 4)} MON</span>
              </div>
              <ul className="divide-y divide-ink/10">
                {(positions.data ?? []).map(({ campaign, position }) => (
                  <li key={campaign.id}>
                    <Link href={`/campaign/${campaign.id}`} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-4 py-3 hover:text-signal">
                      <span>
                        <span className="block font-display text-xl font-semibold leading-tight">{campaign.meta.title}</span>
                        <span className="font-mono text-xs text-ink/65">
                          {finePercent(position.shares, campaign.totalSupply)}% of fan pool
                          {position.bonusShares > 0n && (
                            <span className="ml-2 rounded-[3px] bg-gold-soft px-1 text-ink">+{formatShares(position.bonusShares)} from attention</span>
                          )}
                        </span>
                        {position.claimable > 0n && (
                          <span className="mt-0.5 block font-mono text-xs font-semibold text-ink">
                            {formatAmount(position.claimable, 4)} MON ready to claim →
                          </span>
                        )}
                      </span>
                      <span className="text-right font-mono">
                        <span className="block text-lg font-semibold tabular-nums">{formatShares(position.shares)}</span>
                        <span className="text-[11px] uppercase tracking-wider text-ink/65">DropShares</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 border-t-2 border-signal pt-4">
            <Label as="h2">Drops you launched</Label>
            {mine.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                Nothing launched from this account yet. Got a release coming?{" "}
                <Link href="/create" className={textLink}>
                  Put it in fans&apos; hands
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-ink/10">
                {mine.map((c) => (
                  <li key={c.id}>
                    <Link href={`/campaign/${c.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-signal">
                      <span className="font-display text-xl font-semibold">{c.meta.title}</span>
                      <span className="font-mono text-sm tabular-nums">
                        {percentOf(c.raised, c.goal)}% funded · {STATUS_TEXT[statusOf(c, now)]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel tone="white">
            <Leaderboard
              rows={global.data ?? []}
              loading={global.loading && !global.data}
              account={account}
              title="Attention Leaderboard — all drops"
              empty="No referral has converted yet. Share a drop and the first spot is yours."
            />
          </Panel>

          <Panel tone="white" aria-labelledby="votes">
            <div className="flex items-center justify-between gap-3">
              <Label as="h2">
                <span id="votes">Votes</span>
              </Label>
              <DemoTag />
            </div>
            {votes.loading && !votes.data ? (
              <RowsSkeleton label="Gathering the votes…" />
            ) : (votes.data ?? []).length === 0 ? (
              <div className="mt-4">
                <EmptyState art="ballot" title="No votes open yet.">
                  Voting opens when a drop hits its goal and unlocks. Shareholders then decide what drops next.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-ink/10">
                {(votes.data ?? []).slice(0, 5).map(({ campaign, proposal }) => {
                  const open = now < proposal.endTime;
                  const state = proposal.executed
                    ? `Decided: ${proposal.options[proposal.winningOption]}`
                    : open
                      ? `Open · ${countdown(proposal.endTime - now)} left`
                      : "Closed · awaiting result";
                  return (
                    <li key={`${campaign.id}-${proposal.id}`}>
                      <Link href={`/governance/${campaign.id}`} className="block min-h-11 py-3 hover:text-signal">
                        <span className="block font-medium leading-snug">{proposal.description}</span>
                        <span className="mt-0.5 block font-mono text-xs text-ink/65">
                          {campaign.meta.title} · {state}
                          {proposal.myVote !== null && ` · you chose ${proposal.options[proposal.myVote]}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
