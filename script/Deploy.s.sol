// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DropOwnFactory} from "../contracts/DropOwnFactory.sol";

/// @notice Deploys the DropOwn factory (which deploys the ReferralRegistry) to the target chain.
/// @dev Run by a human with their own key, e.g.
///      forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
///      VOTING_PERIOD (seconds) is optional and defaults to 10 minutes so judges can see a
///      proposal through to execution during a demo.
contract Deploy is Script {
    function run() external returns (DropOwnFactory factory) {
        uint256 votingPeriod = vm.envOr("VOTING_PERIOD", uint256(10 minutes));

        vm.startBroadcast();
        factory = new DropOwnFactory(votingPeriod);
        vm.stopBroadcast();

        console2.log("DropOwnFactory  ", address(factory));
        console2.log("ReferralRegistry", address(factory.registry()));
        console2.log("votingPeriod (s)", votingPeriod);
    }
}
