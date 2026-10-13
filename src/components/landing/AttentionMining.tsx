"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Label } from "../ui";

const YOU = { x: 90, y: 160 };
const FANS = [
  { x: 330, y: 60, label: "kairo" },
  { x: 400, y: 160, label: "juno" },
  { x: 330, y: 260, label: "rhea" },
];
const LOOP = 7.5;

/**
 * One referral, told as a loop: your link travels out (indigo), the fan converts,
 * and bonus DropShares travel back (gold). Transform and opacity only.
 */
function ReferralGraph() {
  const reduce = useReducedMotion();
  const loop = (delay: number) => ({ duration: LOOP, delay, repeat: Infinity, ease: "easeInOut" as const });

  return (
    <svg viewBox="0 0 480 320" className="w-full" role="img" aria-labelledby="graph-title graph-desc">
      <title id="graph-title">Referral graph</title>
      <desc id="graph-desc">
        Your referral link reaches three fans. Each fan who contributes sends bonus DropShares from the Attention
        Pool back to you.
      </desc>

      {FANS.map((f) => (
        <line key={f.label} x1={YOU.x} y1={YOU.y} x2={f.x} y2={f.y} stroke="var(--paper)" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 5" />
      ))}

      {FANS.map((f, i) => {
        const start = i * 1.6;
        return (
          <g key={f.label}>
            {/* Converted state: the fan node fills indigo once the link lands. */}
            <rect x={f.x - 34} y={f.y - 16} width="68" height="32" rx="6" fill="var(--ink)" stroke="var(--paper)" strokeOpacity="0.35" />
            <motion.rect
              x={f.x - 34}
              y={f.y - 16}
              width="68"
              height="32"
              rx="6"
              fill="var(--signal)"
              initial={{ opacity: reduce ? 1 : 0 }}
              animate={reduce ? undefined : { opacity: [0, 0, 1, 1, 0] }}
              transition={{ ...loop(start), times: [0, 0.18, 0.24, 0.9, 1] }}
            />
            <text x={f.x} y={f.y + 4} textAnchor="middle" fill="var(--paper)" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="1">
              {f.label.toUpperCase()}
            </text>

            {!reduce && (
              <>
                {/* Link going out */}
                <motion.circle
                  r="4"
                  fill="var(--signal)"
                  initial={{ x: YOU.x, y: YOU.y, opacity: 0 }}
                  animate={{ x: [YOU.x, f.x, f.x], y: [YOU.y, f.y, f.y], opacity: [0, 1, 0] }}
                  transition={{ ...loop(start), times: [0, 0.18, 0.22] }}
                />
                {/* Bonus shares coming back */}
                <motion.rect
                  x="-5"
                  y="-5"
                  width="10"
                  height="10"
                  rx="2"
                  fill="var(--gold)"
                  initial={{ x: f.x, y: f.y, opacity: 0 }}
                  animate={{ x: [f.x, f.x, YOU.x, YOU.x], y: [f.y, f.y, YOU.y, YOU.y], opacity: [0, 1, 1, 0] }}
                  transition={{ ...loop(start), times: [0, 0.3, 0.5, 0.54] }}
                />
              </>
            )}
          </g>
        );
      })}

      {/* You */}
      {!reduce && (
        <motion.circle
          cx={YOU.x}
          cy={YOU.y}
          r="44"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="2"
          style={{ transformOrigin: `${YOU.x}px ${YOU.y}px` }}
          animate={{ scale: [0.8, 1.25], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <circle cx={YOU.x} cy={YOU.y} r="38" fill="var(--paper)" />
      <text x={YOU.x} y={YOU.y - 2} textAnchor="middle" fill="var(--ink)" fontSize="15" fontWeight="800" fontFamily="var(--font-display)">
        YOU
      </text>
      <text x={YOU.x} y={YOU.y + 14} textAnchor="middle" fill="var(--ink)" fillOpacity="0.55" fontSize="8" fontFamily="var(--font-mono)" letterSpacing="1">
        YOUR LINK
      </text>

      <g>
        <rect x="24" y="252" width="150" height="44" rx="6" fill="var(--gold)" />
        <text x="36" y="270" fill="var(--ink)" fontSize="8" fontFamily="var(--font-mono)" letterSpacing="1.2">
          BONUS DROPSHARES MINTED
        </text>
        <text x="36" y="288" fill="var(--ink)" fontSize="15" fontWeight="600" fontFamily="var(--font-mono)">
          +4,500 DROP
        </text>
      </g>
      <text x="456" y="308" textAnchor="end" fill="var(--paper)" fillOpacity="0.45" fontSize="8" fontFamily="var(--font-mono)" letterSpacing="1.2">
        ILLUSTRATION · DEMO DATA
      </text>
    </svg>
  );
}

const FACTS = [
  ["10%", "bonus on every converted referral's shares"],
  ["Onchain", "each conversion emits a ReferralRewarded event"],
  ["Capped", "paid from an Attention Pool the creator sets up front"],
];

export function AttentionMining() {
  return (
    <section aria-labelledby="attention-title" className="on-ink border-y border-paper/10 bg-ink">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2">
        <div>
          <Label className="text-gold">ATTENTION MINING</Label>
          <h2 id="attention-title" className="mt-4 font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
            Your reach becomes your stake.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/75">
            Share the drop. When your referrals convert, you earn bonus DropShares from the Attention Pool.
          </p>
          <dl className="mt-10 divide-y divide-paper/15 border-y border-paper/15">
            {FACTS.map(([term, text], i) => (
              <motion.div
                key={term}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="grid grid-cols-[96px_1fr] items-baseline gap-4 py-3.5"
              >
                <dt className="font-mono text-sm font-semibold text-gold">{term}</dt>
                <dd className="text-sm text-paper/75">{text}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="rounded-[12px] border border-paper/15 p-4 sm:p-6"
        >
          <ReferralGraph />
        </motion.div>
      </div>
    </section>
  );
}
