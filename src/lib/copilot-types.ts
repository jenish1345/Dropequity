/** Wire types shared by the copilot UI and the /api/copilot route. Amounts are plain MON numbers. */

export type CopilotCampaign = {
  title: string;
  kind: string;
  creatorName: string;
  tagline: string;
  goalMon: number;
  raisedMon: number;
  fanSharePercent: number;
  attentionPoolPercent: number;
  referralBonusPercent: number;
  contributorPoolShares: number;
  totalShares: number;
  attentionSharesLeft: number;
  totalRevenueMon: number;
  status: string;
  timeLeft: string;
};

export type CopilotPosition = {
  contributedMon: number;
  shares: number;
  bonusShares: number;
  conversions: number;
  claimableMon: number;
};

export type CopilotProposal = {
  number: number;
  question: string;
  options: { label: string; shares: number }[];
  state: string;
};

export type CopilotPeer = { title: string; kind: string; goalMon: number; raisedMon: number };

export type CopilotRequest =
  | { task: "draft"; idea: string; kind: string; creatorName: string; peers: CopilotPeer[] }
  | {
      task: "ask";
      question: string;
      campaign: CopilotCampaign;
      position: CopilotPosition | null;
      proposals: CopilotProposal[];
    }
  | { task: "summarize"; campaign: CopilotCampaign; proposal: CopilotProposal };

export type CopilotDraft = { tagline: string; blurb: string; suggestedGoalMon: number; goalRationale: string };

export type CopilotResponse = { text: string } | { draft: CopilotDraft } | { error: string };
