"use client";

import { motion } from "framer-motion";
import { formatShares, shortAddress } from "@/lib/format";
import type { Address, LeaderRow } from "@/lib/types";
import { DemoTag, EmptyState, Label, Skeleton } from "./ui";

/** Top referrers by bonus DropShares. Gold is reserved for the leader. */
export function Leaderboard({
  rows,
  account,
  loading,
  title = "Attention Leaderboard",
  empty = "No conversions yet. The first referral that converts takes the top spot.",
}: {
  rows: LeaderRow[];
  account: Address | null;
  loading?: boolean;
  title?: string;
  empty?: string;
}) {
  const sorted = [...rows]
    .sort((a, b) => (b.bonusShares > a.bonusShares ? 1 : b.bonusShares < a.bonusShares ? -1 : b.conversions - a.conversions))
    .slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label as="h2">{title}</Label>
        <DemoTag />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3 text-ink/15" role="status">
          <span className="sr-only">Counting conversions…</span>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState art="signal" title="The top spot is open.">
            {empty}
          </EmptyState>
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-left">
          <caption className="sr-only">{title}: referrers ranked by bonus DropShares earned</caption>
          <thead>
            <tr className="border-b border-ink/15">
              {["Rank", "Referrer", "Converted", "Bonus shares"].map((h, i) => (
                <th key={h} scope="col" className={`pb-2 ${i >= 2 ? "text-right" : ""}`}>
                  <Label as="span" className="text-ink/65">
                    {i === 0 ? <span aria-hidden>#</span> : h}
                    {i === 0 && <span className="sr-only">{h}</span>}
                  </Label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const isYou = account?.toLowerCase() === row.referrer.toLowerCase();
              const lead = i === 0;
              return (
                <motion.tr
                  key={row.referrer}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className={`border-b border-ink/10 font-mono text-sm ${lead ? "bg-gold-soft" : ""}`}
                >
                  <td className={`w-12 py-3 pl-2 tabular-nums ${lead ? "border-l-2 border-gold font-semibold" : "text-ink/65"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-3">
                    {row.code ? <span className="font-semibold">{row.code}</span> : shortAddress(row.referrer)}
                    {row.code && <span className="ml-2 hidden text-xs text-ink/65 sm:inline">{shortAddress(row.referrer)}</span>}
                    {lead && (
                      <span className="ml-2 rounded-[4px] border border-gold bg-gold px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
                        Top
                      </span>
                    )}
                    {isYou && (
                      <span className="ml-2 rounded-[4px] bg-signal px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        You
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums">{row.conversions}</td>
                  <td className="py-3 pr-2 text-right font-semibold tabular-nums">+{formatShares(row.bonusShares)}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
