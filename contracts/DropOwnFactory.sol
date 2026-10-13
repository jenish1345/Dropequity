// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DropCampaign} from "./DropCampaign.sol";
import {DropGovernance} from "./DropGovernance.sol";
import {ReferralRegistry} from "./ReferralRegistry.sol";

/// @title DropOwnFactory
/// @notice Entry point for DropOwn. Deploys one DropCampaign and its DropGovernance per release
///         and keeps the directory that clients and the ReferralRegistry read from.
/// @dev Hackathon demonstration code. Unaudited.
contract DropOwnFactory {
    /// @notice Referral bonus applied to every campaign: 10% of the referred contribution's shares.
    uint256 public constant REFERRAL_BONUS_BPS = 1_000;
    /// @notice Largest slice of DropShares a creator may reserve for the Attention Pool.
    uint256 public constant MAX_ATTENTION_POOL_PERCENT = 50;

    /// @notice Shared referral-code registry and cross-campaign conversion tally.
    ReferralRegistry public immutable registry;
    /// @notice Voting period, in seconds, given to every campaign's governance contract.
    uint256 public immutable votingPeriod;

    address[] private _campaigns;
    mapping(address => bool) public isCampaign;
    mapping(address => address) public governanceOf;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed campaign,
        address indexed creator,
        address governance,
        uint256 goal,
        uint256 fanSharePercent,
        uint256 attentionPoolPercent,
        uint256 deadline,
        string metadataURI
    );

    error InvalidPercent();

    /// @param votingPeriod_ Seconds each governance proposal stays open.
    constructor(uint256 votingPeriod_) {
        votingPeriod = votingPeriod_;
        registry = new ReferralRegistry(address(this));
    }

    /// @notice Launch a campaign for an upcoming release. The caller becomes its creator.
    /// @param goal Funding goal in wei.
    /// @param fanSharePercent Whole percent of release revenue routed to DropShare holders (1-100).
    /// @param attentionPoolPercent Whole percent of DropShares reserved for referral bonuses (0-50).
    /// @param deadline Unix timestamp when funding closes.
    /// @param metadataURI Release metadata (https, ipfs or inline data URI).
    /// @return campaignId Index of the campaign in this factory.
    /// @return campaign Address of the new DropCampaign.
    function createCampaign(
        uint256 goal,
        uint256 fanSharePercent,
        uint256 attentionPoolPercent,
        uint256 deadline,
        string calldata metadataURI
    ) external returns (uint256 campaignId, address campaign) {
        if (fanSharePercent == 0 || fanSharePercent > 100 || attentionPoolPercent > MAX_ATTENTION_POOL_PERCENT) {
            revert InvalidPercent();
        }

        campaign = address(
            new DropCampaign(
                msg.sender,
                address(registry),
                goal,
                fanSharePercent * 100,
                attentionPoolPercent * 100,
                REFERRAL_BONUS_BPS,
                deadline,
                metadataURI
            )
        );
        address governance = address(new DropGovernance(campaign, votingPeriod));

        campaignId = _campaigns.length;
        _campaigns.push(campaign);
        isCampaign[campaign] = true;
        governanceOf[campaign] = governance;

        emit CampaignCreated(
            campaignId,
            campaign,
            msg.sender,
            governance,
            goal,
            fanSharePercent,
            attentionPoolPercent,
            deadline,
            metadataURI
        );
    }

    function campaignCount() external view returns (uint256) {
        return _campaigns.length;
    }

    function campaignAt(uint256 campaignId) external view returns (address) {
        return _campaigns[campaignId];
    }

    /// @notice All campaign addresses, oldest first.
    function getCampaigns() external view returns (address[] memory) {
        return _campaigns;
    }
}
