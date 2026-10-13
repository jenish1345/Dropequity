// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal view of the factory used to authenticate campaigns.
interface ICampaignDirectory {
    function isCampaign(address campaign) external view returns (bool);
}

/// @title ReferralRegistry
/// @notice Maps human-readable referral codes to referrer addresses and keeps a cross-campaign
///         tally of referral conversions so attention can be ranked across every drop.
/// @dev Hackathon demonstration code. Unaudited. Codes are first-come, first-served and nothing
///      here tries to detect one person operating several wallets.
contract ReferralRegistry {
    /// @notice Factory whose campaigns are allowed to record conversions.
    address public immutable factory;

    mapping(bytes32 => address) private _ownerOfCode;
    mapping(address => string) public codeOf;

    /// @notice Conversions an address has driven across all campaigns.
    mapping(address => uint256) public totalConversions;
    /// @notice Bonus DropShares an address has earned across all campaigns.
    mapping(address => uint256) public totalBonusShares;
    address[] private _referrers;

    event CodeRegistered(address indexed referrer, string code);
    event ConversionRecorded(
        address indexed campaign,
        address indexed referrer,
        address indexed contributor,
        uint256 amount,
        uint256 bonusShares
    );

    error InvalidCode();
    error CodeTaken();
    error AlreadyRegistered();
    error NotCampaign();

    constructor(address factory_) {
        factory = factory_;
    }

    /// @notice Claim a referral code for the caller. One code per address.
    /// @param code 3-20 characters, lowercase a-z, digits and hyphens only.
    function registerCode(string calldata code) external {
        bytes memory raw = bytes(code);
        if (raw.length < 3 || raw.length > 20) revert InvalidCode();
        for (uint256 i; i < raw.length; ++i) {
            bytes1 c = raw[i];
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            if (!ok) revert InvalidCode();
        }
        if (bytes(codeOf[msg.sender]).length != 0) revert AlreadyRegistered();

        bytes32 key = keccak256(raw);
        if (_ownerOfCode[key] != address(0)) revert CodeTaken();

        _ownerOfCode[key] = msg.sender;
        codeOf[msg.sender] = code;
        emit CodeRegistered(msg.sender, code);
    }

    /// @notice Resolve a referral code to its owner, or address(0) if unclaimed.
    function referrerOf(string calldata code) external view returns (address) {
        return _ownerOfCode[keccak256(bytes(code))];
    }

    /// @notice Called by a campaign when a referral converts into a contribution.
    function recordConversion(address referrer, address contributor, uint256 amount, uint256 bonusShares) external {
        if (!ICampaignDirectory(factory).isCampaign(msg.sender)) revert NotCampaign();

        if (totalConversions[referrer] == 0) _referrers.push(referrer);
        totalConversions[referrer] += 1;
        totalBonusShares[referrer] += bonusShares;

        emit ConversionRecorded(msg.sender, referrer, contributor, amount, bonusShares);
    }

    /// @notice Every referrer with a recorded conversion, unsorted.
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
            conversions[i] = totalConversions[referrers[i]];
            bonusShares[i] = totalBonusShares[referrers[i]];
        }
    }
}
