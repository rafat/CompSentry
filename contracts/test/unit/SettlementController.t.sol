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

    // Security Test: Owner cannot submit settlements directly (enforces separation of powers)
    function test_Security_OwnerCannotSubmitSettlements() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("owner-settle"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        // Calling from owner (address(this)) must revert UnauthorizedReporter
        vm.expectRevert(SettlementController.UnauthorizedReporter.selector);
        controller.settleEpoch(report);
    }

    // Security Test: Boundary Condition - exactly at threshold is compliant
    function test_Security_BoundaryConditions_ExactThresholdIsCompliant() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

        // Latency exactly 200ms, Availability exactly 9900 bps
        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 200, // exactly threshold
            availabilityBps: 9900, // exactly threshold
            deliveredUnits: 100,
            evidenceHash: keccak256("exact-boundary"),
            timestamp: epochTs,
            observerQuorum: 2
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        // Must be compliant: 0 rebate, 0 slash
        assertEq(controller.cumulativeRebates(contractId), 0);
        assertEq(controller.cumulativeSlashing(contractId), 0);
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.earnedServiceFee, 100e6);
    }

    // Direct test table for calculateEpochSettlement()
    function test_CalculateEpochSettlement_Matrix() public view {
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);

        // Case 1: 100ms, 10000 bps -> Compliant (0 rebate, 0 slash, 100 fee)
        SettlementController.SLAReport memory r1 = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 100,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: bytes32(0),
            timestamp: 0,
            observerQuorum: 2
        });
        (uint256 reb1, uint256 slash1, uint256 fee1, bool br1) = controller.calculateEpochSettlement(sla, ledger, r1);
        assertFalse(br1);
        assertEq(reb1, 0);
        assertEq(slash1, 0);
        assertEq(fee1, 100e6);

        // Case 2: 250ms, 10000 bps -> Minor breach (50% rebate, 0 slash, 50% fee)
        SettlementController.SLAReport memory r2 = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 250,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: bytes32(0),
            timestamp: 0,
            observerQuorum: 2
        });
        (uint256 reb2, uint256 slash2, uint256 fee2, bool br2) = controller.calculateEpochSettlement(sla, ledger, r2);
        assertTrue(br2);
        assertEq(reb2, 50e6);
        assertEq(slash2, 0);
        assertEq(fee2, 50e6);

        // Case 3: 500ms, 10000 bps -> Major latency breach (>1.5x) (100% rebate, 15% epoch bond slash, 0 fee)
        SettlementController.SLAReport memory r3 = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 500,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: bytes32(0),
            timestamp: 0,
            observerQuorum: 2
        });
        (uint256 reb3, uint256 slash3, uint256 fee3, bool br3) = controller.calculateEpochSettlement(sla, ledger, r3);
        assertTrue(br3);
        assertEq(reb3, 100e6);
        assertEq(slash3, (45e6 / 3 * 15) / 100); // 15% of 15 USDC = 2.25 USDC
        assertEq(fee3, 0);

        // Case 4: 180ms, 9000 bps -> Major availability breach (<9500) (100% rebate, proportional slash, 0 fee)
        SettlementController.SLAReport memory r4 = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 180,
            availabilityBps: 9000,
            deliveredUnits: 100,
            evidenceHash: bytes32(0),
            timestamp: 0,
            observerQuorum: 2
        });
        (uint256 reb4, uint256 slash4, uint256 fee4, bool br4) = controller.calculateEpochSettlement(sla, ledger, r4);
        assertTrue(br4);
        assertEq(reb4, 100e6);
        assertTrue(slash4 > 0);
        assertEq(fee4, 0);
    }

    // Security Test: Malicious Reporter Cannot Fabricate Payout
    function test_Security_MaliciousReporterCannotFabricatePayout() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

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

        assertEq(controller.cumulativeRebates(contractId), 0);
        assertEq(controller.cumulativeSlashing(contractId), 0);

        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.accruedRebates, 0);
        assertEq(ledger.accruedSlashing, 0);
        assertEq(ledger.earnedServiceFee, 100e6);
    }

    // Security Test: Stale Report Timestamp Revert
    function test_Security_RevertStaleReport() public {
        uint64 epochTs = getEpochTimestamp(1);
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

    // Security Test: Future Report Timestamp Revert
    function test_Security_RevertFutureReport() public {
        uint64 epochTs = getEpochTimestamp(1);
        vm.warp(epochTs);

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

    // Security Test: Wrong Epoch Window Timestamp Revert
    function test_Security_RevertWrongEpochWindow() public {
        uint64 epoch3Ts = getEpochTimestamp(3);
        vm.warp(epoch3Ts);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 1,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("wrong-window"),
            timestamp: epoch3Ts,
            observerQuorum: 2
        });

        vm.prank(reporter);
        vm.expectRevert(SettlementController.InvalidEpochWindow.selector);
        controller.settleEpoch(report);
    }

    // Security Test: Expiry with Missing Epochs Flags REVIEW_REQUIRED, and ResolveReviewedContract finalizes cleanly
    function test_Security_ExpiryAndResolutionPath() public {
        // Settle epoch 1
        uint64 epoch1Ts = getEpochTimestamp(1);
        vm.warp(epoch1Ts);

        vm.prank(reporter);
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

        // Provider offline for epochs 2 & 3. Time passes expiration + grace period.
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        vm.warp(sla.endTimestamp + 301);

        // Step 1: Flagged for review
        controller.resolveExpiredContract(contractId);
        assertEq(uint256(hub.getContract(contractId).status), uint256(ComputeSLAHub.ContractStatus.REVIEW_REQUIRED));

        // Step 2: Cannot settle epochs while in REVIEW_REQUIRED
        vm.prank(reporter);
        vm.expectRevert(SettlementController.ContractNotActive.selector);
        controller.settleEpoch(SettlementController.SLAReport({
            contractId: contractId,
            epochId: 2,
            p95LatencyMs: 80,
            availabilityBps: 10000,
            deliveredUnits: 100,
            evidenceHash: keccak256("epoch-2"),
            timestamp: uint64(block.timestamp),
            observerQuorum: 2
        }));

        // Step 3: Admin resolves the reviewed contract (treat missing as breached)
        controller.resolveReviewedContract(contractId, true);

        // Status is now FINALIZED
        assertEq(uint256(hub.getContract(contractId).status), uint256(ComputeSLAHub.ContractStatus.FINALIZED));
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertTrue(ledger.finalized);

        // All funds disbursed, vault balance 0
        assertEq(token.balanceOf(address(vault)), 0);
    }

    // Security Test: Bond Exhaustion Cap
    function test_Security_BondSlashingBoundedAtZero() public {
        for (uint64 ep = 1; ep <= TOTAL_EPOCHS; ep++) {
            uint64 ts = getEpochTimestamp(ep);
            vm.warp(ts);

            vm.prank(reporter);
            controller.settleEpoch(SettlementController.SLAReport({
                contractId: contractId,
                epochId: ep,
                p95LatencyMs: 900,
                availabilityBps: 1000,
                deliveredUnits: 10,
                evidenceHash: keccak256(abi.encode(ep)),
                timestamp: ts,
                observerQuorum: 3
            }));
        }

        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        assertLe(controller.cumulativeSlashing(contractId), sla.providerBond);
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.remainingBond, 0);
    }

    // Security Test: Signature Verification
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
            observerQuorum: 1
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

        vm.prank(reporter);
        vm.expectRevert(SettlementController.InvalidEpoch.selector);
        controller.settleEpoch(report);
    }

    function test_SettleEpoch_RevertNonSequentialEpoch() public {
        uint64 epoch2Ts = getEpochTimestamp(2);
        vm.warp(epoch2Ts);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: 2,
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

        // Epoch 1: Compliant
        uint64 ep1Ts = getEpochTimestamp(1);
        vm.warp(ep1Ts);
        vm.prank(reporter);
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

        // Epoch 2: Breached
        uint64 ep2Ts = getEpochTimestamp(2);
        vm.warp(ep2Ts);
        vm.prank(reporter);
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

        // Epoch 3 (Final): Compliant
        uint64 ep3Ts = getEpochTimestamp(3);
        vm.warp(ep3Ts);
        vm.prank(reporter);
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

        assertEq(token.balanceOf(address(vault)), 0);

        uint256 buyerReceived = token.balanceOf(buyer) - buyerBalanceInitial;
        uint256 providerReceived = token.balanceOf(provider) - providerBalanceInitial;
        assertEq(buyerReceived + providerReceived, SERVICE_FEE + ((SERVICE_FEE * BOND_BPS) / 10000));
    }
}
