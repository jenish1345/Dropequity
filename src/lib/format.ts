import { formatEther } from "viem";
import type { Address, CampaignMeta, DropKind } from "./types";

const KINDS: DropKind[] = ["Song", "Art drop", "Video", "Collection"];

/** Wei -> "1,234.5" with at most `dp` decimals and no trailing zeros. */
export function formatAmount(wei: bigint, dp = 2): string {
  const n = Number(formatEther(wei));
  return n.toLocaleString("en-US", { maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : dp });
}

/** 18-decimal DropShares -> whole-share string. */
export function formatShares(shares: bigint): string {
  return Number(formatEther(shares)).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Integer percent of a/b, floored and clamped to 0-100. */
export function percentOf(a: bigint, b: bigint): number {
  if (b === 0n) return 0;
  const p = Number((a * 10_000n) / b) / 100;
  return Math.max(0, Math.min(100, Math.floor(p)));
}

/** Percent with two decimals, for small ownership slices. */
export function finePercent(a: bigint, b: bigint): string {
  if (b === 0n) return "0";
  return (Number((a * 1_000_000n) / b) / 10_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function timeLeft(deadlineSec: number, nowSec: number): string {
  const s = deadlineSec - nowSec;
  if (s <= 0) return "closed";
  const d = Math.floor(s / 86_400);
  if (d >= 1) return `${d} day${d === 1 ? "" : "s"} left`;
  const h = Math.floor(s / 3_600);
  if (h >= 1) return `${h} hour${h === 1 ? "" : "s"} left`;
  const m = Math.floor(s / 60);
  if (m >= 1) return `${m} min left`;
  return `${s}s left`;
}

export function countdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function isAddress(v: string): v is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export function isValidCode(v: string): boolean {
  return /^[a-z0-9-]{3,20}$/.test(v);
}

// ------------------------------------------------------------------ metadata

const DATA_PREFIX = "data:application/json;base64,";

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Campaign metadata travels on-chain as an inline JSON data URI: no pinning service needed. */
export function encodeMeta(meta: CampaignMeta): string {
  return DATA_PREFIX + toBase64(JSON.stringify(meta));
}

export function decodeMeta(uri: string): CampaignMeta {
  const fallback: CampaignMeta = { title: "Untitled drop", tagline: "", kind: "Song", creatorName: "Unknown creator" };
  if (!uri.startsWith(DATA_PREFIX)) return fallback;
  try {
    const raw = JSON.parse(fromBase64(uri.slice(DATA_PREFIX.length))) as Partial<CampaignMeta>;
    const text = (v: unknown, max: number, d: string) => (typeof v === "string" && v.trim() ? v.slice(0, max) : d);
    return {
      title: text(raw.title, 60, fallback.title),
      tagline: text(raw.tagline, 160, ""),
      kind: KINDS.includes(raw.kind as DropKind) ? (raw.kind as DropKind) : "Song",
      creatorName: text(raw.creatorName, 40, fallback.creatorName),
    };
  } catch {
    return fallback;
  }
}
