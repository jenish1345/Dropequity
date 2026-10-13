import { AttentionMining } from "@/components/landing/AttentionMining";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Label, LinkButton } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <AttentionMining />

      <section aria-labelledby="cta-title" className="bg-paper text-ink">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Label className="text-signal">GET STARTED</Label>
          <h2 id="cta-title" className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.92] tracking-tight sm:text-7xl">
            Back the next big drop.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <LinkButton href="/create" tone="signal">
              Launch a campaign
            </LinkButton>
            <LinkButton href="/dashboard" tone="ghost-ink">
              Explore campaigns
            </LinkButton>
          </div>
          <p className="mt-10 max-w-xl border-l-2 border-signal pl-4 text-sm leading-relaxed text-ink/65">
            DropOwn is a hackathon demonstration on Monad Testnet. It does not handle real funds or guarantee
            returns.
          </p>
        </div>
      </section>
    </>
  );
}
