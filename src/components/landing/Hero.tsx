"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Certificate, type CertificatePieces } from "../Certificate";
import { Label, LinkButton } from "../ui";

/** Map a slice of scroll progress to a value, holding steady outside the slice. */
function useSlice(progress: MotionValue<number>, from: number, to: number, a: number, b: number) {
  return useTransform(progress, [from, to], [a, b], { clamp: true });
}

/** Scroll-linked assembly: each piece of the certificate travels in from its own direction. */
function useAssembly(progress: MotionValue<number>): CertificatePieces {
  return {
    frame: {
      opacity: useSlice(progress, 0, 0.25, 0.35, 1),
      scale: useSlice(progress, 0, 0.3, 0.92, 1),
    },
    head: {
      opacity: useSlice(progress, 0.05, 0.3, 0.3, 1),
      y: useSlice(progress, 0.05, 0.35, -70, 0),
    },
    title: {
      opacity: useSlice(progress, 0.15, 0.45, 0.3, 1),
      x: useSlice(progress, 0.15, 0.5, -90, 0),
    },
    rows: {
      opacity: useSlice(progress, 0.3, 0.6, 0.2, 1),
      y: useSlice(progress, 0.3, 0.65, 80, 0),
    },
    seal: {
      opacity: useSlice(progress, 0.5, 0.75, 0, 1),
      scale: useSlice(progress, 0.5, 0.8, 0.3, 1),
      rotate: useSlice(progress, 0.5, 0.8, -120, 0),
    },
    stub: {
      opacity: useSlice(progress, 0.55, 0.8, 0.25, 1),
      x: useSlice(progress, 0.55, 0.85, 110, 0),
      rotate: useSlice(progress, 0.55, 0.85, 7, 0),
    },
  };
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const certRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setPinned(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Desktop pins the hero and assembles across the section's scroll length.
  // Smaller screens assemble as the certificate itself rises through the viewport.
  const section = useScroll({ target: ref, offset: ["start start", "end end"] });
  const card = useScroll({ target: certRef, offset: ["start 0.95", "start 0.3"] });
  const progress = pinned ? section.scrollYProgress : card.scrollYProgress;
  const assembly = useAssembly(progress);
  const hintOpacity = useSlice(section.scrollYProgress, 0, 0.15, 1, 0);

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      className={`on-ink relative bg-ink ${reduce ? "" : "lg:h-[210vh]"}`}
    >
      <div className="ledger-lines top-14 flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden lg:sticky lg:h-[calc(100svh-3.5rem)]">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <Label className="flex items-center gap-2 text-paper/70">
              <span aria-hidden className="live-dot size-1.5 rounded-full bg-signal" />
              DROPOWN / MONAD TESTNET
            </Label>
            <h1
              id="hero-title"
              className="mt-5 font-display text-[clamp(2.75rem,7.4vw,5.75rem)] font-bold leading-[0.95] tracking-[-0.01em]"
            >
              Own the
              <br />
              next drop<span className="text-signal">.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/75">
              Fund the release. Earn DropShares. Get rewarded for the attention you bring.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/create" tone="signal" className="hover:!border-paper hover:!bg-paper hover:!text-ink">
                Launch a campaign
              </LinkButton>
              <LinkButton href="/dashboard" tone="ghost-paper">
                Explore campaigns
              </LinkButton>
            </div>
          </div>

          <div ref={certRef} className="relative">
            <Certificate
              title="Midnight Static"
              creator="Lumen Arcade"
              holder="0xd0d0…0001"
              shares="18,000"
              claim="1.94%"
              bonus="+1,800"
              serial="000472"
              stamp="Specimen · demo data"
              pieces={reduce ? undefined : assembly}
            />
            {!reduce && (
              <motion.p
                style={{ opacity: hintOpacity }}
                className="mt-6 hidden text-center font-mono text-[11px] uppercase tracking-[0.16em] text-paper/65 lg:block"
                aria-hidden
              >
                Scroll to issue the certificate ↓
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
