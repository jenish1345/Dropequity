// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The parts of a DropCampaign that governance reads.
interface IDropShares {
    function balanceOf(address account) external view returns (uint256);
    function finalized() external view returns (bool);
    function creator() external view returns (address);
}

/// @title DropGovernance
/// @notice Lightweight signalling votes for one campaign's DropShare holders: bonus track order,
///         cover direction, and similar creative or community calls.
/// @dev Votes are weighted by DropShares. Voting opens only after the campaign is finalized, at
///      which point balances are frozen (shares are non-transferable and minting has stopped), so
///      a live balance read is equivalent to a snapshot. Executing a proposal records the result
///      on-chain; it does not move funds or call other contracts.
///      Hackathon demonstration code. Unaudited.
contract DropGovernance {
    uint256 public constant MIN_OPTIONS = 2;
    uint256 public constant MAX_OPTIONS = 8;

    /// @notice Campaign whose DropShares carry the votes.
    IDropShares public immutable campaign;
    /// @notice Seconds a proposal stays open.
    uint256 public immutable votingPeriod;

    struct Proposal {
        address proposer;
        string description;
        string[] options;
        uint256[] votes;
        uint256 startTime;
        uint256 endTime;
        uint256 totalVotes;
        bool executed;
        uint256 winningOption;
    }

    Proposal[] private _proposals;
    /// @notice Option index + 1 an account voted for on a proposal, or 0 if it has not voted.
    mapping(uint256 => mapping(address => uint256)) public voteOf;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 optionIndex, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, uint256 winningOption, uint256 winningVotes);

    error CampaignNotFinalized();
    error NotShareholder();
    error InvalidOptions();
    error EmptyDescription();
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error InvalidOption();
    error AlreadyExecuted();

    constructor(address campaign_, uint256 votingPeriod_) {
        campaign = IDropShares(campaign_);
        votingPeriod = votingPeriod_;
    }

    /// @notice Open a vote. Callable by the creator or any DropShare holder once the campaign is finalized.
    /// @param description The question being asked.
    /// @param options Between 2 and 8 answers.
    /// @return proposalId Index of the new proposal.
    function createProposal(string calldata description, string[] calldata options)
        external
        returns (uint256 proposalId)
    {
        if (!campaign.finalized()) revert CampaignNotFinalized();
        if (msg.sender != campaign.creator() && campaign.balanceOf(msg.sender) == 0) revert NotShareholder();
        if (bytes(description).length == 0) revert EmptyDescription();
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) revert InvalidOptions();

        proposalId = _proposals.length;
        Proposal storage p = _proposals.push();
        p.proposer = msg.sender;
        p.description = description;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingPeriod;
        for (uint256 i; i < options.length; ++i) {
            if (bytes(options[i]).length == 0) revert InvalidOptions();
            p.options.push(options[i]);
            p.votes.push(0);
        }

        emit ProposalCreated(proposalId, msg.sender, description, p.endTime);
    }

    /// @notice Vote with the caller's full DropShare balance. One vote per address per proposal.
    function castVote(uint256 proposalId, uint256 optionIndex) external {
        Proposal storage p = _get(proposalId);
        if (block.timestamp >= p.endTime) revert VotingClosed();
        if (voteOf[proposalId][msg.sender] != 0) revert AlreadyVoted();
        if (optionIndex >= p.options.length) revert InvalidOption();

        uint256 weight = campaign.balanceOf(msg.sender);
        if (weight == 0) revert NotShareholder();

        voteOf[proposalId][msg.sender] = optionIndex + 1;
        p.votes[optionIndex] += weight;
        p.totalVotes += weight;

        emit VoteCast(proposalId, msg.sender, optionIndex, weight);
    }

    /// @notice Close a proposal after its voting period and record the winning option.
    /// @dev Ties resolve to the lowest option index. Callable by anyone.
    function executeProposal(uint256 proposalId) external returns (uint256 winningOption) {
        Proposal storage p = _get(proposalId);
        if (block.timestamp < p.endTime) revert VotingStillOpen();
        if (p.executed) revert AlreadyExecuted();

        uint256 best;
        for (uint256 i; i < p.votes.length; ++i) {
            if (p.votes[i] > best) {
                best = p.votes[i];
                winningOption = i;
            }
        }

        p.executed = true;
        p.winningOption = winningOption;
        emit ProposalExecuted(proposalId, winningOption, best);
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    /// @notice Full proposal record including options and live tallies.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _get(proposalId);
    }

    function _get(uint256 proposalId) private view returns (Proposal storage) {
        if (proposalId >= _proposals.length) revert UnknownProposal();
        return _proposals[proposalId];
    }
}
