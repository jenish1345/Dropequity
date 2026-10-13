"use client";

import { explorerUrl } from "@/lib/chain-source";
import { resetDemo } from "@/lib/demo-source";
import { useStore } from "@/lib/store";
import deployments from "@/config/deployments.json";
import { Wordmark } from "./Header";
import { Label } from "./ui";

export function Footer() {
  const { mode, refresh } = useStore();
  const factory = (deployments as { factory: string | null }).factory;

  return (
    <footer className="on-ink border-t border-paper/10 bg-ink">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <Wordmark />
          <p className="mt-3 text-sm leading-relaxed text-paper/70">
            DropOwn is a hackathon demonstration on Monad Testnet. It does not handle real funds or guarantee
            returns. Contracts are unaudited and every figure shown is demo data.
          </p>
        </div>
        <div className="space-y-2 md:text-right">
          <Label className="text-paper/65">
            {mode === "live" ? "Mode / Monad Testnet" : "Mode / Demo sandbox — nothing is signed or sent"}
          </Label>
          {mode === "live" && factory ? (
            <a
              href={`${explorerUrl}/address/${factory}`}
              target="_blank"
              rel="noreferrer"
              className="block font-mono text-xs text-paper/70 underline hover:text-paper"
            >
              Factory {factory}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetDemo();
                refresh();
              }}
              className="min-h-11 font-mono text-xs uppercase tracking-[0.12em] text-paper/70 underline hover:text-paper"
            >
              Reset sandbox data
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
