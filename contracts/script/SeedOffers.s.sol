// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {ComputeSLAHub} from "../src/ComputeSLAHub.sol";

contract SeedOffers is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address tokenAddress = vm.envAddress("PAYMENT_TOKEN_ADDRESS");
        address vaultAddress = vm.envAddress("VAULT_ADDRESS");
        address hubAddress = vm.envAddress("HUB_ADDRESS");

        console.log("Creating compute offers on Monad Testnet for provider:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        MockERC20 token = MockERC20(tokenAddress);
        CollateralVault vault = CollateralVault(vaultAddress);
        ComputeSLAHub hub = ComputeSLAHub(hubAddress);

        // 1. Mint CSUSDC to deployer
        token.mint(deployer, 50_000 * 1e6);
        console.log("Minted 50,000 CSUSDC");

        // 2. Approve CollateralVault
        token.approve(address(vault), type(uint256).max);
        console.log("Approved CollateralVault");

        // 3. Create Offer 1: vLLM Llama 3 70B
        bytes32 offer1Id = hub.createOffer(
            tokenAddress,
            keccak256("vLLM-Llama-3-70B-Instruct"),
            100 * 1e6, // 100 USDC service fee
            2000,      // 20% provider bond (20 USDC)
            30,        // 30 second epochs
            20,        // 20 epochs
            9950,      // 99.5% availability SLA
            120,       // 120ms latency SLA
            5 * 1e6,   // 5 USDC epoch payout cap
            100 * 1e6  // 100 USDC max total payout
        );
        console.log("Offer 1 Created (Llama 3 70B):");
        console.logBytes32(offer1Id);

        // 4. Create Offer 2: DeepSeek R1 671B
        bytes32 offer2Id = hub.createOffer(
            tokenAddress,
            keccak256("DeepSeek-R1-671B-MoE"),
            250 * 1e6,
            2500,      // 25% bond
            30,
            25,
            9980,      // 99.8% availability SLA
            250,       // 250ms latency SLA
            10 * 1e6,  // 10 USDC cap
            250 * 1e6
        );
        console.log("Offer 2 Created (DeepSeek R1):");
        console.logBytes32(offer2Id);

        // 5. Create Offer 3: Mistral Large 2
        bytes32 offer3Id = hub.createOffer(
            tokenAddress,
            keccak256("Mistral-Large-2-123B"),
            90 * 1e6,
            1500,      // 15% bond
            30,
            15,
            9900,      // 99.0% availability SLA
            180,       // 180ms latency SLA
            6 * 1e6,   // 6 USDC cap
            90 * 1e6
        );
        console.log("Offer 3 Created (Mistral Large 2):");
        console.logBytes32(offer3Id);

        vm.stopBroadcast();
    }
}
