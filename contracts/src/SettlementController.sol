// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ComputeSLAHub} from "./ComputeSLAHub.sol";
import {CollateralVault} from "./CollateralVault.sol";

/**
 * @title SettlementController
 * @notice Verifies objective Chainlink CRE observations and calculates deterministic on-chain payouts.
 * @dev Strips all trusted financial outcomes from reports. Enforces strict timestamp drift and epoch windows.
 */
contract SettlementController is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct SLAReport {
        bytes32 contractId;
        uint64 epochId;
        uint64 p95LatencyMs;
        uint32 availabilityBps;
        uint64 deliveredUnits; // Telemetry metadata
        bytes32 evidenceHash;
        uint64 timestamp;
        uint8 observerQuorum;
    }

    uint256 public constant MAX_REPORT_AGE = 120;   // 2 minutes max age against current block.timestamp
    uint256 public constant MAX_FUTURE_DRIFT = 30;  // 30 seconds max future drift against block.timestamp
    uint256 public constant MAX_EPOCH_WINDOW_DELAY = 30; // 30 seconds tolerance after epoch end
    uint256 public constant GRACE_PERIOD = 300;     // 5 minutes grace period for expired contracts

    ComputeSLAHub public hub;
    CollateralVault public vault;

    address public authorizedReporter;
    uint8 public minObserverQuorum = 2;

    mapping(bytes32 => mapping(uint64 => bool)) public isSettled;
    mapping(bytes32 => uint64) public lastSettledEpoch;
    mapping(bytes32 => uint256) public cumulativeRebates;
    mapping(bytes32 => uint256) public cumulativeSlashing;

    event EpochSettled(
        bytes32 indexed contractId,
        uint64 indexed epochId,
        uint64 p95LatencyMs,
        uint32 availabilityBps,
        uint64 deliveredUnits,
        uint256 rebateAmount,
        uint256 slashingAmount,
        bytes32 evidenceHash,
        uint64 timestamp,
        uint8 observerQuorum,
        bool breached
    );

    event ContractFlaggedForReview(
        bytes32 indexed contractId,
        uint64 settledEpochs,
        uint32 totalEpochs
    );

    event AuthorizedReporterUpdated(address indexed oldReporter, address indexed newReporter);
    event MinObserverQuorumUpdated(uint8 oldQuorum, uint8 newQuorum);

    error UnauthorizedReporter();
    error InvalidEpoch();
    error EpochAlreadySettled();
    error ContractNotActive();
    error InsufficientQuorum();
    error StaleReportTimestamp();
    error FutureReport();
    error InvalidEpochWindow();
    error PayoutCapExceeded();
    error SlashingCapExceeded();
    error ZeroAddress();
    error InvalidSignature();
    error GracePeriodNotElapsed();
    error AlreadyFinalized();

    modifier onlyAuthorized() {
        if (msg.sender != authorizedReporter && msg.sender != owner()) {
            revert UnauthorizedReporter();
        }
        _;
    }

    constructor(
        address initialOwner,
        address _hub,
        address _vault,
        address _authorizedReporter
    ) Ownable(initialOwner) {
        if (_hub == address(0) || _vault == address(0) || _authorizedReporter == address(0)) {
            revert ZeroAddress();
        }
        hub = ComputeSLAHub(_hub);
        vault = CollateralVault(_vault);
        authorizedReporter = _authorizedReporter;
    }

    function setAuthorizedReporter(address _reporter) external onlyOwner {
        if (_reporter == address(0)) revert ZeroAddress();
        emit AuthorizedReporterUpdated(authorizedReporter, _reporter);
        authorizedReporter = _reporter;
    }

    function setMinObserverQuorum(uint8 _quorum) external onlyOwner {
        emit MinObserverQuorumUpdated(minObserverQuorum, _quorum);
        minObserverQuorum = _quorum;
    }

    /**
     * @notice Computes deterministic hash of an SLA report containing only objective observations.
     */
    function hashReport(SLAReport calldata report) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                report.contractId,
                report.epochId,
                report.p95LatencyMs,
                report.availabilityBps,
                report.deliveredUnits,
                report.evidenceHash,
                report.timestamp,
                report.observerQuorum
            )
        );
    }

    /**
     * @notice Deterministic settlement calculation derived entirely from on-chain rules and objective telemetry.
     */
    function calculateEpochSettlement(
        ComputeSLAHub.SLAContract memory sla,
        CollateralVault.VaultLedger memory ledger,
        SLAReport calldata report
    )
        public
        view
        returns (
            uint256 rebateAmount,
            uint256 slashingAmount,
            uint256 feeEarned,
            bool breached
        )
    {
        // 1. Determine epoch fee allocation (last epoch absorbs rounding remainder to prevent stranding)
        uint256 epochFee = (report.epochId == sla.totalEpochs)
            ? ledger.remainingEscrow
            : (sla.serviceFee / sla.totalEpochs);

        // 2. Evaluate SLA compliance
        bool latencyBreach = report.p95LatencyMs > sla.latencyThresholdMs;
        bool availabilityBreach = report.availabilityBps < sla.availabilityThresholdBps;
        breached = latencyBreach || availabilityBreach;

        if (!breached) {
            // Compliant: provider earns full epoch fee, zero rebate, zero slashing
            feeEarned = epochFee;
            rebateAmount = 0;
            slashingAmount = 0;
            return (rebateAmount, slashingAmount, feeEarned, breached);
        }

        // 3. Deterministic Breach Schedule
        // Major breach: latency > 1.5x threshold OR availability < 95.00%
        bool isMajor = (report.p95LatencyMs > (sla.latencyThresholdMs * 3) / 2) ||
                       (report.availabilityBps < 9500);

        if (!isMajor) {
            // Minor breach: 50% epoch rebate to buyer, 50% earned by provider, 0 bond slash
            rebateAmount = (epochFee * 50) / 100;
            feeEarned = epochFee - rebateAmount;
            slashingAmount = 0;
        } else {
            // Major breach: 100% epoch rebate to buyer, 0 fee to provider
            rebateAmount = epochFee;
            feeEarned = 0;

            // Proportional bond slashing based on availability deficit below threshold
            uint256 baseEpochBond = sla.providerBond / sla.totalEpochs;
            if (report.availabilityBps < sla.availabilityThresholdBps) {
                uint256 deficitBps = sla.availabilityThresholdBps - report.availabilityBps;
                slashingAmount = (baseEpochBond * deficitBps) / sla.availabilityThresholdBps;
            } else {
                // Latency-only major breach slashes 15% of epoch bond share
                slashingAmount = (baseEpochBond * 15) / 100;
            }
        }

        // 4. Enforce strict caps
        if (rebateAmount > sla.epochPayoutCap) {
            rebateAmount = sla.epochPayoutCap;
            feeEarned = epochFee > rebateAmount ? epochFee - rebateAmount : 0;
        }

        uint256 remainingRebateBudget = sla.maxTotalPayout > cumulativeRebates[report.contractId]
            ? sla.maxTotalPayout - cumulativeRebates[report.contractId]
            : 0;
        if (rebateAmount > remainingRebateBudget) {
            rebateAmount = remainingRebateBudget;
            feeEarned = epochFee > rebateAmount ? epochFee - rebateAmount : 0;
        }

        if (slashingAmount > ledger.remainingBond) {
            slashingAmount = ledger.remainingBond;
        }
    }

    /**
     * @notice Settles an epoch submitted by an authorized reporter.
     */
    function settleEpoch(SLAReport calldata report) external onlyAuthorized {
        _processSettlement(report);
    }

    /**
     * @notice Settles an epoch using a signed CRE report.
     */
    function settleEpochWithSignature(
        SLAReport calldata report,
        bytes calldata signature
    ) external {
        bytes32 digest = hashReport(report).toEthSignedMessageHash();
        address signer = digest.recover(signature);
        if (signer != authorizedReporter) revert InvalidSignature();

        _processSettlement(report);
    }

    function _processSettlement(SLAReport calldata report) internal {
        ComputeSLAHub.SLAContract memory sla = hub.getContract(report.contractId);
        if (sla.status != ComputeSLAHub.ContractStatus.ACTIVE) revert ContractNotActive();

        if (report.observerQuorum < minObserverQuorum) revert InsufficientQuorum();
        if (report.epochId != lastSettledEpoch[report.contractId] + 1) revert InvalidEpoch();
        if (isSettled[report.contractId][report.epochId]) revert EpochAlreadySettled();
        if (report.epochId > sla.totalEpochs) revert InvalidEpoch();

        // 1. Strict Timestamp Drift Validations against block.timestamp
        if (report.timestamp + MAX_REPORT_AGE < block.timestamp) revert StaleReportTimestamp();
        if (report.timestamp > block.timestamp + MAX_FUTURE_DRIFT) revert FutureReport();

        // 2. Epoch Window Validation
        uint64 expectedStart = sla.startTimestamp + (report.epochId - 1) * sla.epochDuration;
        uint64 expectedEnd = expectedStart + sla.epochDuration;
        if (report.timestamp < expectedStart || report.timestamp > expectedEnd + MAX_EPOCH_WINDOW_DELAY) {
            revert InvalidEpochWindow();
        }

        // 3. Deterministic settlement calculation
        CollateralVault.VaultLedger memory ledger = vault.getLedger(report.contractId);
        (
            uint256 rebateAmount,
            uint256 slashingAmount,
            uint256 feeEarned,
            bool breached
        ) = calculateEpochSettlement(sla, ledger, report);

        // Mark settled
        isSettled[report.contractId][report.epochId] = true;
        lastSettledEpoch[report.contractId] = report.epochId;
        cumulativeRebates[report.contractId] += rebateAmount;
        cumulativeSlashing[report.contractId] += slashingAmount;

        // Process in Vault
        vault.processEpochSettlement(
            report.contractId,
            feeEarned,
            rebateAmount,
            slashingAmount
        );

        emit EpochSettled(
            report.contractId,
            report.epochId,
            report.p95LatencyMs,
            report.availabilityBps,
            report.deliveredUnits,
            rebateAmount,
            slashingAmount,
            report.evidenceHash,
            report.timestamp,
            report.observerQuorum,
            breached
        );

        // Finalize when last epoch reached
        if (report.epochId == sla.totalEpochs) {
            hub.updateContractStatus(report.contractId, ComputeSLAHub.ContractStatus.FINALIZED);
            vault.finalizeContract(report.contractId);
        }
    }

    /**
     * @notice Handles expired contracts with missing/unreported epochs.
     * @dev If epochs are missing, moves to REVIEW_REQUIRED instead of silently finalizing.
     */
    function resolveExpiredContract(bytes32 contractId) external {
        ComputeSLAHub.SLAContract memory sla = hub.getContract(contractId);
        if (sla.status != ComputeSLAHub.ContractStatus.ACTIVE) revert ContractNotActive();
        if (block.timestamp < sla.endTimestamp + GRACE_PERIOD) revert GracePeriodNotElapsed();

        uint64 settled = lastSettledEpoch[contractId];
        if (settled < sla.totalEpochs) {
            // Missing epochs -> requires review/dispute resolution
            hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.REVIEW_REQUIRED);
            emit ContractFlaggedForReview(contractId, settled, sla.totalEpochs);
        } else {
            // All epochs were settled, finalize cleanly
            hub.updateContractStatus(contractId, ComputeSLAHub.ContractStatus.FINALIZED);
            vault.finalizeContract(contractId);
        }
    }
}
