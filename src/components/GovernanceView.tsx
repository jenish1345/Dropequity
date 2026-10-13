"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { simulateFanVotes } from "@/lib/demo-source";
import { countdown, formatShares, percentOf, shortAddress } from "@/lib/format";
import { useAction, useLoad, useNow, useStore } from "@/lib/store";
import type { Campaign, Proposal } from "@/lib/types";
import { AiAssisted, toCopilotCampaign, toCopilotProposal, useCopilot } from "./Copilot";
import { ActionStatus, Button, DemoTag, EmptyState, ErrorBlock, Field, Label, LinkButton, PageSkeleton, PageShell, Panel } from "./ui";

const EXAMPLES: { question: string; options: string[] }[] = [
  { question: "Which bonus track releases first?", options: ["Glass Hours", "Low Tide Radio", "Static (demo take)"] },
  { question: "Cover art direction A or B?", options: ["Direction A", "Direction B"] },
];

function listOptions(options: string[]): string {
  if (options.length <= 2) return options.join(" and ");
  return `${options.slice(0, -1).join(", ")} and ${options[options.length - 1]}`;
}

/** A one-paragraph, plain-English read of where a proposal stands. Computed, not generated. */
function plainSummary(p: Proposal, now: number): string {
  const leading = p.votes.reduce((best, v, i) => (v > p.votes[best] ? i : best), 0);
  const share = percentOf(p.votes[leading], p.totalVotes);
  if (p.executed) {
    return p.totalVotes === 0n
      ? `Closed with no votes cast, so the first option, ${p.options[p.winningOption]}, stands.`
      : `Decided. ${p.options[p.winningOption]} won with ${percentOf(p.votes[p.winningOption], p.totalVotes)}% of the shares that voted.`;
  }
  if (now >= p.endTime) {
    return p.totalVotes === 0n
      ? "Voting has closed without any votes. Recording the result will close it out."
      : `Voting has closed with ${p.options[leading]} ahead on ${share}%. Record the result to make it official.`;
  }
  if (p.totalVotes === 0n) {
    return `Shareholders are choosing between ${listOptions(p.options)}. No one has voted yet, so yours could be the first.`;
  }
  return `Shareholders are choosing between ${listOptions(p.options)}. ${p.options[leading]} leads with ${share}% of the shares voted so far.`;
}

function ProposalCard({ campaign, proposal, weight, now }: { campaign: Campaign; proposal: Proposal; weight: bigint; now: number }) {
  const campaignId = campaign.id;
  const { account, source, mode, connect, connecting } = useStore();
  const action = useAction();
  const copilot = useCopilot();
  const [summary, setSummary] = useState<string | null>(null);
  const open = now < proposal.endTime;
  const canVote = open && proposal.myVote === null && weight > 0n && Boolean(account);
  const leading = proposal.votes.reduce((best, v, i) => (v > proposal.votes[best] ? i : best), 0);
  const stateText = proposal.executed ? "Decided" : open ? `Open · ${countdown(proposal.endTime - now)} left` : "Closed · awaiting result";

  return (
    <Panel tone="white" aria-labelledby={`proposal-${proposal.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-ink/65">
          Vote {String(proposal.id + 1).padStart(2, "0")} · opened by {shortAddress(proposal.proposer)}
        </Label>
        <span
          className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
            proposal.executed ? "border-go bg-go-soft" : open ? "border-signal bg-signal-soft" : "border-ink/30"
          }`}
        >
          <span aria-hidden className={`size-2 ${proposal.executed ? "rounded-[2px] bg-go" : open ? "live-dot rounded-full bg-signal" : "rounded-[2px] border border-ink"}`} />
          {stateText}
        </span>
      </div>
      <h3 id={`proposal-${proposal.id}`} className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {proposal.description}
      </h3>
      <p className="mt-3 border-l-2 border-signal pl-3 text-sm leading-relaxed text-ink/75">
        <span className="mr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal">In plain English</span>
        {plainSummary(proposal, now)}
      </p>

      {canVote && (
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/65">
          Tap an option to vote with your {formatShares(weight)} DropShares
        </p>
      )}
      <ul className={`space-y-2 ${canVote ? "mt-2" : "mt-5"}`}>
        {proposal.options.map((option, i) => {
          const pct = percentOf(proposal.votes[i], proposal.totalVotes);
          const won = proposal.executed && proposal.winningOption === i;
          const mine = proposal.myVote === i;
          const busy = action.pending === `vote-${i}`;
          const body = (
            <>
              <motion.span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-full origin-left ${won ? "bg-go-soft" : mine || (i === leading && proposal.totalVotes > 0n) ? "bg-signal-soft" : "bg-ink/5"}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              />
              <span className="relative flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <span className="flex flex-wrap items-center gap-2 text-left text-[15px] font-medium">
                  {mine && (
                    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
                      <rect width="16" height="16" rx="3" fill="var(--signal)" />
                      <path d="m4 8.500 2.500 2.500 5.500-6" fill="none" stroke="var(--white)" strokeWidth="2" />
                    </svg>
                  )}
                  {option}
                  {mine && <span className="rounded-[4px] bg-signal px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">Your vote</span>}
                  {won && <span className="rounded-[4px] bg-go px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink">Winner</span>}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {busy ? "Casting…" : `${pct}%`} <span className="max-sm:hidden text-ink/65">· {formatShares(proposal.votes[i])}</span>
                </span>
              </span>
            </>
          );
          const frame = `relative block w-full overflow-hidden rounded-[8px] border ${mine ? "border-2 border-signal" : "border-ink/20"}`;
          return (
            <li key={i}>
              {canVote && account ? (
                <button
                  type="button"
                  disabled={action.pending !== null}
                  aria-label={`Vote for ${option}`}
                  onClick={() => void action.run(`vote-${i}`, () => source.castVote(account, campaignId, proposal.id, i), `Your vote for "${option}" is in.`)}
                  className={`${frame} transition-colors hover:border-signal disabled:opacity-60`}
                >
                  {body}
                </button>
              ) : (
                <div className={frame}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
        <Label className="text-ink/65">{formatShares(proposal.totalVotes)} DropShares voted</Label>
        <span className="flex-1" />
        {account && open && weight === 0n && <Label className="text-ink/65">Back this drop to earn a vote</Label>}
        {!account && open && (
          <Button tone="ink" onClick={connect} busy={connecting} busyLabel="Waiting for your passkey…">
            Sign in with passkey to vote
          </Button>
        )}
        {!open && !proposal.executed && account && (
          <Button
            tone="signal"
            busy={action.pending === "execute"}
            busyLabel="Recording the result…"
            onClick={() => void action.run("execute", () => source.executeProposal(account, campaignId, proposal.id), "The result is on the record.")}
          >
            Record the result
          </Button>
        )}
      </div>

      {(copilot.available || (mode === "demo" && open)) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {copilot.available && (
            <button
              type="button"
              disabled={copilot.busy}
              className="min-h-11 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-signal underline underline-offset-4 hover:text-ink disabled:opacity-60"
              onClick={async () => {
                const result = await copilot.call({
                  task: "summarize",
                  campaign: toCopilotCampaign(campaign, now),
                  proposal: toCopilotProposal(proposal, now),
                });
                if (result && "text" in result) setSummary(result.text);
              }}
            >
              {copilot.busy ? "KIMI is reading the vote…" : "Ask KIMI for a second read"}
            </button>
          )}
          {mode === "demo" && open && (
            <button
              type="button"
              disabled={action.pending !== null}
              className="min-h-11 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/70 underline underline-offset-4 hover:text-ink disabled:opacity-60"
              onClick={() =>
                void action.run(
                  "fans",
                  async () => {
                    await simulateFanVotes(campaignId, proposal.id);
                    return { simulated: true };
                  },
                  "The sandbox fans have voted.",
                )
              }
            >
              Sandbox: simulate fan votes
            </button>
          )}
        </div>
      )}

      <ActionStatus state={action} className="mt-3" />
      <div aria-live="polite" className="mt-3 space-y-2">
        {copilot.error && (
          <p role="alert" className="rounded-[8px] border border-stop bg-stop-soft px-3 py-2 text-sm">
            {copilot.error}
          </p>
        )}
        {summary && <AiAssisted>{summary}</AiAssisted>}
      </div>
    </Panel>
  );
}

function NewProposal({ campaignId, period }: { campaignId: number; period: number }) {
  const { account, source, connect } = useStore();
  const action = useAction();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const setOption = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));

  return (
    <Panel tone="paper">
      <Label as="h2">Put a question to shareholders</Label>
      <p className="mt-2 text-sm text-ink/65">
        Voting stays open for {period >= 7200 ? `${Math.round(period / 3600)} hours` : period >= 120 ? `${Math.round(period / 60)} minutes` : `${period} seconds`}
        . One vote per wallet, weighted by DropShares.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.question}
            type="button"
            onClick={() => {
              setQuestion(ex.question);
              setOptions(ex.options);
            }}
            className="min-h-11 rounded-[6px] border border-ink/25 px-2.5 py-1.5 text-left text-xs text-ink/70 transition-colors hover:border-signal hover:text-signal"
          >
            {ex.question}
          </button>
        ))}
      </div>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!account) return;
          const clean = options.map((o) => o.trim()).filter(Boolean);
          if (!question.trim()) return action.fail("Ask a question.");
          if (clean.length < 2) return action.fail("Give at least two options.");
          void action
            .run("create", () => source.createProposal(account, campaignId, question.trim(), clean), "The vote is open. Shareholders can weigh in now.")
            .then((ok) => {
              if (ok) {
                setQuestion("");
                setOptions(["", ""]);
              }
            });
        }}
      >
        <Field id="question" label="Question" maxLength={140} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should we decide?" />
        <fieldset className="space-y-3">
          <legend className="sr-only">Options</legend>
          {options.map((o, i) => (
            <Field key={i} id={`option-${i}`} label={`Option ${i + 1}`} maxLength={60} value={o} onChange={(e) => setOption(i, e.target.value)} />
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {options.length < 8 && (
            <Button type="button" tone="ghost-ink" onClick={() => setOptions((o) => [...o, ""])}>
              Add option
            </Button>
          )}
          {options.length > 2 && (
            <Button type="button" tone="ghost-ink" onClick={() => setOptions((o) => o.slice(0, -1))}>
              Remove last
            </Button>
          )}
          <span className="flex-1" />
          {account ? (
            <Button type="submit" tone="signal" busy={action.pending === "create"} busyLabel="Opening the vote…">
              Open the vote
            </Button>
          ) : (
            <Button type="button" tone="ink" onClick={connect}>
              Sign in with passkey
            </Button>
          )}
        </div>
        <ActionStatus state={action} />
      </form>
    </Panel>
  );
}

export function GovernanceView({ id }: { id: number }) {
  const { account, refresh } = useStore();
  const now = useNow();
  const campaign = useLoad((s) => s.getCampaign(id), [id]);
  const period = useLoad((s) => s.votingPeriod(), []);
  const data = useLoad(
    async (s) => {
      const c = await s.getCampaign(id);
      if (!c) return { proposals: [], weight: 0n };
      const [proposals, position] = await Promise.all([
        s.getProposals(id, account),
        account ? s.getPosition(id, account) : Promise.resolve(null),
      ]);
      return { proposals, weight: position?.shares ?? 0n };
    },
    [id, account],
  );

  if (campaign.loading && campaign.data === undefined) {
    return (
      <PageShell>
        <PageSkeleton label="Gathering the votes…" />
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
        <h1 className="font-display text-4xl font-bold">This drop doesn&apos;t exist yet.</h1>
        <LinkButton href="/dashboard" tone="paper" className="mt-6">
          Explore campaigns
        </LinkButton>
      </PageShell>
    );
  }

  const proposals = [...(data.data?.proposals ?? [])].reverse();
  const weight = data.data?.weight ?? 0n;

  return (
    <PageShell>
      <header className="on-ink">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-paper/70">Governance / {c.meta.title}</Label>
          <DemoTag className="text-paper" />
        </div>
        <h1 className="mt-4 font-display break-words text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.01em]">
          Vote on what drops next.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper/70">
          Shareholders steer the light calls: track order, cover direction, what the community gets first. Results are
          recorded onchain as a signal to the creator; they don&apos;t move funds.
        </p>
        <p className="mt-4 font-mono text-sm text-paper/70">
          Your voting weight: <span className="font-semibold text-paper">{formatShares(weight)} DROP</span>
        </p>
      </header>

      {!c.finalized ? (
        <Panel tone="paper" className="mt-10 max-w-2xl">
          <Label className="text-signal">Not open yet</Label>
          <p className="mt-3 font-display text-2xl font-bold leading-tight">Voting opens when the campaign is finalized.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            Once the goal is hit and the drop unlocks, the DropShare ledger freezes and every holder gets a vote
            weighted by their shares.
          </p>
          <LinkButton href={`/campaign/${c.id}`} tone="signal" className="mt-5">
            Back to the campaign
          </LinkButton>
        </Panel>
      ) : (
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="space-y-5">
            {data.error && <ErrorBlock message={data.error} />}
            {proposals.length === 0 && !data.loading && (
              <Panel tone="white">
                <EmptyState art="ballot" title="The floor is open.">
                  No one has put a question to shareholders yet. Open the first vote with one of the example questions
                  and see how a decision plays out.
                </EmptyState>
              </Panel>
            )}
            {proposals.map((p) => (
              <ProposalCard key={p.id} campaign={c} proposal={p} weight={weight} now={now} />
            ))}
          </div>
          <NewProposal campaignId={c.id} period={period.data ?? 0} />
        </div>
      )}

      <p className="mt-10 text-sm text-paper/65">
        <Link href={`/campaign/${c.id}`} className="underline hover:text-paper">
          ← Back to {c.meta.title}
        </Link>
      </p>
    </PageShell>
  );
}
