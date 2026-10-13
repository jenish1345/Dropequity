"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { explorerUrl } from "@/lib/chain-source";
import type { ActionState } from "@/lib/store";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Small uppercase mono label: the system's eyebrow and status voice. */
export function Label({ children, className, as: Tag = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" }) {
  return (
    <Tag className={cx("font-mono text-[11px] font-medium uppercase tracking-[0.16em]", className)}>{children}</Tag>
  );
}

type Tone = "signal" | "paper" | "ink" | "gold" | "ghost-ink" | "ghost-paper";

const TONES: Record<Tone, string> = {
  signal: "bg-signal text-white border-signal hover:bg-ink hover:border-ink",
  paper: "bg-paper text-ink border-paper hover:bg-white hover:border-white",
  ink: "bg-ink text-paper border-ink hover:bg-signal hover:border-signal",
  gold: "bg-gold text-ink border-gold hover:bg-ink hover:text-gold hover:border-ink",
  "ghost-ink": "bg-transparent text-ink border-ink/30 hover:border-ink",
  "ghost-paper": "bg-transparent text-paper border-paper/30 hover:border-paper",
};

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border px-5 py-2.5 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  tone = "signal",
  busy,
  busyLabel,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { tone?: Tone; busy?: boolean; /** Shown in place of the label while busy. */ busyLabel?: string }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={cx(BUTTON_BASE, TONES[tone], className)}
    >
      {busy && <span aria-hidden className="spinner size-3.5 rounded-full border-2 border-current border-t-transparent" />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function LinkButton({
  tone = "signal",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { tone?: Tone }) {
  return (
    <Link {...props} className={cx(BUTTON_BASE, TONES[tone], className)}>
      {children}
    </Link>
  );
}

/** Marks sample numbers. Every panel that shows seeded or simulated figures carries one. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[4px] border border-current px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70",
        className,
      )}
    >
      Demo data
    </span>
  );
}

export function Panel({
  tone = "paper",
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: "paper" | "white" | "ink" | "gold" }) {
  const tones = {
    paper: "bg-paper text-ink border-ink/10",
    white: "bg-white text-ink border-ink/10",
    ink: "on-ink bg-ink text-paper border-paper/15",
    gold: "bg-gold-soft text-ink border-gold",
  };
  return (
    <section {...props} className={cx("rounded-[10px] border p-5 shadow-drop sm:p-6", tones[tone], className)}>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="opacity-60">{label}</Label>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] opacity-60">{sub}</p>}
    </div>
  );
}

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-ink/25 bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-ink/35 focus:border-signal";

export function Field({
  label,
  hint,
  mono,
  suffix,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; mono?: boolean; suffix?: string }) {
  const hintId = hint && props.id ? `${props.id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={props.id}>
        <Label as="span" className="text-ink/70">
          {label}
        </Label>
      </label>
      <div className="relative">
        <input {...props} aria-describedby={hintId} className={cx(FIELD, mono && "font-mono", suffix && "pr-16")} />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 font-mono text-xs text-ink/65">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-ink/65">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({ label, ...props }: ComponentProps<"textarea"> & { label: string }) {
  return (
    <div>
      <label htmlFor={props.id}>
        <Label as="span" className="text-ink/70">
          {label}
        </Label>
      </label>
      <textarea {...props} className={cx(FIELD, "min-h-20 resize-y")} />
    </div>
  );
}

export function Select({ label, children, ...props }: ComponentProps<"select"> & { label: string }) {
  return (
    <div>
      <label htmlFor={props.id}>
        <Label as="span" className="text-ink/70">
          {label}
        </Label>
      </label>
      <select {...props} className={FIELD}>
        {children}
      </select>
    </div>
  );
}

/** Success / error line for an action. Announced to assistive tech. */
export function ActionStatus({ state, className }: { state: Pick<ActionState, "error" | "notice">; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[8px] border border-stop bg-stop-soft px-3 py-2.5 text-sm text-ink">
          <StatusGlyph kind="error" />
          <p>{state.error}</p>
        </div>
      )}
      {state.notice && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start gap-2.5 rounded-[8px] border border-go bg-go-soft px-3 py-2.5 text-sm text-ink"
        >
          <StatusGlyph kind="success" />
          <p>
          <span className="font-medium">{state.notice.text}</span>{" "}
          {state.notice.result.simulated ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70">
              Simulated · nothing was sent
            </span>
          ) : (
            state.notice.result.hash && (
              <a
                className="font-mono text-[11px] uppercase tracking-wider underline"
                href={`${explorerUrl}/tx/${state.notice.result.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            )
          )}
          </p>
        </motion.div>
      )}
    </div>
  );
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14", className)}>{children}</div>;
}

/** A block of placeholder ink. Size it with width/height utilities. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("skeleton block", className)} />;
}

/** Page-shaped loading state: the layout arrives first, the numbers follow. */
export function PageSkeleton({ label, cards = 2 }: { label: string; cards?: number }) {
  return (
    <div role="status" aria-live="polite" className="text-paper/25">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-5 h-14 w-[min(32rem,85%)] sm:h-20" />
      <Skeleton className="mt-4 h-4 w-[min(26rem,70%)]" />
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-[10px] border border-paper/15 p-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-6 h-32 w-full" />
            <div className="mt-6 grid grid-cols-3 gap-4">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </div>
        ))}
      </div>
      <p aria-hidden className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-paper/70">
        {label}
      </p>
    </div>
  );
}

const EMPTY_ART = {
  // An unissued certificate.
  certificate: (
    <>
      <rect x="6" y="14" width="68" height="44" rx="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M16 28h26M16 38h40M16 46h18" stroke="currentColor" strokeWidth="2" />
      <circle cx="58" cy="44" r="7" fill="none" stroke="var(--signal)" strokeWidth="2" />
    </>
  ),
  // A link waiting for its first conversion.
  signal: (
    <>
      <circle cx="18" cy="36" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M27 36h22" stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" />
      <rect x="50" y="26" width="22" height="20" rx="4" fill="none" stroke="var(--gold)" strokeWidth="2" />
    </>
  ),
  // A ballot with nothing on it yet.
  ballot: (
    <>
      <rect x="16" y="10" width="48" height="52" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M26 26h6M38 26h16M26 38h6M38 38h16M26 50h6M38 50h10" stroke="currentColor" strokeWidth="2" />
      <path d="m25 25 2.500 3 4-5" fill="none" stroke="var(--signal)" strokeWidth="2" />
    </>
  ),
  // A stage before the first release.
  stage: (
    <>
      <path d="M8 56h64" stroke="currentColor" strokeWidth="2" />
      <path d="M40 14c7 8.500 10.500 14 10.500 19.500a10.500 10.500 0 0 1-21 0C29.500 28 33 22.500 40 14Z" fill="none" stroke="var(--signal)" strokeWidth="2" />
      <path d="M20 56V46M60 56V46" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
    </>
  ),
};

/** Empty state with a small drawn mark, a line of encouragement and one way forward. */
export function EmptyState({
  art,
  title,
  children,
  action,
}: {
  art: keyof typeof EMPTY_ART;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-[8px] border border-dashed border-ink/25 p-4">
      <svg viewBox="0 0 80 72" className="w-16 shrink-0 text-ink/65 sm:w-20" aria-hidden>
        {EMPTY_ART[art]}
      </svg>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold leading-tight tracking-tight">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink/65">{children}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-stop bg-stop-soft p-5 text-ink">
      <StatusGlyph kind="error" />
      <div>
        <p className="font-display text-xl font-semibold leading-tight">Something interrupted the drop.</p>
        <p className="mt-1 text-sm leading-relaxed">{message}</p>
        {onRetry && (
          <Button tone="ink" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

/** Status is never carried by colour alone: each state has its own shape. */
export function StatusGlyph({ kind }: { kind: "success" | "error" }) {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0" aria-hidden>
      {kind === "success" ? (
        <>
          <rect x="1" y="1" width="18" height="18" rx="4" fill="var(--go)" />
          <path d="m5.500 10.500 3 3 6-7" fill="none" stroke="var(--ink)" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M10 1.500 19 18H1Z" fill="var(--stop)" />
          <path d="M10 7.500v5M10 14.500v1.500" stroke="var(--white)" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
