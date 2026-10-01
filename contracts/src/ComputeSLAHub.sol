// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CollateralVault} from "./CollateralVault.sol";

/**
 * @title ComputeSLAHub
 * @notice Central registry managing SLA offer templates, buyer activations, and contract state machines.
 * @dev Enforces strict parameter validation (10-25% bond, payout caps) and state machine transitions.
 */
contract ComputeSLAHub is Ownable {
    enum ContractStatus {
        NONE,
        CREATED,
        ACTIVE,
        FINALIZED,
        REVIEW_REQUIRED
    }

    struct SLAOffer {
        bytes32 offerId;
        address provider;
        address token;
        bytes32 resourceId;
        uint256 serviceFee;
        uint16 bondBps;
        uint64 epochDuration;
        uint32 totalEpochs;
        uint32 availabilityThresholdBps;
        uint32 latencyThresholdMs;
        uint256 epochPayoutCap;
        uint256 maxTotalPayout;
        bool active;
    }

    struct SLAContract {
        bytes32 contractId;
        bytes32 offerId;
        address buyer;
        address provider;
        address token;
        uint256 serviceFee;
        uint256 providerBond;
        uint64 startTimestamp;
        uint64 endTimestamp;
        uint64 epochDuration;
        uint32 totalEpochs;
        uint32 availabilityThresholdBps;
        uint32 latencyThresholdMs;
        uint256 epochPayoutCap;
        uint256 maxTotalPayout;
        ContractStatus status;
    }

    uint16 public constant MIN_BOND_BPS = 1000; // 10% minimum bond
    uint16 public constant MAX_BOND_BPS = 2500; // 25% maximum bond

    CollateralVault public vault;
    address public settlementController;
    uint256 public contractNonce;

    mapping(bytes32 => SLAOffer) public offers;
    mapping(bytes32 => SLAContract) public contracts;

    event SLAOfferCreated(
        bytes32 indexed offerId,
        address indexed provider,
        address indexed token,
        bytes32 resourceId,
        uint256 serviceFee,
        uint16 bondBps,
        uint64 epochDuration,
        uint32 totalEpochs
    );

    event SLAOfferDeactivated(bytes32 indexed offerId);

    event SLAContractActivated(
        bytes32 indexed contractId,
        bytes32 indexed offerId,
        address indexed buyer,
        address provider,
        uint256 serviceFee,
        uint256 providerBond,
        uint64 startTimestamp,
        uint64 endTimestamp
    );

    event SLAContractStatusUpdated(
        bytes32 indexed contractId,
        ContractStatus oldStatus,
        ContractStatus newStatus
    );

    event SettlementControllerUpdated(address indexed oldController, address indexed newController);

    error UnauthorizedCaller();
    error ZeroAddress();
    error InvalidParameters();
    error InvalidBondBps();
    error InvalidPayoutCap();
    error OfferNotFound();
    error OfferNotActive();
    error ContractNotFound();
    error InvalidStateTransition(ContractStatus from, ContractStatus to);

    modifier onlyController() {
        if (msg.sender != settlementController) revert UnauthorizedCaller();
        _;
    }

    constructor(address initialOwner, address _vault) Ownable(initialOwner) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = CollateralVault(_vault);
    }

    function setSettlementController(address _controller) external onlyOwner {
        if (_controller == address(0)) revert ZeroAddress();
        emit SettlementControllerUpdated(settlementController, _controller);
        settlementController = _controller;
    }

    /**
     * @notice Registers a new SLA offer by a compute provider.
     */
    function createOffer(
        address token,
        bytes32 resourceId,
        uint256 serviceFee,
        uint16 bondBps,
        uint64 epochDuration,
        uint32 totalEpochs,
        uint32 availabilityThresholdBps,
        uint32 latencyThresholdMs,
        uint256 epochPayoutCap,
        uint256 maxTotalPayout
    ) external returns (bytes32 offerId) {
        if (token == address(0)) revert ZeroAddress();
        if (serviceFee == 0 || totalEpochs == 0 || epochDuration == 0) revert InvalidParameters();
        if (bondBps < MIN_BOND_BPS || bondBps > MAX_BOND_BPS) revert InvalidBondBps();
        if (availabilityThresholdBps == 0 || availabilityThresholdBps > 10000) revert InvalidParameters();
        if (latencyThresholdMs == 0) revert InvalidParameters();

        // Enforce economic constraints: maxTotalPayout <= serviceFee, epochPayoutCap <= serviceFee / totalEpochs
        if (maxTotalPayout == 0 || maxTotalPayout > serviceFee) revert InvalidPayoutCap();
        if (epochPayoutCap == 0 || epochPayoutCap > (serviceFee / totalEpochs)) revert InvalidPayoutCap();

        offerId = keccak256(
            abi.encode(
                msg.sender,
                token,
                resourceId,
                serviceFee,
                bondBps,
                block.timestamp,
                contractNonce++
            )
        );

        offers[offerId] = SLAOffer({
            offerId: offerId,
            provider: msg.sender,
            token: token,
            resourceId: resourceId,
            serviceFee: serviceFee,
            bondBps: bondBps,
            epochDuration: epochDuration,
            totalEpochs: totalEpochs,
            availabilityThresholdBps: availabilityThresholdBps,
            latencyThresholdMs: latencyThresholdMs,
            epochPayoutCap: epochPayoutCap,
            maxTotalPayout: maxTotalPayout,
            active: true
        });

        emit SLAOfferCreated(
            offerId,
            msg.sender,
            token,
            resourceId,
            serviceFee,
            bondBps,
            epochDuration,
            totalEpochs
        );
    }

    /**
     * @notice Allows a provider to deactivate their unaccepted offer.
     */
    function deactivateOffer(bytes32 offerId) external {
        SLAOffer storage offer = offers[offerId];
        if (offer.provider != msg.sender) revert UnauthorizedCaller();
        offer.active = false;
        emit SLAOfferDeactivated(offerId);
    }

    /**
     * @notice Buyer activates an SLA contract from an existing offer.
     * @dev Transfers buyer service fee escrow and provider performance bond into CollateralVault.
     */
    function activateContract(bytes32 offerId) external returns (bytes32 contractId) {
        SLAOffer memory offer = offers[offerId];
        if (offer.provider == address(0)) revert OfferNotFound();
        if (!offer.active) revert OfferNotActive();

        uint256 providerBond = (offer.serviceFee * offer.bondBps) / 10000;
        uint64 startTimestamp = uint64(block.timestamp);
        uint64 endTimestamp = startTimestamp + (offer.epochDuration * offer.totalEpochs);

        contractId = keccak256(
            abi.encode(
                offerId,
                msg.sender,
                offer.provider,
                startTimestamp,
                contractNonce++
            )
        );

        contracts[contractId] = SLAContract({
            contractId: contractId,
            offerId: offerId,
            buyer: msg.sender,
            provider: offer.provider,
            token: offer.token,
            serviceFee: offer.serviceFee,
            providerBond: providerBond,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            epochDuration: offer.epochDuration,
            totalEpochs: offer.totalEpochs,
            availabilityThresholdBps: offer.availabilityThresholdBps,
            latencyThresholdMs: offer.latencyThresholdMs,
            epochPayoutCap: offer.epochPayoutCap,
            maxTotalPayout: offer.maxTotalPayout,
            status: ContractStatus.ACTIVE
        });

        // Deposit funds into Vault
        vault.depositEscrowAndBond(
            contractId,
            offer.token,
            msg.sender,
            offer.serviceFee,
            offer.provider,
            providerBond
        );

        emit SLAContractActivated(
            contractId,
            offerId,
            msg.sender,
            offer.provider,
            offer.serviceFee,
            providerBond,
            startTimestamp,
            endTimestamp
        );
    }

    /**
     * @notice Strict state machine transition validation.
     */
    function _isValidTransition(ContractStatus from, ContractStatus to) internal pure returns (bool) {
        if (from == ContractStatus.CREATED && to == ContractStatus.ACTIVE) return true;
        if (from == ContractStatus.ACTIVE && to == ContractStatus.FINALIZED) return true;
        if (from == ContractStatus.ACTIVE && to == ContractStatus.REVIEW_REQUIRED) return true;
        if (from == ContractStatus.REVIEW_REQUIRED && to == ContractStatus.FINALIZED) return true;
        return false;
    }

    /**
     * @notice Allows SettlementController to transition contract state.
     */
    function updateContractStatus(bytes32 contractId, ContractStatus newStatus) external onlyController {
        SLAContract storage c = contracts[contractId];
        if (c.status == ContractStatus.NONE) revert ContractNotFound();

        ContractStatus oldStatus = c.status;
        if (!_isValidTransition(oldStatus, newStatus)) {
            revert InvalidStateTransition(oldStatus, newStatus);
        }

        c.status = newStatus;
        emit SLAContractStatusUpdated(contractId, oldStatus, newStatus);
    }

    function getOffer(bytes32 offerId) external view returns (SLAOffer memory) {
        return offers[offerId];
    }

    function getContract(bytes32 contractId) external view returns (SLAContract memory) {
        return contracts[contractId];
    }
}
