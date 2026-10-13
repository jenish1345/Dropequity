"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBalance } from "@/lib/chain-source";
import { formatAmount, shortAddress } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button, Label } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Campaigns" },
  { href: "/create", label: "Launch" },
];
const FAUCET_URL = "https://faucet.monad.xyz";

/** `compact` keeps only the mark on phones, where the header needs the room. */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <svg aria-hidden viewBox="0 0 24 24" className="size-6">
        <rect x="1" y="1" width="22" height="22" rx="5" fill="var(--paper)" />
        <path d="M12 5.5c2.6 3.2 4 5.3 4 7.3a4 4 0 0 1-8 0c0-2 1.400-4.100 4-7.300Z" fill="var(--signal)" />
      </svg>
      <span className={compact ? "max-sm:sr-only" : undefined}>DropOwn</span>
    </span>
  );
}

/** Passkey account menu. Mera is the only account layer: no extension, no seed phrase. */
function AccountMenu() {
  const { mode, passkey, remembered, connecting, createPasskey, useExistingPasskey, connect, lock, forget, liveAvailable, setMode, tick } =
    useStore();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    if (!passkey || !open) return;
    let cancelled = false;
    getBalance(passkey)
      .then((b) => !cancelled && setBalance(b))
      .catch(() => !cancelled && setBalance(null));
    return () => {
      cancelled = true;
    };
  }, [passkey, open, tick]);

  const label = passkey ? shortAddress(passkey) : mode === "demo" ? "Demo" : connecting ? "Waiting…" : "Sign in";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[6px] border px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors hover:border-paper ${
          passkey ? "border-signal" : "border-paper/30"
        }`}
      >
        <span aria-hidden className={`size-1.5 rounded-full ${passkey ? "live-dot bg-go" : mode === "demo" ? "bg-gold" : "bg-paper/50"}`} />
        <span>
          {label}
          {!passkey && mode === "demo" && <span className="max-sm:hidden"> wallet</span>}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Passkey account"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[10px] border border-ink/15 bg-paper p-5 text-ink shadow-drop"
        >
          <Label className="text-signal">Passkey account · Mera</Label>

          {passkey ? (
            <>
              <p className="mt-3 break-all font-mono text-sm">{passkey}</p>
              <div className="mt-3 flex items-baseline justify-between border-y border-ink/10 py-2.5">
                <Label as="span" className="text-ink/65">
                  Testnet balance
                </Label>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {balance === null ? "—" : `${formatAmount(balance, 4)} MON`}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink/65">
                This address is derived from your passkey, in this tab. Fund it with testnet MON to back drops on
                Monad Testnet.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  tone="ink"
                  className="!px-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(passkey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      // Address is selectable above.
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy address"}
                </Button>
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-[8px] border border-ink/30 px-3 text-[13px] font-semibold uppercase tracking-[0.08em] hover:border-ink"
                >
                  Faucet ↗
                </a>
                <Button tone="ghost-ink" className="!px-3" onClick={lock}>
                  Lock
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight">
                Your face or fingerprint is the account.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">
                No seed phrase, no extension, no custody server. One prompt creates a passkey; your key is derived
                from it on this device and never leaves the page.
              </p>
              <div className="mt-4 space-y-2">
                {remembered ? (
                  <Button tone="signal" className="w-full" busy={connecting} onClick={connect}>
                    Unlock with passkey
                  </Button>
                ) : (
                  <Button tone="signal" className="w-full" busy={connecting} onClick={createPasskey}>
                    Create passkey account
                  </Button>
                )}
                <Button
                  tone="ghost-ink"
                  className="w-full"
                  disabled={connecting}
                  onClick={remembered ? createPasskey : useExistingPasskey}
                >
                  {remembered ? "Create a new passkey account" : "I already have a DropOwn passkey"}
                </Button>
              </div>
              {mode === "demo" && (
                <p className="mt-3 text-xs leading-relaxed text-ink/65">
                  Optional in the sandbox: without a passkey you act as a simulated demo wallet.
                </p>
              )}
            </>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            {liveAvailable ? (
              <button
                type="button"
                onClick={() => setMode(mode === "live" ? "demo" : "live")}
                className="min-h-11 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70 underline hover:text-signal"
              >
                {mode === "live" ? "Switch to demo sandbox" : "Switch to Monad Testnet"}
              </button>
            ) : (
              <Label className="text-ink/65">Demo sandbox</Label>
            )}
            {remembered && (
              <button
                type="button"
                onClick={forget}
                className="min-h-11 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70 underline hover:text-ink"
              >
                Forget this passkey
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { walletError } = useStore();

  return (
    <header className="on-ink sticky top-0 z-40 border-b border-paper/10 bg-ink">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" aria-label="DropOwn home" className="flex min-h-11 items-center">
            <Wordmark compact />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 px-2 py-4 text-sm font-medium transition-colors ${
                    active ? "border-signal text-paper" : "border-transparent text-paper/70 hover:text-paper"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <AccountMenu />
      </div>
      {walletError && (
        <p role="alert" className="border-t border-stop bg-stop-soft px-4 py-2 text-center text-sm text-ink">
          {walletError}
        </p>
      )}
    </header>
  );
}
