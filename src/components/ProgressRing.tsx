"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const TICKS = 72;

/**
 * Funding progress as a bezel of 72 ticks. Each tick lights with a staggered opacity
 * change, so the ring "fills" without animating any layout or paint-heavy property.
 */
export function ProgressRing({
  percent,
  tone = "signal",
  label,
  children,
}: {
  percent: number;
  tone?: "signal" | "go" | "stop";
  label: string;
  children: ReactNode;
}) {
  const lit = Math.round((Math.max(0, Math.min(100, percent)) / 100) * TICKS);
  const color = { signal: "var(--signal)", go: "var(--go)", stop: "var(--stop)" }[tone];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg
        viewBox="0 0 200 200"
        className="size-full"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {Array.from({ length: TICKS }, (_, i) => {
          const on = i < lit;
          return (
            <g key={i} transform={`rotate(${(i * 360) / TICKS} 100 100)`}>
              <motion.line
                x1="100"
                y1="6"
                x2="100"
                y2="24"
                strokeWidth="3.2"
                stroke={on ? color : "var(--ink)"}
                initial={{ opacity: 0.12 }}
                animate={{ opacity: on ? 1 : 0.12 }}
                transition={{ duration: 0.25, delay: on ? i * 0.012 : 0 }}
              />
            </g>
          );
        })}
        <circle cx="100" cy="100" r="66" fill="none" stroke="var(--ink)" strokeOpacity="0.12" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
