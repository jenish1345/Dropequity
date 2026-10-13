import { indexer } from "envio";

/**
 * DropOwn event handlers.
 * The factory announces each campaign; from then on that campaign's own events keep
 * four views current: the campaign row, its contribution feed, the per-campaign and
 * global Attention Leaderboards, and the revenue-split ledger.
 */

const lower = (address: string) => address.toLowerCase();

// Start indexing a campaign the moment the factory creates it.
indexer.contractRegister({ contract: "DropOwnFactory", event: "CampaignCreated" }, async ({ event, context }) => {
  context.chain.DropCampaign.add(event.params.campaign);
});

indexer.onEvent({ contract: "DropOwnFactory", event: "CampaignCreated" }, async ({ event, context }) => {
  context.Campaign.set({
    id: lower(event.params.campaign),
    campaignId: event.params.campaignId,
    creator: lower(event.params.creator),
    governance: lower(event.params.governance),
    goal: event.params.goal,
    fanSharePercent: Number(event.params.fanSharePercent),
    attentionPoolPercent: Number(event.params.attentionPoolPercent),
    deadline: event.params.deadline,
    metadataURI: event.params.metadataURI,
    createdAt: event.block.timestamp,
    totalRaised: 0n,
    contributionCount: 0,
    referredCount: 0,
    bonusSharesMinted: 0n,
    finalized: false,
    finalizedAt: undefined,
    totalRevenue: 0n,
    creatorRevenue: 0n,
    fanRevenue: 0n,
    fanRevenueClaimed: 0n,
  });
});

const logId = (chainId: number, blockNumber: number, logIndex: number) => `${chainId}_${blockNumber}_${logIndex}`;

indexer.onEvent({ contract: "DropCampaign", event: "Contributed" }, async ({ event, context }) => {
  const campaignId = lower(event.srcAddress);

  context.Contribution.set({
    id: logId(event.chainId, event.block.number, event.logIndex),
    campaign: campaignId,
    contributor: lower(event.params.contributor),
    // Only set once a ReferralRewarded event confirms the referral actually converted.
    referrer: undefined,
    amount: event.params.amount,
    shares: event.params.shares,
    bonusShares: 0n,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    context.Campaign.set({
      ...campaign,
      totalRaised: campaign.totalRaised + event.params.amount,
      contributionCount: campaign.contributionCount + 1,
    });
  }
});

indexer.onEvent({ contract: "DropCampaign", event: "ReferralRewarded" }, async ({ event, context }) => {
  const campaignId = lower(event.srcAddress);
  const referrer = lower(event.params.referrer);
  const { contribution: amount, bonusShares } = event.params;

  // The campaign emits ReferralRewarded directly after the Contributed it belongs to.
  const contribution = await context.Contribution.get(logId(event.chainId, event.block.number, event.logIndex - 1));
  if (contribution) context.Contribution.set({ ...contribution, referrer, bonusShares });

  const rowId = `${campaignId}_${referrer}`;
  const row = await context.CampaignReferrer.get(rowId);
  context.CampaignReferrer.set({
    id: rowId,
    campaign: campaignId,
    referrer,
    conversions: (row?.conversions ?? 0) + 1,
    bonusShares: (row?.bonusShares ?? 0n) + bonusShares,
    referredVolume: (row?.referredVolume ?? 0n) + amount,
  });

  const global = await context.Referrer.get(referrer);
  context.Referrer.set({
    id: referrer,
    conversions: (global?.conversions ?? 0) + 1,
    bonusShares: (global?.bonusShares ?? 0n) + bonusShares,
    referredVolume: (global?.referredVolume ?? 0n) + amount,
  });

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    context.Campaign.set({
      ...campaign,
      referredCount: campaign.referredCount + 1,
      bonusSharesMinted: campaign.bonusSharesMinted + bonusShares,
    });
  }
});

indexer.onEvent({ contract: "DropCampaign", event: "CampaignFinalized" }, async ({ event, context }) => {
  const campaign = await context.Campaign.get(lower(event.srcAddress));
  if (campaign) context.Campaign.set({ ...campaign, finalized: true, finalizedAt: event.block.timestamp });
});

indexer.onEvent({ contract: "DropCampaign", event: "RevenueDistributed" }, async ({ event, context }) => {
  const campaignId = lower(event.srcAddress);
  const { amount, creatorCut, fanCut } = event.params;

  context.RevenueDistribution.set({
    id: logId(event.chainId, event.block.number, event.logIndex),
    campaign: campaignId,
    payer: lower(event.params.payer),
    amount,
    creatorCut,
    fanCut,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  const campaign = await context.Campaign.get(campaignId);
  if (campaign) {
    context.Campaign.set({
      ...campaign,
      totalRevenue: campaign.totalRevenue + amount,
      creatorRevenue: campaign.creatorRevenue + creatorCut,
      fanRevenue: campaign.fanRevenue + fanCut,
    });
  }
});

indexer.onEvent({ contract: "DropCampaign", event: "RevenueClaimed" }, async ({ event, context }) => {
  const campaign = await context.Campaign.get(lower(event.srcAddress));
  if (campaign) {
    context.Campaign.set({ ...campaign, fanRevenueClaimed: campaign.fanRevenueClaimed + event.params.amount });
  }
});
