// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CollateralVault
 * @notice Isolated multi-contract custody vault holding buyer escrow and provider performance bonds.
 * @dev Enforces strict per-contract accounting, solvency invariants, and access control.
 */
contract CollateralVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VaultLedger {
        address token;
        address buyer;
        address provider;
        uint256 escrowDeposited;
        uint256 bondDeposited;
        uint256 remainingEscrow;
        uint256 remainingBond;
        uint256 accruedRebates;   // Accrued to buyer from escrow
        uint256 accruedSlashing;  // Accrued to buyer from provider bond
        uint256 earnedServiceFee; // Accrued to provider from escrow
        bool finalized;
    }

    address public hub;
    address public controller;

    mapping(bytes32 => VaultLedger) public ledgers;
    mapping(address => uint256) public totalLiabilities;

    event EscrowAndBondDeposited(
        bytes32 indexed contractId,
        address indexed token,
        address indexed buyer,
        address provider,
        uint256 escrowAmount,
        uint256 bondAmount
    );

    event EpochSettlementProcessed(
        bytes32 indexed contractId,
        uint256 feeEarned,
        uint256 rebateAmount,
        uint256 slashingAmount,
        uint256 remainingEscrow,
        uint256 remainingBond
    );

    event FundsFinalized(
        bytes32 indexed contractId,
        address indexed buyer,
        uint256 totalToBuyer,
        address indexed provider,
        uint256 totalToProvider
    );

    event HubUpdated(address indexed oldHub, address indexed newHub);
    event ControllerUpdated(address indexed oldController, address indexed newController);

    error UnauthorizedCaller();
    error ZeroAddress();
    error InvalidAmount();
    error ContractAlreadyExists();
    error ContractNotFinalizable();
    error InsufficientEscrow();
    error InsufficientBond();
    error AlreadyFinalized();

    modifier onlyHub() {
        if (msg.sender != hub) revert UnauthorizedCaller();
        _;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert UnauthorizedCaller();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setHub(address _hub) external onlyOwner {
        if (_hub == address(0)) revert ZeroAddress();
        emit HubUpdated(hub, _hub);
        hub = _hub;
    }

    function setController(address _controller) external onlyOwner {
        if (_controller == address(0)) revert ZeroAddress();
        emit ControllerUpdated(controller, _controller);
        controller = _controller;
    }

    /**
     * @notice Locks buyer escrow and provider bond for an activated contract.
     * @dev Called exclusively by ComputeSLAHub when a contract is activated.
     */
    function depositEscrowAndBond(
        bytes32 contractId,
        address token,
        address buyer,
        uint256 escrowAmount,
        address provider,
        uint256 bondAmount
    ) external onlyHub nonReentrant {
        if (token == address(0) || buyer == address(0) || provider == address(0)) revert ZeroAddress();
        if (ledgers[contractId].escrowDeposited != 0) revert ContractAlreadyExists();

        ledgers[contractId] = VaultLedger({
            token: token,
            buyer: buyer,
            provider: provider,
            escrowDeposited: escrowAmount,
            bondDeposited: bondAmount,
            remainingEscrow: escrowAmount,
            remainingBond: bondAmount,
            accruedRebates: 0,
            accruedSlashing: 0,
            earnedServiceFee: 0,
            finalized: false
        });

        totalLiabilities[token] += (escrowAmount + bondAmount);

        if (escrowAmount > 0) {
            IERC20(token).safeTransferFrom(buyer, address(this), escrowAmount);
        }
        if (bondAmount > 0) {
            IERC20(token).safeTransferFrom(provider, address(this), bondAmount);
        }

        emit EscrowAndBondDeposited(contractId, token, buyer, provider, escrowAmount, bondAmount);
    }

    /**
     * @notice Adjusts balances after an epoch evaluation.
     * @dev Called exclusively by SettlementController.
     */
    function processEpochSettlement(
        bytes32 contractId,
        uint256 feeEarned,
        uint256 rebateAmount,
        uint256 slashingAmount
    ) external onlyController nonReentrant {
        VaultLedger storage ledger = ledgers[contractId];
        if (ledger.finalized) revert AlreadyFinalized();

        if (feeEarned + rebateAmount > ledger.remainingEscrow) revert InsufficientEscrow();
        if (slashingAmount > ledger.remainingBond) revert InsufficientBond();

        ledger.remainingEscrow -= (feeEarned + rebateAmount);
        ledger.earnedServiceFee += feeEarned;
        ledger.accruedRebates += rebateAmount;

        ledger.remainingBond -= slashingAmount;
        ledger.accruedSlashing += slashingAmount;

        emit EpochSettlementProcessed(
            contractId,
            feeEarned,
            rebateAmount,
            slashingAmount,
            ledger.remainingEscrow,
            ledger.remainingBond
        );
    }

    /**
     * @notice Finalizes contract, disburses earned fees + remaining bond to provider,
     *         and rebates + slashing + remaining unspent escrow to buyer.
     * @dev Called exclusively by SettlementController on contract conclusion.
     */
    function finalizeContract(bytes32 contractId) external onlyController nonReentrant {
        VaultLedger storage ledger = ledgers[contractId];
        if (ledger.escrowDeposited == 0) revert ContractNotFinalizable();
        if (ledger.finalized) revert AlreadyFinalized();

        ledger.finalized = true;

        uint256 totalToBuyer = ledger.accruedRebates + ledger.accruedSlashing + ledger.remainingEscrow;
        uint256 totalToProvider = ledger.earnedServiceFee + ledger.remainingBond;

        uint256 totalDisbursed = totalToBuyer + totalToProvider;
        totalLiabilities[ledger.token] -= totalDisbursed;

        // Reset balances
        ledger.remainingEscrow = 0;
        ledger.remainingBond = 0;

        if (totalToBuyer > 0) {
            IERC20(ledger.token).safeTransfer(ledger.buyer, totalToBuyer);
        }
        if (totalToProvider > 0) {
            IERC20(ledger.token).safeTransfer(ledger.provider, totalToProvider);
        }

        emit FundsFinalized(contractId, ledger.buyer, totalToBuyer, ledger.provider, totalToProvider);
    }

    function getLedger(bytes32 contractId) external view returns (VaultLedger memory) {
        return ledgers[contractId];
    }
}
