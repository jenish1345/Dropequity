"use client";

import { motion } from "framer-motion";
import { Label } from "./ui";

/** Revenue split after finalization. The two segments grow in with a scaleX transform. */
export function SplitBar({ fanPercent }: { fanPercent: number }) {
  const creatorPercent = 100 - fanPercent;
  const grow = { initial: { scaleX: 0 }, whileInView: { scaleX: 1 }, viewport: { once: true } };

  return (
    <figure>
      <figcaption className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Creator {creatorPercent}% / Fan Pool {fanPercent}%
      </figcaption>
      <div className="mt-4 flex h-12 gap-1 overflow-hidden" aria-hidden>
        <motion.div
          {...grow}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ width: `${creatorPercent}%`, originX: 0 }}
          className="rounded-l-[8px] bg-ink"
        />
        <motion.div
          {...grow}
          transition={{ duration: 0.7, delay: 0.75, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ width: `${fanPercent}%`, originX: 0 }}
          className="rounded-r-[8px] bg-signal"
        />
      </div>
      <div className="mt-2 flex justify-between">
        <Label className="text-ink/65">Creator</Label>
        <Label className="text-signal">DropShare holders</Label>
      </div>
    </figure>
  );
}
