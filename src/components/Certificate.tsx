"use client";

import { motion, type MotionStyle } from "framer-motion";
import { Label } from "./ui";

export type CertificatePieces = Partial<Record<"frame" | "head" | "title" | "rows" | "seal" | "stub", MotionStyle>>;

type Props = {
  title: string;
  creator: string;
  holder: string;
  shares: string;
  claim: string;
  bonus: string;
  serial: string;
  /** Printed across the footer, e.g. SPECIMEN or DEMO DATA. */
  stamp: string;
  /** Per-piece motion styles, used by the hero to assemble the certificate on scroll. */
  pieces?: CertificatePieces;
  className?: string;
};

function Seal() {
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg viewBox="0 0 80 80" className="size-16 sm:size-20" aria-hidden>
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="40"
          y1="3"
          x2="40"
          y2="9"
          stroke="var(--signal)"
          strokeWidth="1.5"
          transform={`rotate(${deg} 40 40)`}
        />
      ))}
      <circle cx="40" cy="40" r="25" fill="none" stroke="var(--signal)" strokeWidth="1.5" />
      <path d="M40 24c5.200 6.400 8 10.600 8 14.600a8 8 0 0 1-16 0c0-4 2.800-8.200 8-14.600Z" fill="var(--signal)" />
    </svg>
  );
}

/** The DropShare certificate: the product's signature object, drawn entirely in CSS and SVG. */
export function Certificate({ title, creator, holder, shares, claim, bonus, serial, stamp, pieces = {}, className }: Props) {
  return (
    <div className={`relative ${className ?? ""}`} role="img" aria-label={`DropShare certificate for ${title}: ${shares} shares`}>
      <motion.div
        style={pieces.frame}
        className="absolute inset-0 rounded-[12px] border border-ink/15 bg-paper shadow-drop"
        aria-hidden
      />
      <div className="relative grid grid-cols-[1fr_auto] text-ink">
        <div className="min-w-0 p-5 sm:p-7">
          <motion.div style={pieces.head} className="flex items-center justify-between gap-3 border-b border-ink/15 pb-3">
            <Label>DropShare certificate</Label>
            <Label className="text-ink/65">No. {serial}</Label>
          </motion.div>

          <motion.div style={pieces.title} className="pt-5 sm:pt-7">
            <p className="truncate font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">{title}</p>
            <p className="mt-2 text-sm text-ink/65">by {creator}</p>
          </motion.div>

          <motion.dl style={pieces.rows} className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:mt-8">
            <div className="col-span-2">
              <dt>
                <Label as="span" className="text-ink/65">
                  Holder
                </Label>
              </dt>
              <dd className="truncate font-mono text-sm">{holder}</dd>
            </div>
            <div>
              <dt>
                <Label as="span" className="text-ink/65">
                  DropShares
                </Label>
              </dt>
              <dd className="font-mono text-lg font-semibold tabular-nums sm:text-xl">{shares}</dd>
            </div>
            <div>
              <dt>
                <Label as="span" className="text-ink/65">
                  Pool claim
                </Label>
              </dt>
              <dd className="font-mono text-lg font-semibold tabular-nums sm:text-xl">{claim}</dd>
            </div>
          </motion.dl>

          <div className="mt-5 flex items-end justify-between gap-3 border-t-2 border-signal pt-3 sm:mt-7">
            <div>
              <Label className="text-signal">Verifiable on Monad Testnet</Label>
              <Label className="mt-1 text-ink/65">{stamp}</Label>
            </div>
            <motion.div style={pieces.seal} className="-mb-1 shrink-0">
              <Seal />
            </motion.div>
          </div>
        </div>

        <motion.div
          style={pieces.stub}
          className="flex w-[84px] flex-col items-center justify-between rounded-r-[12px] border-l border-dashed border-ink/30 bg-gold-soft px-2 py-5 text-center sm:w-[104px] sm:py-7"
        >
          <Label className="text-ink/65">Attention bonus</Label>
          <p className="font-mono text-lg font-semibold tabular-nums text-ink sm:text-xl">{bonus}</p>
          <span aria-hidden className="block h-8 w-full border-y border-gold bg-[repeating-linear-gradient(90deg,var(--ink)_0_2px,transparent_2px_5px)] opacity-70" />
        </motion.div>
      </div>
    </div>
  );
}
