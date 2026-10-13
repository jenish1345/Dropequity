"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEther } from "viem";
import { formatShares } from "@/lib/format";
import { useAction, useLoad, useStore } from "@/lib/store";
import { REFERRAL_BONUS_BPS, TOTAL_SHARES, type DropKind } from "@/lib/types";
import { Certificate } from "./Certificate";
import { CopilotDraftPanel } from "./Copilot";
import { SplitBar } from "./SplitBar";
import { ActionStatus, Button, Field, Label, PageShell, Panel, Select, TextArea } from "./ui";

const KINDS: DropKind[] = ["Song", "Art drop", "Video", "Collection"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export function CreateView() {
  const router = useRouter();
  const { account, source, mode, connect, connecting } = useStore();
  const action = useAction();

  const [title, setTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [kind, setKind] = useState<DropKind>("Song");
  const [tagline, setTagline] = useState("");
  const [goal, setGoal] = useState("250");
  const [fanShare, setFanShare] = useState(20);
  const [attention, setAttention] = useState(10);
  const [days, setDays] = useState(14);

  const peers = useLoad((s) => s.listCampaigns(), []);
  const attentionShares = (TOTAL_SHARES * BigInt(attention)) / 100n;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    if (!title.trim() || !creatorName.trim()) return action.fail("Your drop needs a title and a creator name before it can go live.");
    let goalWei: bigint;
    try {
      goalWei = parseEther(goal.trim() as `${number}`);
    } catch {
      return action.fail("Set a funding goal in MON, like 250.");
    }
    if (goalWei <= 0n) return action.fail("Goal must be greater than zero.");

    const result = await action.run(
      "create",
      () =>
        source.createCampaign(account, {
          meta: { title: title.trim(), creatorName: creatorName.trim(), kind, tagline: tagline.trim() },
          goal: goalWei,
          fanSharePercent: fanShare,
          attentionPoolPercent: attention,
          deadline: Math.floor(Date.now() / 1000) + days * 86_400,
        }),
      "Your drop is live. Fans can back it now.",
    );
    if (result) router.push(`/campaign/${result.id}`);
  }

  return (
    <PageShell>
      <header className="on-ink">
        <Label className="text-paper/70">Launch / {mode === "live" ? "Monad Testnet" : "Demo sandbox"}</Label>
        <h1 className="mt-4 font-display break-words text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[0.92] tracking-[-0.01em]">
          Put your next drop
          <br />
          in fans&apos; hands.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-paper/70">
          Set a goal, decide how much of the release&apos;s revenue your backers share, and reserve a slice for the
          fans who bring the crowd.
        </p>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <Panel tone="paper">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <Label as="h2">The release</Label>
            <Field id="title" label="Drop title" maxLength={60} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Static" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="creator" label="Creator name" maxLength={40} required value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="Your artist name" />
              <Select id="kind" label="Format" value={kind} onChange={(e) => setKind(e.target.value as DropKind)}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            </div>
            <TextArea id="tagline" label="One-line pitch" maxLength={160} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="What is it, and why should fans own a piece?" />

            <CopilotDraftPanel
              kind={kind}
              creatorName={creatorName}
              peers={peers.data ?? []}
              onUseTagline={setTagline}
              onUseGoal={setGoal}
            />

            <Label as="h2" className="border-t-2 border-signal pt-5">
              The terms
            </Label>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="goal" label="Funding goal" suffix="MON" mono inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <Field
                id="days"
                label="Funding window"
                suffix="days"
                mono
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(clamp(Math.round(Number(e.target.value)), 1, 90))}
              />
              <Field
                id="fan-share"
                label="Fan pool"
                suffix="% rev"
                mono
                type="number"
                min={1}
                max={100}
                value={fanShare}
                onChange={(e) => setFanShare(clamp(Math.round(Number(e.target.value)), 1, 100))}
                hint="Share of this release's revenue split among DropShare holders."
              />
              <Field
                id="attention"
                label="Attention pool"
                suffix="% shares"
                mono
                type="number"
                min={0}
                max={50}
                value={attention}
                onChange={(e) => setAttention(clamp(Math.round(Number(e.target.value)), 0, 50))}
                hint="DropShares reserved for referral bonuses."
              />
            </div>

            {account ? (
              <Button type="submit" tone="signal" className="w-full" busy={action.pending === "create"} busyLabel="Opening your drop to fans…">
                Launch campaign
              </Button>
            ) : (
              <Button type="button" tone="ink" className="w-full" onClick={connect} busy={connecting} busyLabel="Waiting for your passkey…">
                Sign in with passkey to launch
              </Button>
            )}
            <ActionStatus state={action} />
            <p className="text-xs leading-relaxed text-ink/65">
              {mode === "demo"
                ? "Sandbox: your drop is created in this browser only. Nothing is signed or sent."
                : "Your passkey account signs one transaction on Monad Testnet, right here in the page. The terms are locked once you launch, so fans know exactly what they are backing."}
            </p>
          </form>
        </Panel>

        <div className="space-y-5 lg:sticky lg:top-20">
          <div>
            <Label className="mb-3 text-paper/70">What a backer will hold</Label>
            <Certificate
              title={title.trim() || "Your drop title"}
              creator={creatorName.trim() || "you"}
              holder="a fan who funds 10% of the goal"
              shares={formatShares(((TOTAL_SHARES - attentionShares) * 10n) / 100n)}
              claim="≈10%"
              bonus={`+${REFERRAL_BONUS_BPS / 100}%`}
              serial="PREVIEW"
              stamp="Preview · not issued"
            />
          </div>
          <Panel tone="white">
            <Label as="h2">Revenue split preview</Label>
            <div className="mt-4">
              <SplitBar key={fanShare} fanPercent={fanShare} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-ink/10 pt-4 font-mono text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ink/65">Contributor shares</dt>
                <dd className="font-semibold tabular-nums">{formatShares(TOTAL_SHARES - attentionShares)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ink/65">Attention pool</dt>
                <dd className="font-semibold tabular-nums">{formatShares(attentionShares)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
