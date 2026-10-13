"use client";

import { motion } from "framer-motion";
import { explorerUrl } from "@/lib/chain-source";
import { formatAmount, formatShares, percentOf, shortAddress } from "@/lib/format";
import { useLoad, useNow } from "@/lib/store";
import type { Activity, Campaign } from "@/lib/types";
import { DemoTag, Label, Panel, Skeleton, Stat } from "./ui";

const DAYS = 7;
const DAY = 86_400;

const SOURCE: Record<Activity["source"], string> = {
  envio: "Indexed by Envio HyperIndex",
  sandbox: "Sandbox simulation",
  unavailable: "Indexer not connected",
};

function ago(seconds: number): string {
  if (seconds < 90) return "just now";
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < DAY) return `${Math.round(seconds / 3_600)}h ago`;
  return `${Math.round(seconds / DAY)}d ago`;
}

/** Campaign analytics from the event stream: velocity, referral share, feed and revenue-split status. */
export function AnalyticsPanel({ campaign }: { campaign: Campaign }) {
  const now = useNow();
  const { data } = useLoad((s) => s.getActivity(campaign.id), [campaign.id]);

  if (!data) {
    return (
      <Panel tone="white" className="lg:col-span-2">
        <Label as="h2">Live analytics</Label>
        <div className="mt-5 grid gap-8 text-ink/15 lg:grid-cols-[1.2fr_1fr]" role="status">
          <span className="sr-only">Reading the activity…</span>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Panel>
    );
  }

  if (data.source === "unavailable") {
    return (
      <Panel tone="white" className="lg:col-span-2">
        <Label as="h2">Live analytics</Label>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/65">
          Contribution velocity and the activity feed come from the Envio HyperIndex indexer in{" "}
          <code className="font-mono text-xs">/indexer</code>. Set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_ENVIO_URL</code> to its GraphQL endpoint to switch this
          panel on. Until then the leaderboard reads directly from the contract.
        </p>
      </Panel>
    );
  }

  const { events, revenue } = data;
  // Rolling 24-hour buckets, oldest on the left, the current one on the right.
  const buckets = Array.from({ length: DAYS }, () => 0n);
  for (const e of events) {
    const age = Math.floor((now - e.timestamp) / DAY);
    if (age >= 0 && age < DAYS) buckets[DAYS - 1 - age] += e.amount;
  }
  const peak = buckets.reduce((m, b) => (b > m ? b : m), 0n);
  const last24h = buckets[DAYS - 1];
  const total = events.reduce((sum, e) => sum + e.amount, 0n);
  const referred = events.filter((e) => e.referrer).reduce((sum, e) => sum + e.amount, 0n);
  const claimedPct = percentOf(revenue.fanClaimed, revenue.fanCut);

  return (
    <Panel tone="white" className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label as="h2">Live analytics</Label>
        <div className="flex items-center gap-2">
          <Label as="span" className={data.source === "envio" ? "text-signal" : "text-ink/65"}>
            {SOURCE[data.source]}
          </Label>
          <DemoTag />
        </div>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Velocity" value={`${formatAmount(last24h)} MON`} sub="last 24 hours" />
            <Stat label="Contributions" value={events.length} sub={`${formatAmount(total)} MON total`} />
            <Stat label="Via referrals" value={`${percentOf(referred, total)}%`} sub="of volume" />
          </div>

          <figure className="mt-6">
            <figcaption>
              <Label className="text-ink/65">Contribution velocity · MON per 24h, last {DAYS} days</Label>
            </figcaption>
            <div className="mt-3 flex h-28 items-end gap-1.5 border-b border-ink/20" role="img" aria-label={`Contributions per day over the last ${DAYS} days. Most recent 24 hours: ${formatAmount(last24h)} MON.`}>
              {buckets.map((b, i) => (
                <div key={i} className="flex h-full flex-1 items-end">
                  <motion.div
                    className={`w-full origin-bottom rounded-t-[3px] ${i === DAYS - 1 ? "bg-signal" : "bg-ink/70"}`}
                    style={{ height: peak === 0n ? "2%" : `${Math.max(2, Number((b * 100n) / peak))}%` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink/65">
              <span>{DAYS - 1}d ago</span>
              <span>now</span>
            </div>
          </figure>
        </div>

        <div>
          <Label className="text-ink/65">Latest activity</Label>
          {events.length === 0 ? (
            <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-ink/65">Quiet so far. The first backer shows up here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
              {events.slice(0, 5).map((e, i) => (
                <li key={`${e.timestamp}-${e.contributor}-${i}`} className="grid grid-cols-[1fr_auto] gap-x-3 py-2 font-mono text-xs">
                  <span>
                    {e.txHash ? (
                      <a className="underline hover:text-signal" href={`${explorerUrl}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                        {shortAddress(e.contributor)}
                      </a>
                    ) : (
                      shortAddress(e.contributor)
                    )}
                    {e.referrer && (
                      <span className="ml-2 rounded-[3px] bg-gold-soft px-1 text-ink">
                        via {shortAddress(e.referrer)} · +{formatShares(e.bonusShares)}
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="font-semibold">{formatAmount(e.amount)} MON</span>
                    <span className="ml-2 text-ink/65">{ago(now - e.timestamp)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t-2 border-signal pt-3">
            <Label className="text-ink/65">Revenue-split status</Label>
            {campaign.finalized ? (
              <dl className="mt-2 grid grid-cols-3 gap-3 font-mono text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink/65">Distributed</dt>
                  <dd className="font-semibold tabular-nums">{formatAmount(revenue.total)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink/65">Fan pool</dt>
                  <dd className="font-semibold tabular-nums">{formatAmount(revenue.fanCut)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink/65">Claimed</dt>
                  <dd className="font-semibold tabular-nums">{claimedPct}%</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-ink/65">
                Not live yet. The {campaign.fanShareBps / 100}% fan pool switches on the moment this drop unlocks.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
