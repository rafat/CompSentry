// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ComputeSLAHub} from "../src/ComputeSLAHub.sol";

contract ActivateContract is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address hubAddress = vm.envAddress("HUB_ADDRESS");
        bytes32 offerId = 0xe17577af34762ea69eb7c047da40c366272e2ed36271f27273e233fd6291ad5f;

        console.log("Activating SLA Contract for Offer 1 on Monad Testnet...");
        vm.startBroadcast(deployerPrivateKey);

        ComputeSLAHub hub = ComputeSLAHub(hubAddress);
        bytes32 contractId = hub.activateContract(offerId);

        console.log("=========================================");
        console.log("SUCCESS: SLA Contract Activated on Monad Testnet!");
        console.log("Contract ID:");
        console.logBytes32(contractId);
        console.log("=========================================");

        vm.stopBroadcast();
    }
}
