// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MockERC20} from "../../src/MockERC20.sol";
import {CollateralVault} from "../../src/CollateralVault.sol";
import {ComputeSLAHub} from "../../src/ComputeSLAHub.sol";
import {SettlementController} from "../../src/SettlementController.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SettlementControllerTest is Test {
    using MessageHashUtils for bytes32;

    MockERC20 public token;
    CollateralVault public vault;
    ComputeSLAHub public hub;
    SettlementController public controller;

    address public owner = address(this);
    address public provider = address(0x111);
    address public buyer = address(0x222);

    uint256 public reporterPrivateKey = 0xA11CE;
    address public reporter;

    bytes32 public constant RESOURCE_ID = keccak256("RUNPOD-H100-SX4");
    uint256 public constant SERVICE_FEE = 300e6; // 300 USDC
    uint16 public constant BOND_BPS = 1500;       // 15% bond (45 USDC)
    uint64 public constant EPOCH_DURATION = 30;  // 30 seconds
    uint32 public constant TOTAL_EPOCHS = 3;     // 3 epochs (100 USDC/epoch)
    uint32 public constant AVAILABILITY_BPS = 9900; // 99%
    uint32 public constant LATENCY_MS = 200;     // 200ms
    uint256 public constant EPOCH_CAP = 100e6;   // 100 USDC cap per epoch (= 300/3)
    uint256 public constant MAX_PAYOUT = 300e6;  // 300 USDC total cap

    bytes32 public contractId;
    uint64 public contractStartTime;

    function setUp() public {
        reporter = vm.addr(reporterPrivateKey);

        token = new MockERC20("Mock USD Coin", "USDC", 6);
        vault = new CollateralVault(owner);
        hub = new ComputeSLAHub(owner, address(vault));
        controller = new SettlementController(owner, address(hub), address(vault), reporter);

        vault.setHub(address(hub));
        vault.setController(address(controller));
        hub.setSettlementController(address(controller));

        // Fund accounts
        token.mint(provider, 1000e6);
        token.mint(buyer, 1000e6);

        vm.prank(provider);
        token.approve(address(vault), type(uint256).max);

        vm.prank(buyer);
        token.approve(address(vault), type(uint256).max);

        // Advance block timestamp to a realistic baseline
        vm.warp(1774900000);

        // Provider creates offer
        vm.prank(provider);
        bytes32 offerId = hub.createOffer(
            address(token),
            RESOURCE_ID,
            SERVICE_FEE,
            BOND_BPS,
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            AVAILABILITY_BPS,
            LATENCY_MS,
            EPOCH_CAP,
            MAX_PAYOUT
        );

        // Buyer activates contract
        vm.prank(buyer);
        contractId = hub.activateContract(offerId);
        contractStartTime = uint64(block.timestamp);
    }

    // Helper to calculate valid epoch timestamp
    function getEpochTimestamp(uint64 epochId) internal view returns (uint64) {
        return contractStartTime + (epochId - 1) * EPOCH_DURATION + 15;
    }

    function test_SettleEpoch_Compliant() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 85,
            availabilityBps: 9990,
            deliveredUnits: 100,
            evidenceHash: keccak256("canonical-epoch-1"),
            timestamp: epochTs,
            observerQuorum: 3
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        assertTrue(controller.isSettled(contractId, 1));
        assertEq(controller.lastSettledEpoch(contractId), 1);
        assertEq(controller.cumulativeRebates(contractId), 0);
        assertEq(controller.cumulativeSlashing(contractId), 0);

        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.earnedServiceFee, 100e6);
        assertEq(ledger.remainingEscrow, 200e6);
        assertEq(ledger.remainingBond, 45e6);
        assertEq(ledger.accruedRebates, 0);
        assertEq(ledger.accruedSlashing, 0);
    }

    function test_SettleEpoch_BreachWithRebateAndSlashing() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 450, // Latency breach (> 200ms)
            availabilityBps: 9200, // Availability breach (< 9500 is major breach)
            deliveredUnits: 50,
            evidenceHash: keccak256("breach-epoch-1"),
            timestamp: epochTs,
            observerQuorum: 3
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        assertTrue(controller.isSettled(contractId, 1));
        assertEq(controller.cumulativeRebates(contractId), 100e6); // 100% epoch rebate
        assertTrue(controller.cumulativeSlashing(contractId) > 0); // Deterministic slashing occurred

        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.earnedServiceFee, 0);
        assertEq(ledger.accruedRebates, 100e6);
        assertEq(ledger.remainingEscrow, 200e6);
    }

    // Security Test A & B: Malicious Payout / Fake Breach Attempt
    function test_Security_MaliciousReporterCannotFabricatePayout() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        // Reporter reports compliant performance (50ms latency, 100% availability)
        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 50,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("compliant-telemetry"),
            timestamp: epochTs,
            observerQuorum: 3
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        // Contract deterministically calculates 0 rebate and 0 slashing regardless of reporter intentions
        assertEq(controller.cumulativeRebates(contractId), 0);
        assertEq(controller.cumulativeSlashing(contractId), 0);

        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.accruedRebates, 0);
        assertEq(ledger.accruedSlashing, 0);
        assertEq(ledger.earnedServiceFee, 100e6); // Provider is fairly paid
    }

    // Security Test C: Stale Report Timestamp Revert
    function test_Security_RevertStaleReport() public {
        uint64 epochTs = getEpochTimestamp(1);
        // Warp current time past report timestamp by more than 2 minutes (MAX_REPORT_AGE = 120s)
        vm.warp(epochTs + 125);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("stale-report"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.StaleReportTimestamp.selector);
        controller.settleEpoch(report);
    }

    // Security Test D: Future Report Timestamp Revert
    function test_Security_RevertFutureReport() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        // Report timestamp is 35 seconds into future (MAX_FUTURE_DRIFT = 30s)
        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("future-report"),
            timestamp: epochTs + 35,
            observerQuorum: 2
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.FutureReport.selector);
        controller.settleEpoch(report);
    }

    // Security Test E: Wrong Epoch Window Timestamp Revert
    function test_Security_RevertWrongEpochWindow() public {
        // Warp time to epoch 3 window
        uint64 epoch3Ts = getEpochTimestamp(3);
        vm.warp(epoch3Ts);

        // But reporter submits epoch 1 using epoch 3 timestamp
        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1, // Epoch 1 expected timestamp is between 0 and 30s
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("wrong-window"),
            timestamp: epoch3Ts, // Epoch 3 timestamp is at 60s+
            observerQuorum: 2
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.InvalidEpochWindow.selector);
        controller.settleEpoch(report);
    }

    // Security Test G: Expiry with Missing Epochs Transitions to REVIEW_REQUIRED
    function test_Security_ExpiryWithMissingEpochsFlagsReview() public {
        // Settle only epoch 1
        uint64 epoch1Ts = getEpochTimestamp(1);
        vm.warp(epoch1Ts);

        controller.settleEpoch(SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-1"),
            timestamp: epoch1Ts,
            observerQuorum: 2
        }));

        // Contract has 3 epochs total. Provider disappears. Epochs 2 & 3 not settled.
        // Warp time past contract endTimestamp + GRACE_PERIOD (300s)
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        vm.warp(sla.endTimestamp + 301);

        // Resolve expired contract
        controller.resolveExpiredContract(contractId);

        // Status must be REVIEW_REQUIRED (not FINALIZED)
        ComputeSLAHub.SLAContract memory slaAfter = hub.getContract(contractId);
        assertEq(uint256(slaAfter.status), uint256(ComputeSLAHub.ContractStatus.REVIEW_REQUIRED));
    }

    // Security Test H: Bond Exhaustion Cap
    function test_Security_BondSlashingBoundedAtZero() public {
        // Run repeated severe breaches
        for (uint64 ep = 1; ep <= TOTAL_EPOCHS; ep++) {
            uint64 ts = getEpochTimestamp(ep);
            vm.warp(ts);

            controller.settleEpoch(SettlementController.SLAReport({
                contractId: contractId,
                epochId: ep,
                p95LatencyMs: 900,
                availabilityBps: 1000, // Severe 90% failure
                deliveredUnits: 10,
                evidenceHash: keccak256(abi.encode(ep)),
                timestamp: ts,
                observerQuorum: 3
            }));
        }

        // Cumulative slashing must not exceed initial bond (45 USDC)
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        assertLe(controller.cumulativeSlashing(contractId), sla.providerBond);
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.remainingBond, 0);
    }

    // Security Test I: Signature Verification
    function test_SettleEpoch_WithSignature() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 90,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("signed-epoch-1"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        bytes32 digest = controller.hashReport(report).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(reporterPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Any relayer can submit the signed report
        address relayer = address(0x999);
        vm.prank(relayer);
        controller.settleEpochWithSignature(report, signature);

        assertTrue(controller.isSettled(contractId, 1));
    }

    function test_SettleEpoch_RevertInvalidSignature() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 90,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("signed-epoch-1"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        uint256 wrongKey = 0xBAD;
        bytes32 digest = controller.hashReport(report).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SettlementController.InvalidSignature.selector);
        controller.settleEpochWithSignature(report, signature);
    }

    function test_SettleEpoch_RevertInsufficientQuorum() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 90,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("insufficient-quorum"),
            timestamp: epochTs,
            observerQuorum: 1 // Only 1 observer (min required is 2)
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.InsufficientQuorum.selector);
        controller.settleEpoch(report);
    }

    function test_SettleEpoch_RevertReplayEpoch() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 90,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-1"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        // Attempting to settle epoch 1 again
        vm.prank(reporter);
        vm.expectRevert(SettlementController.InvalidEpoch.selector);
        controller.settleEpoch(report);
    }

    function test_SettleEpoch_RevertNonSequentialEpoch() public {
        uint64 epoch2Ts = getEpochTimestamp(2);
        vm.warp(epoch2Ts);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 2, // Cannot skip epoch 1
            p95LatencyMs: 90,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-2"),
            timestamp: epoch2Ts,
            observerQuorum: 2
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.InvalidEpoch.selector);
        controller.settleEpoch(report);
    }

    function test_FullLifecycle_CompletionAndDisbursement() public {
        uint256 buyerBalanceInitial = token.balanceOf(buyer);
        uint256 providerBalanceInitial = token.balanceOf(provider);

        // Epoch 1: Compliant (provider earns 100 USDC)
        uint64 ep1Ts = getEpochTimestamp(1);
        vm.warp(ep1Ts);
        controller.settleEpoch(SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-1"),
            timestamp: ep1Ts,
            observerQuorum: 3
        }));

        // Epoch 2: Breached (buyer gets 100 USDC rebate + slashed bond)
        uint64 ep2Ts = getEpochTimestamp(2);
        vm.warp(ep2Ts);
        controller.settleEpoch(SettlementController.SLAReport({
            contractId: contractId,
            epochId: 2,
            p95LatencyMs: 400,
            availabilityBps: 9200,
            deliveredUnits: 60,
            evidenceHash: keccak256("epoch-2"),
            timestamp: ep2Ts,
            observerQuorum: 3
        }));

        // Epoch 3 (Final): Compliant (provider earns 100 USDC)
        uint64 ep3Ts = getEpochTimestamp(3);
        vm.warp(ep3Ts);
        controller.settleEpoch(SettlementController.SLAReport({
            contractId: contractId,
            epochId: 3,
            p95LatencyMs: 70,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-3"),
            timestamp: ep3Ts,
            observerQuorum: 3
        }));

        // Contract must now be automatically FINALIZED
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        assertEq(uint256(sla.status), uint256(ComputeSLAHub.ContractStatus.FINALIZED));

        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertTrue(ledger.finalized);

        // Vault token balance must be exactly 0 (full conservation)
        assertEq(token.balanceOf(address(vault)), 0);

        // Disbursed funds conservation: sum of disbursements equals initial escrow + bond
        uint256 buyerReceived = token.balanceOf(buyer) - buyerBalanceInitial;
        uint256 providerReceived = token.balanceOf(provider) - providerBalanceInitial;
        assertEq(buyerReceived + providerReceived, SERVICE_FEE + ((SERVICE_FEE * BOND_BPS) / 10000));
    }
}
