// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MockERC20} from "../../src/MockERC20.sol";
import {CollateralVault} from "../../src/CollateralVault.sol";
import {ComputeSLAHub} from "../../src/ComputeSLAHub.sol";

contract CompSentryHubAndVaultTest is Test {
    MockERC20 public token;
    CollateralVault public vault;
    ComputeSLAHub public hub;

    address public owner = address(this);
    address public provider = address(0x111);
    address public buyer = address(0x222);
    address public controller = address(0x333);

    bytes32 public constant RESOURCE_ID = keccak256("RUNPOD-H100-SX4");
    uint256 public constant SERVICE_FEE = 300e6; // 300 USDC (6 decimals)
    uint16 public constant BOND_BPS = 1500;       // 15% bond (45 USDC) - between 10% and 25%
    uint64 public constant EPOCH_DURATION = 30;  // 30 seconds
    uint32 public constant TOTAL_EPOCHS = 10;    // 10 epochs
    uint32 public constant AVAILABILITY_BPS = 9900; // 99%
    uint32 public constant LATENCY_MS = 200;     // 200ms
    uint256 public constant EPOCH_CAP = 30e6;    // 30 USDC cap per epoch (= 300 / 10)
    uint256 public constant MAX_PAYOUT = 300e6;  // 300 USDC total cap (= serviceFee)

    function setUp() public {
        token = new MockERC20("Mock USD Coin", "USDC", 6);
        vault = new CollateralVault(owner);
        hub = new ComputeSLAHub(owner, address(vault));

        vault.setHub(address(hub));
        vault.setController(controller);
        hub.setSettlementController(controller);

        // Fund provider and buyer
        token.mint(provider, 1000e6);
        token.mint(buyer, 1000e6);

        vm.prank(provider);
        token.approve(address(vault), type(uint256).max);

        vm.prank(buyer);
        token.approve(address(vault), type(uint256).max);
    }

    function test_CreateOffer_Success() public {
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

        ComputeSLAHub.SLAOffer memory offer = hub.getOffer(offerId);
        assertEq(offer.provider, provider);
        assertEq(offer.token, address(token));
        assertEq(offer.serviceFee, SERVICE_FEE);
        assertEq(offer.bondBps, BOND_BPS);
        assertTrue(offer.active);
    }

    function test_CreateOffer_RevertZeroToken() public {
        vm.prank(provider);
        vm.expectRevert(ComputeSLAHub.ZeroAddress.selector);
        hub.createOffer(
            address(0),
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
    }

    function test_CreateOffer_RevertBondTooLow() public {
        vm.prank(provider);
        vm.expectRevert(ComputeSLAHub.InvalidBondBps.selector);
        hub.createOffer(
            address(token),
            RESOURCE_ID,
            SERVICE_FEE,
            999, // < 1000 (10%)
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            AVAILABILITY_BPS,
            LATENCY_MS,
            EPOCH_CAP,
            MAX_PAYOUT
        );
    }

    function test_CreateOffer_RevertBondTooHigh() public {
        vm.prank(provider);
        vm.expectRevert(ComputeSLAHub.InvalidBondBps.selector);
        hub.createOffer(
            address(token),
            RESOURCE_ID,
            SERVICE_FEE,
            2501, // > 2500 (25%)
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            AVAILABILITY_BPS,
            LATENCY_MS,
            EPOCH_CAP,
            MAX_PAYOUT
        );
    }

    function test_CreateOffer_RevertPayoutCapExceedsServiceFee() public {
        vm.prank(provider);
        vm.expectRevert(ComputeSLAHub.InvalidPayoutCap.selector);
        hub.createOffer(
            address(token),
            RESOURCE_ID,
            SERVICE_FEE,
            BOND_BPS,
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            AVAILABILITY_BPS,
            LATENCY_MS,
            EPOCH_CAP,
            SERVICE_FEE + 1 // maxTotalPayout > serviceFee
        );
    }

    function test_CreateOffer_RevertEpochCapExceedsEpochFee() public {
        vm.prank(provider);
        vm.expectRevert(ComputeSLAHub.InvalidPayoutCap.selector);
        hub.createOffer(
            address(token),
            RESOURCE_ID,
            SERVICE_FEE,
            BOND_BPS,
            EPOCH_DURATION,
            TOTAL_EPOCHS,
            AVAILABILITY_BPS,
            LATENCY_MS,
            (SERVICE_FEE / TOTAL_EPOCHS) + 1, // epochPayoutCap > serviceFee / totalEpochs
            MAX_PAYOUT
        );
    }

    function test_DeactivateOffer() public {
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

        vm.prank(provider);
        hub.deactivateOffer(offerId);

        ComputeSLAHub.SLAOffer memory offer = hub.getOffer(offerId);
        assertFalse(offer.active);

        // Buyer cannot activate deactivated offer
        vm.prank(buyer);
        vm.expectRevert(ComputeSLAHub.OfferNotActive.selector);
        hub.activateContract(offerId);
    }

    function test_ActivateContract_Success() public {
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

        uint256 expectedBond = (SERVICE_FEE * BOND_BPS) / 10000; // 45 USDC
        uint256 buyerBalanceBefore = token.balanceOf(buyer);
        uint256 providerBalanceBefore = token.balanceOf(provider);

        vm.prank(buyer);
        bytes32 contractId = hub.activateContract(offerId);

        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        assertEq(sla.buyer, buyer);
        assertEq(sla.provider, provider);
        assertEq(sla.serviceFee, SERVICE_FEE);
        assertEq(sla.providerBond, expectedBond);
        assertEq(uint256(sla.status), uint256(ComputeSLAHub.ContractStatus.ACTIVE));

        // Check token movements into Vault
        assertEq(token.balanceOf(address(vault)), SERVICE_FEE + expectedBond);
        assertEq(token.balanceOf(buyer), buyerBalanceBefore - SERVICE_FEE);
        assertEq(token.balanceOf(provider), providerBalanceBefore - expectedBond);

        // Check vault ledger
        CollateralVault.VaultLedger memory ledger = vault.getLedger(contractId);
        assertEq(ledger.escrowDeposited, SERVICE_FEE);
        assertEq(ledger.bondDeposited, expectedBond);
        assertEq(ledger.remainingEscrow, SERVICE_FEE);
        assertEq(ledger.remainingBond, expectedBond);
        assertFalse(ledger.finalized);
    }

    function test_StateTransitions_ValidAndInvalid() public {
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

        vm.prank(buyer);
        bytes32 contractId = hub.activateContract(offerId);

        // Valid transition: ACTIVE -> REVIEW_REQUIRED
        vm.prank(controller);
        hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.REVIEW_REQUIRED);
        assertEq(uint256(hub.getContract(contractId).status), uint256(ComputeSLAHub.ContractStatus.REVIEW_REQUIRED));

        // Invalid transition: REVIEW_REQUIRED -> ACTIVE
        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(
                ComputeSLAHub.InvalidStateTransition.selector,
                ComputeSLAHub.ContractStatus.REVIEW_REQUIRED,
                ComputeSLAHub.ContractStatus.ACTIVE
            )
        );
        hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.ACTIVE);

        // Valid transition: REVIEW_REQUIRED -> FINALIZED
        vm.prank(controller);
        hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.FINALIZED);
        assertEq(uint256(hub.getContract(contractId).status), uint256(ComputeSLAHub.ContractStatus.FINALIZED));

        // Invalid transition: FINALIZED -> ACTIVE
        vm.prank(controller);
        vm.expectRevert(
            abi.encodeWithSelector(
                ComputeSLAHub.InvalidStateTransition.selector,
                ComputeSLAHub.ContractStatus.FINALIZED,
                ComputeSLAHub.ContractStatus.ACTIVE
            )
        );
        hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.ACTIVE);
    }

    function test_Vault_DirectDepositRevertsUnauthorized() public {
        vm.expectRevert(CollateralVault.UnauthorizedCaller.selector);
        vault.depositEscrowAndBond(
            bytes32("dummy"),
            address(token),
            buyer,
            100e6,
            provider,
            15e6
        );
    }
}
