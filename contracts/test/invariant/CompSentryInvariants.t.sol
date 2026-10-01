// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MockERC20} from "../../src/MockERC20.sol";
import {CollateralVault} from "../../src/CollateralVault.sol";
import {ComputeSLAHub} from "../../src/ComputeSLAHub.sol";
import {SettlementController} from "../../src/SettlementController.sol";

contract Handler is Test {
    MockERC20 public token;
    CollateralVault public vault;
    ComputeSLAHub public hub;
    SettlementController public controller;

    address public provider = address(0x111);
    address public buyer = address(0x222);
    address public reporter = address(0x333);

    bytes32 public contractId;
    uint32 public constant TOTAL_EPOCHS = 5;
    uint256 public constant SERVICE_FEE = 500e6;
    uint16 public constant BOND_BPS = 2000; // 20% = 100 USDC
    uint64 public constant EPOCH_DURATION = 30; // 30s
    uint256 public constant EPOCH_CAP = 100e6; // 100 USDC

    uint64 public currentEpoch = 0;
    uint64 public contractStartTime;
    bool public isFinalized = false;

    constructor(
        MockERC20 _token,
        CollateralVault _vault,
        ComputeSLAHub _hub,
        SettlementController _controller
    ) {
        token = _token;
        vault = _vault;
        hub = _hub;
        controller = _controller;

        token.mint(provider, 10_000e6);
        token.mint(buyer, 10_000e6);

        vm.prank(provider);
        token.approve(address(vault), type(uint256).max);

        vm.prank(buyer);
        token.approve(address(vault), type(uint256).max);

        // Advance to a realistic timestamp
        vm.warp(1774900000);

        // Setup 1 active contract
        vm.prank(provider);
        bytes32 offerId = hub.createOffer(
            address(token),
            keccak256("H100"),
            SERVICE_FEE,
            BOND_BPS,
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            9900,
            200,
            EPOCH_CAP,
            SERVICE_FEE
        );

        vm.prank(buyer);
        contractId = hub.activateContract(offerId);
        contractStartTime = uint64(block.timestamp);
    }

    function settleNextEpoch(
        uint32 latencySeed,
        uint16 availabilitySeed,
        uint8 quorum
    ) external {
        if (currentEpoch >= TOTAL_EPOCHS || isFinalized) return;

        currentEpoch++;

        // Advance time into the current epoch window
        uint64 epochTimestamp = contractStartTime + (currentEpoch - 1) * EPOCH_DURATION + 10;
        vm.warp(epochTimestamp);

        // Fuzz latency: between 50ms and 800ms
        uint64 latency = 50 + (uint64(latencySeed) % 750);
        // Fuzz availability: between 8500 and 10000 bps
        uint32 availability = 8500 + (uint32(availabilitySeed) % 1501);
        uint8 validQuorum = quorum < 2 ? 2 : (quorum > 5 ? 3 : quorum);

        SettlementController.SLAReport memory report = SettlementController.SLAReport({
            contractId: contractId,
            epochId: currentEpoch,
            p95LatencyMs: latency,
            availabilityBps: availability,
            deliveredUnits: 100,
            evidenceHash: keccak256(abi.encode(currentEpoch, latency, availability)),
            timestamp: epochTimestamp,
            observerQuorum: validQuorum
        });

        vm.prank(reporter);
        controller.settleEpoch(report);

        if (currentEpoch == TOTAL_EPOCHS) {
            isFinalized = true;
        }
    }
}

contract CompSentryInvariantsTest is StdInvariant, Test {
    MockERC20 public token;
    CollateralVault public vault;
    ComputeSLAHub public hub;
    SettlementController public controller;
    Handler public handler;

    address public reporter = address(0x333);

    function setUp() public {
        token = new MockERC20("Mock USD Coin", "USDC", 6);
        vault = new CollateralVault(address(this));
        hub = new ComputeSLAHub(address(this), address(vault));
        controller = new SettlementController(address(this), address(hub), address(vault), reporter);

        vault.setHub(address(hub));
        vault.setController(address(controller));
        hub.setSettlementController(address(controller));

        handler = new Handler(token, vault, hub, controller);

        targetContract(address(handler));
    }

    // Invariant 1: Vault Solvency (Vault token balance >= totalLiabilities)
    function invariant_VaultSolvency() public view {
        uint256 balance = token.balanceOf(address(vault));
        uint256 liabilities = vault.totalLiabilities(address(token));
        assertGe(balance, liabilities, "Vault balance must cover total liabilities");
    }

    // Invariant 4: Exact Liability Conservation
    // Before finalization: remainingEscrow + remainingBond + accruedRebates + accruedSlashing + earnedServiceFee == escrowDeposited + bondDeposited
    function invariant_ExactLiabilityConservation() public view {
        bytes32 contractId = handler.contractId();
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);

        if (!ledger.finalized) {
            uint256 totalAccounted = ledger.remainingEscrow +
                ledger.remainingBond +
                ledger.accruedRebates +
                ledger.accruedSlashing +
                ledger.earnedServiceFee;

            uint256 totalDeposited = ledger.escrowDeposited + ledger.bondDeposited;
            assertEq(totalAccounted, totalDeposited, "Exact conservation: accounted funds must equal deposits");
        }
    }

    // Invariant 2 & 5: Bounded Rebates (Cumulative rebates <= maxTotalPayout)
    function invariant_BoundedPayouts() public view {
        bytes32 contractId = handler.contractId();
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        uint256 totalRebates = controller.cumulativeRebates(contractId);
        assertLe(totalRebates, sla.maxTotalPayout, "Rebates must not exceed maxTotalPayout");
    }

    // Invariant 3 & 6: Bounded Slashing (Cumulative slashing <= providerBond)
    function invariant_BoundedSlashing() public view {
        bytes32 contractId = handler.contractId();
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        uint256 totalSlashing = controller.cumulativeSlashing(contractId);
        assertLe(totalSlashing, sla.providerBond, "Slashing must not exceed initial providerBond");
    }

    // Invariant 8: Epoch Monotonicity
    function invariant_EpochMonotonicity() public view {
        bytes32 contractId = handler.contractId();
        uint64 lastEpoch = controller.lastSettledEpoch(contractId);
        assertLe(lastEpoch, handler.TOTAL_EPOCHS(), "Settled epoch must never exceed totalEpochs");
    }
}
