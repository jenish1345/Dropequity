// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DropOwnFactory} from "../contracts/DropOwnFactory.sol";
import {DropCampaign} from "../contracts/DropCampaign.sol";
import {DropGovernance} from "../contracts/DropGovernance.sol";
import {ReferralRegistry} from "../contracts/ReferralRegistry.sol";

contract DropOwnTest is Test {
    uint256 constant GOAL = 100 ether;
    uint256 constant VOTING_PERIOD = 1 days;
    uint256 constant TOTAL = 1_000_000e18;

    DropOwnFactory factory;
    ReferralRegistry registry;
    DropCampaign campaign;
    DropGovernance governance;

    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address label = makeAddr("label");

    function setUp() public {
        factory = new DropOwnFactory(VOTING_PERIOD);
        registry = factory.registry();

        vm.prank(creator);
        (, address c) = factory.createCampaign(GOAL, 20, 10, block.timestamp + 7 days, "ipfs://drop");
        campaign = DropCampaign(c);
        governance = DropGovernance(factory.governanceOf(c));

        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(carol, 1_000 ether);
        vm.deal(label, 1_000 ether);
    }

    function _fund() internal {
        vm.prank(alice);
        campaign.contribute{value: 50 ether}(address(0));
        vm.prank(bob);
        campaign.contribute{value: 30 ether}(alice);
        vm.prank(carol);
        campaign.contribute{value: 20 ether}(alice);
    }

    function _finalize() internal {
        _fund();
        campaign.finalizeCampaign();
    }

    // ---------------------------------------------------------------- campaign creation

    function test_CreateCampaign_StoresTerms() public view {
        assertEq(factory.campaignCount(), 1);
        assertEq(factory.campaignAt(0), address(campaign));
        assertTrue(factory.isCampaign(address(campaign)));
        assertEq(campaign.creator(), creator);
        assertEq(campaign.goal(), GOAL);
        assertEq(campaign.fanShareBps(), 2_000);
        assertEq(campaign.referralBonusBps(), 1_000);
        assertEq(campaign.attentionPool(), TOTAL / 10);
        assertEq(campaign.contributorPool(), TOTAL - TOTAL / 10);
        assertEq(campaign.metadataURI(), "ipfs://drop");
        assertEq(address(governance.campaign()), address(campaign));
        assertEq(governance.votingPeriod(), VOTING_PERIOD);
    }

    function test_CreateCampaign_EmitsEvent() public {
        vm.recordLogs();
        vm.prank(creator);
        (uint256 id, address c) = factory.createCampaign(1 ether, 25, 5, block.timestamp + 1 days, "x");
        assertEq(id, 1);
        assertEq(vm.getRecordedLogs()[0].topics[2], bytes32(uint256(uint160(c))));
    }

    function test_CreateCampaign_RevertsOnBadTerms() public {
        vm.expectRevert(DropOwnFactory.InvalidPercent.selector);
        factory.createCampaign(GOAL, 0, 10, block.timestamp + 1 days, "");
        vm.expectRevert(DropOwnFactory.InvalidPercent.selector);
        factory.createCampaign(GOAL, 101, 10, block.timestamp + 1 days, "");
        vm.expectRevert(DropOwnFactory.InvalidPercent.selector);
        factory.createCampaign(GOAL, 20, 51, block.timestamp + 1 days, "");
        vm.expectRevert(DropCampaign.InvalidTerms.selector);
        factory.createCampaign(0, 20, 10, block.timestamp + 1 days, "");
        vm.expectRevert(DropCampaign.InvalidTerms.selector);
        factory.createCampaign(GOAL, 20, 10, block.timestamp, "");
    }

    // ---------------------------------------------------------------- contribution + shares

    function test_Contribute_MintsSharesProRata() public {
        vm.prank(alice);
        uint256 minted = campaign.contribute{value: 25 ether}(address(0));

        // 25% of the goal earns 25% of the contributor pool.
        assertEq(minted, (TOTAL * 90 / 100) / 4);
        assertEq(campaign.balanceOf(alice), minted);
        assertEq(campaign.totalSupply(), minted);
        assertEq(campaign.totalRaised(), 25 ether);
        assertEq(campaign.contributorCount(), 1);
        assertEq(address(campaign).balance, 25 ether);
    }

    function test_Contribute_CapsAtGoalAndRefundsExcess() public {
        vm.prank(alice);
        campaign.contribute{value: 90 ether}(address(0));

        uint256 before = bob.balance;
        vm.prank(bob);
        campaign.contribute{value: 40 ether}(address(0));

        assertEq(campaign.totalRaised(), GOAL);
        assertEq(campaign.contributionOf(bob), 10 ether);
        assertEq(before - bob.balance, 10 ether);

        vm.prank(carol);
        vm.expectRevert(DropCampaign.CampaignClosed.selector);
        campaign.contribute{value: 1 ether}(address(0));
    }

    function test_Contribute_RevertsAfterDeadlineOrZero() public {
        vm.prank(alice);
        vm.expectRevert(DropCampaign.ZeroAmount.selector);
        campaign.contribute(address(0));

        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        vm.expectRevert(DropCampaign.CampaignClosed.selector);
        campaign.contribute{value: 1 ether}(address(0));
    }

    function test_Shares_AreNonTransferable() public {
        vm.prank(alice);
        campaign.contribute{value: 1 ether}(address(0));
        vm.prank(alice);
        vm.expectRevert(DropCampaign.NonTransferable.selector);
        campaign.transfer(bob, 1);
    }

    // ---------------------------------------------------------------- referral bonus

    function test_Referral_MintsBonusFromAttentionPool() public {
        vm.prank(bob);
        uint256 bobShares = campaign.contribute{value: 30 ether}(alice);

        uint256 bonus = bobShares / 10;
        assertEq(campaign.balanceOf(alice), bonus);
        assertEq(campaign.bonusSharesOf(alice), bonus);
        assertEq(campaign.conversionsOf(alice), 1);
        assertEq(campaign.attentionMinted(), bonus);
        assertEq(campaign.totalSupply(), bobShares + bonus);

        (address[] memory refs, uint256[] memory convs, uint256[] memory bonuses) = campaign.getLeaderboard();
        assertEq(refs.length, 1);
        assertEq(refs[0], alice);
        assertEq(convs[0], 1);
        assertEq(bonuses[0], bonus);

        // The shared registry tallies the same conversion across campaigns.
        assertEq(registry.totalConversions(alice), 1);
        assertEq(registry.totalBonusShares(alice), bonus);
    }

    function test_Referral_IgnoresSelfAndRepeatContributions() public {
        vm.prank(bob);
        campaign.contribute{value: 10 ether}(bob);
        assertEq(campaign.attentionMinted(), 0);

        // Bob is no longer a new contributor, so a later referral tag earns nothing.
        vm.prank(bob);
        campaign.contribute{value: 10 ether}(alice);
        assertEq(campaign.bonusSharesOf(alice), 0);
        assertEq(campaign.conversionsOf(alice), 0);
    }

    function test_Referral_BonusClipsToRemainingPool() public {
        // 1% attention pool, 10% bonus: a full-goal referral would earn 9.9% and must clip to 1%.
        vm.prank(creator);
        (, address c) = factory.createCampaign(GOAL, 20, 1, block.timestamp + 1 days, "");
        DropCampaign small = DropCampaign(c);

        vm.prank(bob);
        small.contribute{value: GOAL}(alice);

        assertEq(small.bonusSharesOf(alice), small.attentionPool());
        assertEq(small.attentionMinted(), small.attentionPool());
        assertLe(small.totalSupply(), TOTAL);
    }

    function test_Registry_CodesResolveToReferrer() public {
        vm.prank(alice);
        registry.registerCode("alice-01");
        assertEq(registry.referrerOf("alice-01"), alice);
        assertEq(registry.codeOf(alice), "alice-01");

        vm.prank(bob);
        vm.expectRevert(ReferralRegistry.CodeTaken.selector);
        registry.registerCode("alice-01");

        vm.prank(alice);
        vm.expectRevert(ReferralRegistry.AlreadyRegistered.selector);
        registry.registerCode("alice-02");

        vm.prank(bob);
        vm.expectRevert(ReferralRegistry.InvalidCode.selector);
        registry.registerCode("Bad Code");
    }

    function test_Registry_OnlyCampaignsRecordConversions() public {
        vm.expectRevert(ReferralRegistry.NotCampaign.selector);
        registry.recordConversion(alice, bob, 1 ether, 1e18);
    }

    // ---------------------------------------------------------------- finalization

    function test_Finalize_RevertsBeforeGoal() public {
        vm.prank(alice);
        campaign.contribute{value: 99 ether}(address(0));
        vm.expectRevert(DropCampaign.GoalNotReached.selector);
        campaign.finalizeCampaign();
    }

    function test_Finalize_ReleasesRaiseToCreator() public {
        _fund();
        campaign.finalizeCampaign();

        assertTrue(campaign.finalized());
        assertEq(creator.balance, GOAL);
        assertEq(address(campaign).balance, 0);

        vm.expectRevert(DropCampaign.AlreadyFinalized.selector);
        campaign.finalizeCampaign();
    }

    function test_Refund_AfterFailedDeadline() public {
        vm.prank(alice);
        campaign.contribute{value: 40 ether}(address(0));

        vm.prank(alice);
        vm.expectRevert(DropCampaign.RefundUnavailable.selector);
        campaign.refund();

        vm.warp(block.timestamp + 8 days);
        uint256 before = alice.balance;
        vm.prank(alice);
        campaign.refund();

        assertEq(alice.balance - before, 40 ether);
        assertEq(campaign.balanceOf(alice), 0);
        assertEq(campaign.totalSupply(), 0);
        assertEq(campaign.totalRaised(), 0);
    }

    // ---------------------------------------------------------------- revenue distribution

    function test_Revenue_RevertsBeforeFinalize() public {
        vm.prank(label);
        vm.expectRevert(DropCampaign.NotFinalized.selector);
        campaign.distributeRevenue{value: 1 ether}();
    }

    function test_Revenue_SplitsCreatorAndFansProRata() public {
        _finalize();
        uint256 supply = campaign.totalSupply();

        vm.prank(label);
        campaign.distributeRevenue{value: 10 ether}();

        // 80% creator, 20% fan pool.
        assertEq(campaign.creatorClaimable(), 8 ether);
        uint256 fanCut = 2 ether;

        uint256 a = campaign.claimableRevenue(alice);
        uint256 b = campaign.claimableRevenue(bob);
        uint256 c = campaign.claimableRevenue(carol);
        assertApproxEqAbs(a, fanCut * campaign.balanceOf(alice) / supply, 1);
        assertApproxEqAbs(b, fanCut * campaign.balanceOf(bob) / supply, 1);
        assertApproxEqAbs(c, fanCut * campaign.balanceOf(carol) / supply, 1);
        assertApproxEqAbs(a + b + c, fanCut, 3);
        assertLe(a + b + c, fanCut);

        // Alice funded 50% and referred the other 50%, so her bonus lifts her above half the pool.
        assertGt(a, fanCut / 2);

        uint256 before = alice.balance;
        vm.prank(alice);
        campaign.claimRevenue();
        assertEq(alice.balance - before, a);
        assertEq(campaign.claimableRevenue(alice), 0);

        vm.prank(alice);
        vm.expectRevert(DropCampaign.NothingToClaim.selector);
        campaign.claimRevenue();
    }

    function test_Revenue_AccumulatesAcrossDistributions() public {
        _finalize();
        vm.prank(label);
        campaign.distributeRevenue{value: 10 ether}();
        vm.prank(bob);
        campaign.claimRevenue();

        vm.prank(label);
        campaign.distributeRevenue{value: 5 ether}();

        uint256 expected = 1 ether * campaign.balanceOf(bob) / campaign.totalSupply();
        assertApproxEqAbs(campaign.claimableRevenue(bob), expected, 1);
        assertEq(campaign.totalRevenue(), 15 ether);
    }

    function test_Revenue_CreatorWithdraws() public {
        _finalize();
        vm.prank(label);
        campaign.distributeRevenue{value: 10 ether}();

        vm.prank(alice);
        vm.expectRevert(DropCampaign.NotCreator.selector);
        campaign.withdrawCreatorRevenue();

        uint256 before = creator.balance;
        vm.prank(creator);
        campaign.withdrawCreatorRevenue();
        assertEq(creator.balance - before, 8 ether);
        assertEq(campaign.creatorClaimable(), 0);
    }

    function testFuzz_Revenue_NeverOverpays(uint96 revenue, uint96 aliceIn, uint96 bobIn) public {
        uint256 a = bound(aliceIn, 1, GOAL - 1);
        uint256 b = bound(bobIn, GOAL - a, 500 ether);
        uint256 rev = bound(revenue, 1, 1_000 ether);

        vm.prank(alice);
        campaign.contribute{value: a}(address(0));
        vm.prank(bob);
        campaign.contribute{value: b}(alice);
        campaign.finalizeCampaign();

        vm.prank(label);
        campaign.distributeRevenue{value: rev}();

        uint256 owed = campaign.claimableRevenue(alice) + campaign.claimableRevenue(bob) + campaign.creatorClaimable();
        assertLe(owed, address(campaign).balance);
    }

    // ---------------------------------------------------------------- governance

    function _options() internal pure returns (string[] memory opts) {
        opts = new string[](2);
        opts[0] = "Direction A";
        opts[1] = "Direction B";
    }

    function test_Governance_RequiresFinalizedCampaign() public {
        _fund();
        vm.prank(alice);
        vm.expectRevert(DropGovernance.CampaignNotFinalized.selector);
        governance.createProposal("Cover art direction A or B?", _options());
    }

    function test_Governance_OnlyShareholdersOrCreatorPropose() public {
        _finalize();
        vm.prank(label);
        vm.expectRevert(DropGovernance.NotShareholder.selector);
        governance.createProposal("Cover art direction A or B?", _options());

        vm.prank(creator);
        assertEq(governance.createProposal("Cover art direction A or B?", _options()), 0);
    }

    function test_Governance_VotesAreShareWeighted() public {
        _finalize();
        vm.prank(alice);
        uint256 id = governance.createProposal("Cover art direction A or B?", _options());

        vm.prank(alice);
        governance.castVote(id, 0);
        vm.prank(bob);
        governance.castVote(id, 1);
        vm.prank(carol);
        governance.castVote(id, 1);

        DropGovernance.Proposal memory p = governance.getProposal(id);
        assertEq(p.votes[0], campaign.balanceOf(alice));
        assertEq(p.votes[1], campaign.balanceOf(bob) + campaign.balanceOf(carol));
        assertEq(p.totalVotes, campaign.totalSupply());
        assertEq(governance.voteOf(id, bob), 2);

        vm.prank(alice);
        vm.expectRevert(DropGovernance.AlreadyVoted.selector);
        governance.castVote(id, 1);

        vm.prank(label);
        vm.expectRevert(DropGovernance.NotShareholder.selector);
        governance.castVote(id, 0);
    }

    function test_Governance_ExecuteRecordsWinner() public {
        _finalize();
        vm.prank(alice);
        uint256 id = governance.createProposal("Cover art direction A or B?", _options());
        vm.prank(alice);
        governance.castVote(id, 0);
        vm.prank(bob);
        governance.castVote(id, 1);

        vm.expectRevert(DropGovernance.VotingStillOpen.selector);
        governance.executeProposal(id);

        vm.warp(block.timestamp + VOTING_PERIOD);

        vm.prank(carol);
        vm.expectRevert(DropGovernance.VotingClosed.selector);
        governance.castVote(id, 1);

        // Alice holds 45% + referral bonuses, Bob 27%: option 0 wins.
        assertEq(governance.executeProposal(id), 0);
        DropGovernance.Proposal memory p = governance.getProposal(id);
        assertTrue(p.executed);
        assertEq(p.winningOption, 0);

        vm.expectRevert(DropGovernance.AlreadyExecuted.selector);
        governance.executeProposal(id);
    }

    function test_Governance_RejectsBadInput() public {
        _finalize();
        string[] memory one = new string[](1);
        one[0] = "Only";
        vm.prank(alice);
        vm.expectRevert(DropGovernance.InvalidOptions.selector);
        governance.createProposal("Q", one);

        vm.prank(alice);
        uint256 id = governance.createProposal("Q", _options());
        vm.prank(alice);
        vm.expectRevert(DropGovernance.InvalidOption.selector);
        governance.castVote(id, 2);

        vm.expectRevert(DropGovernance.UnknownProposal.selector);
        governance.getProposal(99);
    }
}
