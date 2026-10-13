"use client";

import { motion } from "framer-motion";
import { Label } from "../ui";

const STEPS = [
  {
    verb: "Fund",
    line: "Back a drop you believe in.",
    detail: "Pick a release, send testnet MON, and move the ring toward the goal.",
    glyph: (
      <path d="M24 8v24m0 0-9-9m9 9 9-9M8 40h32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    ),
  },
  {
    verb: "Own",
    line: "Receive DropShares tied to that release.",
    detail: "Shares mint in the same transaction, pro-rata to what you put in.",
    glyph: (
      <>
        <rect x="7" y="11" width="34" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M14 20h12M14 28h20" stroke="currentColor" strokeWidth="3" />
      </>
    ),
  },
  {
    verb: "Earn",
    line: "Split revenue + earn bonus shares for attention.",
    detail: "When the release earns, the fan pool pays out to every shareholder.",
    glyph: (
      <>
        <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M24 8v16l12 10" fill="none" stroke="currentColor" strokeWidth="3" />
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Label className="text-signal">HOW IT WORKS</Label>
        <h2 id="how-title" className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
          Three moves to ownership.
        </h2>

        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.verb}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.18, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex flex-col rounded-[10px] border border-ink/15 bg-white p-6 shadow-drop"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-sm font-semibold text-ink/65">0{i + 1}</span>
                <svg viewBox="0 0 48 48" className="size-10 text-signal" aria-hidden>
                  {step.glyph}
                </svg>
              </div>
              <h3 className="mt-10 font-display text-5xl font-bold uppercase tracking-tight">{step.verb}</h3>
              <p className="mt-3 border-t-2 border-signal pt-3 text-lg font-medium leading-snug">{step.line}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{step.detail}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
