// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {ComputeSLAHub} from "../src/ComputeSLAHub.sol";
import {SettlementController} from "../src/SettlementController.sol";

contract DeployCompSentry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerPrivateKey);
        address creReporter = vm.envOr("CRE_REPORTER_ADDRESS", deployer);

        console.log("Deploying CompSentry contracts with deployer:", deployer);
        console.log("Configured CRE Reporter address:", creReporter);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Check if token already provided or deploy CompSentry Test USDC (CSUSDC)
        address tokenAddress = vm.envOr("PAYMENT_TOKEN_ADDRESS", address(0));
        if (tokenAddress == address(0)) {
            MockERC20 csusdc = new MockERC20("CompSentry Test USDC", "CSUSDC", 6);
            tokenAddress = address(csusdc);
            console.log("CompSentry Test USDC (CSUSDC) deployed at:", tokenAddress);
        } else {
            console.log("Using existing token at:", tokenAddress);
        }

        // 2. Deploy CollateralVault
        CollateralVault vault = new CollateralVault(deployer);
        console.log("CollateralVault deployed at:", address(vault));

        // 3. Deploy ComputeSLAHub
        ComputeSLAHub hub = new ComputeSLAHub(deployer, address(vault));
        console.log("ComputeSLAHub deployed at:", address(hub));

        // 4. Deploy SettlementController
        SettlementController controller = new SettlementController(
            deployer,
            address(hub),
            address(vault),
            creReporter
        );
        console.log("SettlementController deployed at:", address(controller));

        // 5. Wire dependencies
        vault.setHub(address(hub));
        vault.setController(address(controller));
        hub.setSettlementController(address(controller));
        console.log("Permissions and access controllers linked successfully.");

        vm.stopBroadcast();
    }
}
