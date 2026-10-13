// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal surface of the ReferralRegistry that a campaign reports conversions to.
interface IConversionSink {
    function recordConversion(address referrer, address contributor, uint256 amount, uint256 bonusShares) external;
}

/// @title DropCampaign
/// @notice One fan-funded release. Contributions mint DropShares, referrals that convert mint
///         bonus DropShares from the Attention Pool, and post-release revenue is split between
///         the creator and all DropShare holders.
/// @dev DropShares expose an ERC-20 style read interface (`balanceOf`, `totalSupply`, ...) but are
///      deliberately non-transferable: a share is a claim earned by funding or by bringing
///      attention to this specific release. Keeping them bound to the earner keeps revenue
///      accounting and vote weights trivial to reason about.
///      Hackathon demonstration code. Unaudited.
contract DropCampaign {
    // ------------------------------------------------------------------ constants

    /// @notice Fixed number of DropShares that can ever exist for a campaign (18 decimals).
    uint256 public constant TOTAL_SHARES = 1_000_000e18;
    uint256 public constant BPS = 10_000;
    /// @dev Precision multiplier for the cumulative revenue-per-share accumulator.
    uint256 private constant PRECISION = 1e27;

    string public constant name = "DropShares";
    string public constant symbol = "DROP";
    uint8 public constant decimals = 18;

    // ------------------------------------------------------------------ immutable terms

    /// @notice Factory that deployed this campaign.
    address public immutable factory;
    /// @notice Creator who receives the raise and the creator side of revenue.
    address public immutable creator;
    /// @notice Registry notified of referral conversions (may be the zero address).
    address public immutable registry;
    /// @notice Funding goal in wei. Contributions are capped at this amount.
    uint256 public immutable goal;
    /// @notice Unix timestamp after which contributions close.
    uint256 public immutable deadline;
    /// @notice Share of every revenue payment routed to DropShare holders, in basis points.
    uint256 public immutable fanShareBps;
    /// @notice Bonus paid to a referrer, as basis points of the shares their referral minted.
    uint256 public immutable referralBonusBps;
    /// @notice DropShares reserved for contributors (minted pro-rata to contribution / goal).
    uint256 public immutable contributorPool;
    /// @notice DropShares reserved for Attention Mining rewards.
    uint256 public immutable attentionPool;

    // ------------------------------------------------------------------ state

    /// @notice Off-chain or inline (data URI) JSON describing the release.
    string public metadataURI;

    uint256 public totalRaised;
    uint256 public totalSupply;
    /// @notice Bonus DropShares minted out of the Attention Pool so far.
    uint256 public attentionMinted;
    bool public finalized;
    uint256 public finalizedAt;

    /// @notice Total revenue ever passed through `distributeRevenue`.
    uint256 public totalRevenue;
    /// @notice Creator revenue waiting to be withdrawn.
    uint256 public creatorClaimable;
    uint256 private _revenuePerShare;
    uint256 private _lock = 1;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public contributionOf;
    /// @notice Bonus DropShares an address earned through referrals.
    mapping(address => uint256) public bonusSharesOf;
    /// @notice Number of new contributors an address converted.
    mapping(address => uint256) public conversionsOf;
    mapping(address => uint256) public revenueClaimedOf;

    address[] private _contributors;
    address[] private _referrers;

    // ------------------------------------------------------------------ events

    event Contributed(address indexed contributor, address indexed referrer, uint256 amount, uint256 shares);
    event ReferralRewarded(
        address indexed referrer, address indexed contributor, uint256 contribution, uint256 bonusShares
    );
    event CampaignFinalized(uint256 totalRaised, uint256 totalShares, uint256 timestamp);
    event RevenueDistributed(address indexed payer, uint256 amount, uint256 creatorCut, uint256 fanCut);
    event RevenueClaimed(address indexed holder, uint256 amount);
    event CreatorRevenueWithdrawn(uint256 amount);
    event Refunded(address indexed contributor, uint256 amount);

    // ------------------------------------------------------------------ errors

    error InvalidTerms();
    error CampaignClosed();
    error GoalNotReached();
    error AlreadyFinalized();
    error NotFinalized();
    error ZeroAmount();
    error NothingToClaim();
    error RefundUnavailable();
    error NotCreator();
    error TransferFailed();
    error Reentrancy();
    error NonTransferable();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @param creator_ Address that receives the raise and creator revenue.
    /// @param registry_ ReferralRegistry to notify on conversions, or address(0) for none.
    /// @param goal_ Funding goal in wei.
    /// @param fanShareBps_ Basis points of revenue routed to DropShare holders (1-10000).
    /// @param attentionPoolBps_ Basis points of TOTAL_SHARES reserved for referral bonuses (0-5000).
    /// @param referralBonusBps_ Bonus per conversion, in basis points of the referred shares (0-2500).
    /// @param deadline_ Unix timestamp when funding closes.
    /// @param metadataURI_ Release metadata.
    constructor(
        address creator_,
        address registry_,
        uint256 goal_,
        uint256 fanShareBps_,
        uint256 attentionPoolBps_,
        uint256 referralBonusBps_,
        uint256 deadline_,
        string memory metadataURI_
    ) {
        if (
            creator_ == address(0) || goal_ == 0 || fanShareBps_ == 0 || fanShareBps_ > BPS || attentionPoolBps_ > 5_000
                || referralBonusBps_ > 2_500 || deadline_ <= block.timestamp
        ) revert InvalidTerms();

        factory = msg.sender;
        creator = creator_;
        registry = registry_;
        goal = goal_;
        fanShareBps = fanShareBps_;
        referralBonusBps = referralBonusBps_;
        deadline = deadline_;
        metadataURI = metadataURI_;

        uint256 attention = (TOTAL_SHARES * attentionPoolBps_) / BPS;
        attentionPool = attention;
        contributorPool = TOTAL_SHARES - attention;
    }

    // ------------------------------------------------------------------ funding

    /// @notice Back the drop. Mints DropShares pro-rata to the accepted contribution.
    /// @dev Contributions are capped at the goal; any excess is returned in the same call.
    ///      A referral only counts as a conversion on the contributor's first contribution,
    ///      and never for self-referrals.
    /// @param referrer Address whose link brought the contributor here, or address(0).
    /// @return shares DropShares minted to the caller.
    function contribute(address referrer) external payable nonReentrant returns (uint256 shares) {
        if (finalized || block.timestamp >= deadline || totalRaised >= goal) revert CampaignClosed();
        if (msg.value == 0) revert ZeroAmount();

        uint256 remaining = goal - totalRaised;
        uint256 accepted = msg.value > remaining ? remaining : msg.value;
        bool isNewContributor = contributionOf[msg.sender] == 0;

        shares = (accepted * contributorPool) / goal;
        totalRaised += accepted;
        contributionOf[msg.sender] += accepted;
        balanceOf[msg.sender] += shares;
        totalSupply += shares;
        if (isNewContributor) _contributors.push(msg.sender);

        emit Contributed(msg.sender, referrer, accepted, shares);

        if (isNewContributor && referrer != address(0) && referrer != msg.sender) {
            _rewardReferral(referrer, msg.sender, accepted, shares);
        }

        if (msg.value > accepted) _send(msg.sender, msg.value - accepted);
    }

    /// @dev Mints the referral bonus out of the Attention Pool, clipped to what is left in it.
    function _rewardReferral(address referrer, address contributor, uint256 amount, uint256 shares) private {
        uint256 bonus = (shares * referralBonusBps) / BPS;
        uint256 left = attentionPool - attentionMinted;
        if (bonus > left) bonus = left;
        if (bonus == 0) return;

        if (conversionsOf[referrer] == 0) _referrers.push(referrer);
        conversionsOf[referrer] += 1;
        bonusSharesOf[referrer] += bonus;
        balanceOf[referrer] += bonus;
        attentionMinted += bonus;
        totalSupply += bonus;

        emit ReferralRewarded(referrer, contributor, amount, bonus);

        if (registry != address(0)) {
            // The registry is bookkeeping only; it must never be able to block funding.
            try IConversionSink(registry).recordConversion(referrer, contributor, amount, bonus) {} catch {}
        }
    }

    /// @notice Lock the raise once the goal is hit: releases funds to the creator and
    ///         activates the revenue split. Callable by anyone.
    function finalizeCampaign() external nonReentrant {
        if (finalized) revert AlreadyFinalized();
        if (totalRaised < goal) revert GoalNotReached();

        finalized = true;
        finalizedAt = block.timestamp;
        emit CampaignFinalized(totalRaised, totalSupply, block.timestamp);

        _send(creator, totalRaised);
    }

    /// @notice Reclaim a contribution when the deadline passed without reaching the goal.
    function refund() external nonReentrant {
        if (finalized || block.timestamp < deadline || totalRaised >= goal) revert RefundUnavailable();
        uint256 amount = contributionOf[msg.sender];
        if (amount == 0) revert NothingToClaim();

        contributionOf[msg.sender] = 0;
        totalSupply -= balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        totalRaised -= amount;

        emit Refunded(msg.sender, amount);
        _send(msg.sender, amount);
    }

    // ------------------------------------------------------------------ revenue

    /// @notice Pay release revenue into the split. `fanShareBps` goes to DropShare holders
    ///         pro-rata, the remainder to the creator. Callable by anyone after finalization.
    function distributeRevenue() external payable {
        if (!finalized) revert NotFinalized();
        if (msg.value == 0) revert ZeroAmount();

        uint256 fanCut = (msg.value * fanShareBps) / BPS;
        uint256 creatorCut = msg.value - fanCut;

        _revenuePerShare += (fanCut * PRECISION) / totalSupply;
        creatorClaimable += creatorCut;
        totalRevenue += msg.value;

        emit RevenueDistributed(msg.sender, msg.value, creatorCut, fanCut);
    }

    /// @notice Revenue a holder can claim right now.
    function claimableRevenue(address holder) public view returns (uint256) {
        return (balanceOf[holder] * _revenuePerShare) / PRECISION - revenueClaimedOf[holder];
    }

    /// @notice Claim the caller's share of distributed revenue.
    function claimRevenue() external nonReentrant returns (uint256 amount) {
        amount = claimableRevenue(msg.sender);
        if (amount == 0) revert NothingToClaim();
        revenueClaimedOf[msg.sender] += amount;
        emit RevenueClaimed(msg.sender, amount);
        _send(msg.sender, amount);
    }

    /// @notice Withdraw the creator side of distributed revenue.
    function withdrawCreatorRevenue() external nonReentrant returns (uint256 amount) {
        if (msg.sender != creator) revert NotCreator();
        amount = creatorClaimable;
        if (amount == 0) revert NothingToClaim();
        creatorClaimable = 0;
        emit CreatorRevenueWithdrawn(amount);
        _send(creator, amount);
    }

    // ------------------------------------------------------------------ views

    /// @notice Everything a client needs to render the campaign, in one call.
    struct Summary {
        address creator;
        uint256 goal;
        uint256 deadline;
        uint256 fanShareBps;
        uint256 referralBonusBps;
        uint256 contributorPool;
        uint256 attentionPool;
        uint256 totalRaised;
        uint256 totalSupply;
        uint256 attentionMinted;
        uint256 totalRevenue;
        uint256 contributorCount;
        bool finalized;
        string metadataURI;
    }

    function getSummary() external view returns (Summary memory) {
        return Summary({
            creator: creator,
            goal: goal,
            deadline: deadline,
            fanShareBps: fanShareBps,
            referralBonusBps: referralBonusBps,
            contributorPool: contributorPool,
            attentionPool: attentionPool,
            totalRaised: totalRaised,
            totalSupply: totalSupply,
            attentionMinted: attentionMinted,
            totalRevenue: totalRevenue,
            contributorCount: _contributors.length,
            finalized: finalized,
            metadataURI: metadataURI
        });
    }

    /// @notice A single account's stake in this campaign.
    function positionOf(address account)
        external
        view
        returns (uint256 contributed, uint256 shares, uint256 bonusShares, uint256 conversions, uint256 claimable)
    {
        return (
            contributionOf[account],
            balanceOf[account],
            bonusSharesOf[account],
            conversionsOf[account],
            claimableRevenue(account)
        );
    }

    /// @notice Every referrer with at least one conversion, unsorted. Clients sort for display.
    function getLeaderboard()
        external
        view
        returns (address[] memory referrers, uint256[] memory conversions, uint256[] memory bonusShares)
    {
        uint256 n = _referrers.length;
        referrers = _referrers;
        conversions = new uint256[](n);
        bonusShares = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            conversions[i] = conversionsOf[referrers[i]];
            bonusShares[i] = bonusSharesOf[referrers[i]];
        }
    }

    function contributorCount() external view returns (uint256) {
        return _contributors.length;
    }

    function contributorAt(uint256 index) external view returns (address) {
        return _contributors[index];
    }

    // ------------------------------------------------------------------ non-transferable shares

    /// @notice DropShares stay with whoever earned them.
    function transfer(address, uint256) external pure returns (bool) {
        revert NonTransferable();
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
