import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function createCampaign(uint256 goal, uint256 fanSharePercent, uint256 attentionPoolPercent, uint256 deadline, string metadataURI) returns (uint256 campaignId, address campaign)",
  "function getCampaigns() view returns (address[])",
  "function campaignCount() view returns (uint256)",
  "function campaignAt(uint256 campaignId) view returns (address)",
  "function governanceOf(address campaign) view returns (address)",
  "function registry() view returns (address)",
  "function votingPeriod() view returns (uint256)",
  "event CampaignCreated(uint256 indexed campaignId, address indexed campaign, address indexed creator, address governance, uint256 goal, uint256 fanSharePercent, uint256 attentionPoolPercent, uint256 deadline, string metadataURI)",
]);

export const campaignAbi = parseAbi([
  "struct Summary { address creator; uint256 goal; uint256 deadline; uint256 fanShareBps; uint256 referralBonusBps; uint256 contributorPool; uint256 attentionPool; uint256 totalRaised; uint256 totalSupply; uint256 attentionMinted; uint256 totalRevenue; uint256 contributorCount; bool finalized; string metadataURI; }",
  "function getSummary() view returns (Summary)",
  "function positionOf(address account) view returns (uint256 contributed, uint256 shares, uint256 bonusShares, uint256 conversions, uint256 claimable)",
  "function getLeaderboard() view returns (address[] referrers, uint256[] conversions, uint256[] bonusShares)",
  "function creatorClaimable() view returns (uint256)",
  "function contribute(address referrer) payable returns (uint256 shares)",
  "function finalizeCampaign()",
  "function refund()",
  "function distributeRevenue() payable",
  "function claimRevenue() returns (uint256 amount)",
  "function withdrawCreatorRevenue() returns (uint256 amount)",
]);

export const governanceAbi = parseAbi([
  "struct Proposal { address proposer; string description; string[] options; uint256[] votes; uint256 startTime; uint256 endTime; uint256 totalVotes; bool executed; uint256 winningOption; }",
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (Proposal)",
  "function voteOf(uint256 proposalId, address voter) view returns (uint256)",
  "function createProposal(string description, string[] options) returns (uint256 proposalId)",
  "function castVote(uint256 proposalId, uint256 optionIndex)",
  "function executeProposal(uint256 proposalId) returns (uint256 winningOption)",
]);

export const registryAbi = parseAbi([
  "function registerCode(string code)",
  "function referrerOf(string code) view returns (address)",
  "function codeOf(address account) view returns (string)",
  "function getLeaderboard() view returns (address[] referrers, uint256[] conversions, uint256[] bonusShares)",
]);
