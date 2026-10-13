# DropOwn

**Turn fans into co-owners of the next drop — and reward the attention that makes it happen.**

A Monad Metropolis hackathon submission for the **Social, Attention & Culture** track.

> DropOwn is a hackathon demonstration on Monad Testnet. It does not handle real funds or guarantee
> returns. The contracts are unaudited, every figure in the app is demo data, and nothing here is
> production-ready.

## The idea

A creator launches a campaign for an upcoming release. Fans fund it and receive **DropShares**: an
onchain claim on a fixed percentage of that release's revenue. When the goal is hit the campaign is
finalized, the raise goes to the creator, and a revenue split switches on. Shareholders then vote on
light creative calls.

The differentiator is **Attention Mining**. Most fan-funding rewards only capital. Here, every fan has
a referral link, and when a new backer arrives through it and contributes, the referrer is minted
bonus DropShares from a pre-set Attention Pool. The conversion is an onchain event, and a live
Attention Leaderboard ranks the fans who brought the crowd.

| Stake | How it's earned | What it is |
| --- | --- | --- |
| Financial | Contribute to a campaign | DropShares, pro-rata to contribution |
| Attention | A referral converts into a contribution | Bonus DropShares (10% of the referred shares) from the Attention Pool |
| Governance | Hold DropShares | Share-weighted votes on release decisions |

## Two modes

The app picks its data source from `src/config/deployments.json`.

- **Demo sandbox** (default, `factory: null`). A browser-only simulation that mirrors the contract
  arithmetic. No wallet, no chain, nothing signed or sent. State lives in `localStorage`; "Reset
  sandbox data" in the footer restores the seed. This is the fastest way to judge the full loop.
- **Live, Monad Testnet** (after you deploy). Reads go over public RPC (and the Envio indexer when
  configured); writes are signed in the page by the visitor's Mera passkey account. The account menu
  switches back to the sandbox.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node 20+.

## 30-second judge walkthrough (sandbox)

1. **Landing** — scroll: the DropShare certificate assembles, then the Attention Mining graph loops.
2. **Explore campaigns → Midnight Static** — 72% funded, 3 days left, a populated Attention Leaderboard.
3. Hit **Simulate a referred fan** in the gold panel — a new fan backs the drop through *your* link,
   bonus DropShares land on you, and you appear on the leaderboard. That's Attention Mining.
4. Enter `200` and **Back this drop** — the contribution is capped at the goal, the ring fills to 100%.
5. **Finalize campaign** — the "Creator 80% / Fan Pool 20%" split animates in.
6. **Distribute revenue** (100 MON) → your claimable share appears → **Claim my share**.
7. **Vote on what drops next** → pick an example question → vote → **Simulate fan votes**. After 90
   seconds, **Execute proposal** records the winner.

## Bounty layers

The core loop is fund → own → earn → govern. These three sit on top of it; none of them is required
for the loop to work, and each degrades to a clear "not configured" state.

### Mera — passkeys as the whole account layer

`src/lib/mera.ts`, `@category-labs/mera` 0.2.0. There is no browser-extension path in the app.

- **Create passkey account**: one WebAuthn prompt. Mera returns the passkey's PRF output; the app
  derives a BIP-44 Ethereum key from it (Mera's documented recipe), wraps it in a Mera secp256k1
  signing session and adapts that to a viem account.
- **Transactions** are signed in the tab by that session and sent straight to the Monad RPC. No
  bundler, no relayer, no custody backend, no seed phrase shown or stored.
- **Only the credential id is persisted** (`localStorage`); it holds no key material. On return, one
  prompt unlocks the same address. **Lock** zeroes the in-memory key.
- The account menu shows the address, testnet balance and a faucet link, since a new account needs
  testnet MON for gas. There is no gas sponsorship.
- Passkeys are bound to the site's domain. An account created on `localhost` is a different account
  from one created on the Vercel domain, and changing the production domain orphans existing accounts.
- Requires a passkey provider with WebAuthn PRF support (current Chrome, Safari, Edge with platform
  passkeys). Unsupported authenticators get a plain-language error.

### Envio HyperIndex — leaderboard and analytics from indexed events

`indexer/` is a self-contained HyperIndex v3 project (`config.yaml`, `schema.graphql`,
`src/handlers/DropOwn.ts`). The factory's `CampaignCreated` event registers each campaign dynamically;
`Contributed`, `ReferralRewarded`, `CampaignFinalized`, `RevenueDistributed` and `RevenueClaimed` then
maintain campaign rows, a contribution feed, per-campaign and global referrer tables, and a revenue
ledger.

With `NEXT_PUBLIC_ENVIO_URL` set, the frontend (`src/lib/envio.ts`) uses it for:

- **Attention Leaderboard** — top referrers and bonus shares earned, per drop and across all drops.
- **Live analytics panel** on each campaign — contribution velocity (MON per 24h over 7 days), share
  of volume that arrived via referrals, a latest-activity feed linked to the explorer, and
  revenue-split status (distributed, fan pool, percent claimed).

Without it, live mode reads the leaderboard from the contracts and the analytics panel says the
indexer isn't connected. The sandbox shows the same panel from simulated events, labelled as such.

```bash
cd indexer
npm install            # needs Node 22.15+ (24 recommended)
cp .env.example .env   # add a free ENVIO_API_TOKEN for HyperSync
npm run codegen
npm run dev            # needs Docker; GraphQL at http://localhost:8080/v1/graphql
```

`npm run seed` writes the deployed factory address and start block into `indexer/config.yaml`. For a
public URL, deploy the indexer on Envio's hosted service and put its endpoint in
`NEXT_PUBLIC_ENVIO_URL`.

### KIMI — Campaign Copilot

`src/app/api/copilot/route.ts` is a small agent loop over Moonshot's OpenAI-compatible chat API
(default model `kimi-k3`). The key stays on the server in `MOONSHOT_API_KEY`.

- **Creators** (`/create`): describe the release; the copilot checks peer campaigns' goals through a
  tool, then returns a pitch line, a release blurb and a suggested goal with one-click "use" buttons.
- **Fans** (campaign page): ask about shares, bonuses and revenue. The model has tools for campaign
  terms, your position, share estimates and revenue what-ifs, which run the contract formulas over
  the page's data, so it reports computed numbers instead of doing its own arithmetic.
- **Governance**: "Summarize with KIMI" on any proposal, instructed to stay neutral.

All model output renders in an **AI-assisted · KIMI** box with a "may be wrong, not financial advice"
note. The system prompt forbids promising returns. Without a key the copilot shows as offline and
nothing else changes.

## Contracts

`contracts/`, Solidity 0.8.28, Foundry. All original code, no external contract dependencies.

| Contract | Role |
| --- | --- |
| `DropOwnFactory` | `createCampaign(goal, fanSharePercent, attentionPoolPercent, deadline, metadataURI)`; deploys a campaign and its governance, keeps the directory |
| `DropCampaign` | `contribute(referrer)`, `finalizeCampaign()`, `distributeRevenue()`, `claimRevenue()`, `refund()`; holds the DropShare ledger |
| `DropGovernance` | `createProposal(description, options)`, `castVote(proposalId, optionIndex)`, `executeProposal(proposalId)` |
| `ReferralRegistry` | Referral code → address, plus a cross-campaign conversion tally for the global leaderboard |

Design decisions worth knowing:

- **1,000,000 DropShares per campaign.** `attentionPoolPercent` of them are reserved for referral
  bonuses; the rest mint pro-rata to `contribution / goal`.
- **DropShares are non-transferable.** They expose an ERC-20-style read interface (`balanceOf`,
  `totalSupply`) but `transfer` reverts. A share is earned by funding or by bringing attention to one
  release. This also keeps revenue accounting simple and makes vote weights a plain balance read,
  since supply is frozen at finalization.
- **Contributions are capped at the goal**; any excess is returned in the same call.
- **A referral counts once per new contributor**, never for self-referral, and bonuses are clipped to
  what is left in the Attention Pool.
- **Revenue uses pull payments.** `distributeRevenue()` updates a per-share accumulator; holders
  `claimRevenue()`. Revenue is divided across *minted* shares, so an unspent Attention Pool doesn't
  strand funds.
- **If the deadline passes below goal**, contributors `refund()` in full.
- **Governance is signalling only.** `executeProposal` records the winning option onchain; it moves no
  funds. Ties resolve to the lowest option index.
- **Metadata is an inline `data:` JSON URI**, so no pinning service is needed.

### Tests

```bash
forge test
```

25 tests cover campaign creation, contribution and share minting, referral bonus minting (including
self-referral, repeat contributors and pool clipping), goal finalization, refunds, pro-rata revenue
distribution (with a fuzz test that the contract never owes more than it holds), and governance voting.

## Deploying to Monad Testnet

**You run this, with your own key.** Nothing in this repo deploys on its own, and no key is stored
in it. Use a throwaway wallet that only ever holds testnet MON.

Monad Testnet: chain id `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer
`https://testnet.monadexplorer.com`.

### Option A — deploy and seed in one step

```bash
cp .env.example .env.local      # then set DEPLOYER_PRIVATE_KEY (testnet-only key)
forge build
npm run seed -- --dry-run       # prints the plan, sends nothing
npm run seed
```

`scripts/seed.ts` deploys the factory, creates two campaigns (one at 72% of a 1 MON goal, one just
launched), generates eight throwaway fan wallets in memory, funds them, registers their referral
codes, makes 8 contributions (5 of them referral conversions) and writes the addresses to
`src/config/deployments.json`. Budget roughly 2.5 testnet MON. The script refuses to run on any chain
other than 10143.

### Option B — deploy only

```bash
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account <your-keystore-name>
```

Then put the printed factory and registry addresses into `src/config/deployments.json`.

### Frontend on Vercel

```bash
vercel          # preview
vercel --prod   # production
```

The core app needs no environment variables: it reads `src/config/deployments.json`. Deploy before
seeding to ship the sandbox, or after to ship live mode. Optional variables (see `.env.example`):
`NEXT_PUBLIC_ENVIO_URL` for the indexer and `MOONSHOT_API_KEY` for the copilot. Set the key in
Vercel's project settings, never in a `NEXT_PUBLIC_` variable.

### Deployed addresses

Not deployed yet. After `npm run seed`, addresses appear in `src/config/deployments.json` and in the
site footer.

## For judges: using live mode

1. Open the site and click **Sign in** → **Create passkey account**. One biometric prompt; no
   extension, no seed phrase.
2. Open the account menu, copy your address and fund it from the Monad faucet.
3. Pick a campaign and **Back this drop** with a small amount.
4. Copy your referral link, open it in another browser profile, create a second passkey account there
   and back the drop: the first account earns bonus DropShares and climbs the leaderboard.
5. No testnet MON? Use **Switch to demo sandbox** in the account menu for the full loop with simulated
   data.

## Frontend

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Lenis · viem · Mera · Envio HyperIndex · KIMI.

| Route | What's there |
| --- | --- |
| `/` | Landing: scroll-assembled certificate, three moves, Attention Mining graph |
| `/create` | Launch a campaign with a live certificate and split preview |
| `/campaign/[id]` | Progress ring, contribute, referral link, Attention Leaderboard, revenue split |
| `/dashboard` | All campaigns, my shares, my campaigns, cross-campaign leaderboard |
| `/governance/[id]` | Proposals and share-weighted voting |

```
contracts/            Solidity sources
test/                 Foundry tests
script/Deploy.s.sol   Deploy-only Foundry script
scripts/seed.ts       Deploy + demo seeding (viem)
indexer/              Envio HyperIndex project (own package.json)
src/app/api/copilot/  KIMI copilot route
src/lib/              types, demo sandbox, chain source, store, ABIs, mera, envio
src/components/       UI kit, certificate, ring, leaderboard, page views
src/config/           deployments.json
```

### Visual identity: "The Ownership Drop"

Ink and paper editorial base, indigo as the ownership/verification signal, gold reserved for Attention
Mining. Rectangular controls, 1px borders, 8–12px radii, one restrained shadow. All visuals are CSS,
SVG and type: the DropShare certificate, a 72-tick progress bezel, the split bar and the referral
graph. Animations use transform and opacity only, and `prefers-reduced-motion` gets a static layout
with smooth scrolling off.

**Fonts.** Clash Display (headlines, titles, big numbers), General Sans (body, buttons, forms) and
IBM Plex Mono (addresses, amounts, labels). Clash Display and General Sans are Fontshare faces that
Google Fonts doesn't carry, so `next/font/google` can't serve them; they load from Fontshare's own CSS
endpoint in `src/app/layout.tsx`. IBM Plex Mono uses `next/font/google`. To avoid the third-party
request, self-host the two faces with `next/font/local` under the Fontshare licence.

**States.** Loading is a skeleton of the page that's coming, never a lone spinner. Empty states have a
small drawn mark, a line of encouragement and one way forward. Errors are a sentence a fan can act on
(technical detail goes to the console). Status never relies on colour alone: each state carries its
own glyph or word.

**Accessibility.** Lighthouse accessibility scores 100 on `/`, `/create`, `/dashboard`,
`/campaign/0` and `/governance/0` (production build, sandbox data, default mobile emulation). Touch
targets are 44px or larger, there is no horizontal scroll at 360px, and the campaign page keeps a
sticky "Back this drop" bar within reach on phones.

## Known limitations

- **No sybil resistance.** One person with two wallets can refer themselves and collect the bonus. The
  first-contribution rule and the capped Attention Pool bound the effect; they don't prevent it.
- **Revenue is self-reported.** `distributeRevenue()` splits whatever is sent to it. Nothing onchain
  verifies that it reflects real-world earnings from the release.
- **Leaderboards are read from contract arrays**, which is fine at demo scale and would need an
  indexer beyond it.
- **`scripts/seed.ts` has been type-checked and dry-run only.** It has not been executed against a
  live chain from this repo.
- **The three bounty layers are built but not yet exercised end to end.** The passkey ceremony needs a
  real authenticator; the indexer's config and handlers pass `envio codegen` and typecheck but have not
  synced a deployed contract; the copilot's tool loop was tested against a local stub, not the real
  Moonshot API.
- **A passkey account's key lives in page memory while unlocked.** That is Mera's model (no custody
  server), and it means the page's own scripts are trusted with it. Treat it as a testnet account.
- Unaudited. DropShares as designed may be regulated instruments in many jurisdictions; this is a
  prototype of a mechanism, not an offering.
