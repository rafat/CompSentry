import { indexer } from "envio";

const GLOBAL_METRICS_ID = "global_system_metrics";

// Helper to get or initialize SystemMetrics
async function getOrCreateSystemMetrics(context: any) {
  let metrics = await context.SystemMetrics.get(GLOBAL_METRICS_ID);
  if (!metrics) {
    metrics = {
      id: GLOBAL_METRICS_ID,
      totalValueLocked: 0n,
      totalActiveEscrow: 0n,
      totalActiveBond: 0n,
      totalSettledRebates: 0n,
      totalSlashedBonds: 0n,
      totalSettlementsCount: 0n,
      totalContractsCount: 0n,
      curBps: 0n
    };
  }
  return metrics;
}

// Calculate Provider Reliability Index (0 - 10000 bps)
// Pure, deterministic scoring: 90% compliance + 10% volume bonus
function calculatePRI(provider: any): bigint {
  const totalEpochs = provider.compliantEpochsCount + provider.breachCount;
  if (totalEpochs === 0n) return 5000n; // Baseline 50% for unestablished providers

  const complianceRateBps = (provider.compliantEpochsCount * 10000n) / totalEpochs;
  const volumeBonus = provider.totalContracts > 50n ? 1000n : provider.totalContracts * 20n;

  const pri = (complianceRateBps * 90n) / 100n + (volumeBonus * 10n) / 100n;
  return pri > 10000n ? 10000n : pri;
}

// =========================================================================
// ComputeSLAHub Handlers
// =========================================================================

indexer.onEvent(
  { contract: "ComputeSLAHub", event: "SLAOfferCreated" },
  async ({ event, context }) => {
    const {
      offerId,
      provider: providerAddr,
      token,
      resourceId,
      serviceFee,
      bondBps,
      epochDuration,
      totalEpochs,
      availabilityThresholdBps,
      latencyThresholdMs,
      epochPayoutCap,
      maxTotalPayout
    } = event.params;

    // 1. Get or create Provider
    let provider = await context.Provider.get(providerAddr);
    if (!provider) {
      provider = {
        id: providerAddr,
        totalOffers: 0n,
        totalContracts: 0n,
        activeContracts: 0n,
        totalBondStaked: 0n,
        totalSlashed: 0n,
        totalEarned: 0n,
        breachCount: 0n,
        compliantEpochsCount: 0n,
        priScore: 5000n // Unestablished baseline
      };
    }
    context.Provider.set({
      ...provider,
      totalOffers: provider.totalOffers + 1n
    });

    // 2. Record full SLAOffer entity
    context.SLAOffer.set({
      id: offerId,
      provider_id: providerAddr,
      token,
      resourceId,
      serviceFee,
      bondBps: BigInt(bondBps),
      availabilityThresholdBps: BigInt(availabilityThresholdBps),
      latencyThresholdMs: BigInt(latencyThresholdMs),
      epochDuration,
      totalEpochs: BigInt(totalEpochs),
      epochPayoutCap,
      maxTotalPayout,
      active: true,
      createdAtBlock: BigInt(event.block.number),
      createdAtTimestamp: BigInt(event.block.timestamp)
    });
  }
);

indexer.onEvent(
  { contract: "ComputeSLAHub", event: "SLAOfferDeactivated" },
  async ({ event, context }) => {
    const { offerId } = event.params;
    const offer = await context.SLAOffer.get(offerId);
    if (offer) {
      context.SLAOffer.set({
        ...offer,
        active: false
      });
    }
  }
);

indexer.onEvent(
  { contract: "ComputeSLAHub", event: "SLAContractActivated" },
  async ({ event, context }) => {
    const {
      contractId,
      offerId,
      buyer: buyerAddr,
      provider: providerAddr,
      serviceFee,
      providerBond,
      startTimestamp,
      endTimestamp,
      epochDuration,
      totalEpochs,
      availabilityThresholdBps,
      latencyThresholdMs,
      epochPayoutCap,
      maxTotalPayout
    } = event.params;

    // 1. Update Buyer
    let buyer = await context.Buyer.get(buyerAddr);
    if (!buyer) {
      buyer = {
        id: buyerAddr,
        totalContracts: 0n,
        activeContracts: 0n,
        totalEscrowFunded: 0n,
        totalRebatesReceived: 0n
      };
    }
    context.Buyer.set({
      ...buyer,
      totalContracts: buyer.totalContracts + 1n,
      activeContracts: buyer.activeContracts + 1n,
      totalEscrowFunded: buyer.totalEscrowFunded + serviceFee
    });

    // 2. Update Provider
    let provider = await context.Provider.get(providerAddr);
    if (provider) {
      const updatedProvider = {
        ...provider,
        totalContracts: provider.totalContracts + 1n,
        activeContracts: provider.activeContracts + 1n,
        totalBondStaked: provider.totalBondStaked + providerBond
      };
      context.Provider.set({
        ...updatedProvider,
        priScore: calculatePRI(updatedProvider)
      });
    }

    // 3. Create SLAContract entity with full SLA terms and initial remaining balances
    context.SLAContract.set({
      id: contractId,
      offer_id: offerId,
      buyer_id: buyerAddr,
      provider_id: providerAddr,
      serviceFee,
      providerBond,
      currentRemainingEscrow: serviceFee,
      currentRemainingBond: providerBond,
      startTimestamp,
      endTimestamp,
      totalEpochs: BigInt(totalEpochs),
      epochDuration,
      availabilityThresholdBps: BigInt(availabilityThresholdBps),
      latencyThresholdMs: BigInt(latencyThresholdMs),
      epochPayoutCap,
      maxTotalPayout,
      settledEpochsCount: 0n,
      cumulativeRebates: 0n,
      cumulativeSlashing: 0n,
      status: "ACTIVE",
      createdAtBlock: BigInt(event.block.number),
      createdAtTimestamp: BigInt(event.block.timestamp)
    });

    // 4. Update System Metrics: Escrow + Bond = TVL
    let metrics = await getOrCreateSystemMetrics(context);
    const newActiveEscrow = metrics.totalActiveEscrow + serviceFee;
    const newActiveBond = metrics.totalActiveBond + providerBond;
    const newTVL = newActiveEscrow + newActiveBond;
    context.SystemMetrics.set({
      ...metrics,
      totalActiveEscrow: newActiveEscrow,
      totalActiveBond: newActiveBond,
      totalValueLocked: newTVL,
      totalContractsCount: metrics.totalContractsCount + 1n,
      curBps: newTVL > 0n ? (newActiveBond * 10000n) / newTVL : 0n
    });
  }
);

indexer.onEvent(
  { contract: "ComputeSLAHub", event: "SLAContractStatusUpdated" },
  async ({ event, context }) => {
    const { contractId, newStatus } = event.params;
    const contract = await context.SLAContract.get(contractId);
    if (contract) {
      const statusMap: Record<number, string> = {
        0: "NONE",
        1: "ACTIVE",
        2: "REVIEW_REQUIRED",
        3: "FINALIZED"
      };
      const statusStr = statusMap[Number(newStatus)] || "UNKNOWN";
      context.SLAContract.set({
        ...contract,
        status: statusStr
      });
    }
  }
);

// =========================================================================
// SettlementController Handlers
// =========================================================================

indexer.onEvent(
  { contract: "SettlementController", event: "EpochSettled" },
  async ({ event, context }) => {
    const {
      contractId,
      epochId,
      p95LatencyMs,
      availabilityBps,
      deliveredUnits,
      rebateAmount,
      slashingAmount,
      evidenceHash,
      breached
    } = event.params;

    const settlementId = `${contractId}-${epochId}`;

    // 1. Record EpochSettlement
    context.EpochSettlement.set({
      id: settlementId,
      contract_id: contractId,
      epochId,
      p95LatencyMs,
      availabilityBps: BigInt(availabilityBps),
      deliveredUnits,
      rebateAmount,
      slashingAmount,
      evidenceHash,
      status: breached ? "BREACHED" : "COMPLIANT",
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      txHash: event.transaction.hash
    });

    // 2. Fetch contract for dynamic SLA breach classification
    const contract = await context.SLAContract.get(contractId);
    if (contract) {
      // Dynamic contract-specific breach type classification
      if (breached) {
        const latencyBreach = p95LatencyMs > contract.latencyThresholdMs;
        const availabilityBreach = BigInt(availabilityBps) < contract.availabilityThresholdBps;
        let breachType = "LATENCY_BREACH";
        if (latencyBreach && availabilityBreach) breachType = "BOTH";
        else if (availabilityBreach) breachType = "AVAILABILITY_BREACH";

        context.Incident.set({
          id: settlementId,
          contract_id: contractId,
          epochId,
          p95LatencyMs,
          availabilityBps: BigInt(availabilityBps),
          rebateAmount,
          slashingAmount,
          breachType,
          evidenceHash,
          timestamp: BigInt(event.block.timestamp),
          txHash: event.transaction.hash
        });
      }

      // 3. Update Contract cumulative metrics
      context.SLAContract.set({
        ...contract,
        settledEpochsCount: contract.settledEpochsCount + 1n,
        cumulativeRebates: contract.cumulativeRebates + rebateAmount,
        cumulativeSlashing: contract.cumulativeSlashing + slashingAmount
      });

      // 4. Update Provider reliability & slashing
      const provider = await context.Provider.get(contract.provider_id);
      if (provider) {
        let updatedProvider = { ...provider };
        if (breached) {
          updatedProvider.breachCount += 1n;
          updatedProvider.totalSlashed += slashingAmount;
        } else {
          updatedProvider.compliantEpochsCount += 1n;
        }
        context.Provider.set({
          ...updatedProvider,
          priScore: calculatePRI(updatedProvider)
        });
      }

      // 5. Update Buyer rebate received
      const buyer = await context.Buyer.get(contract.buyer_id);
      if (buyer) {
        context.Buyer.set({
          ...buyer,
          totalRebatesReceived: buyer.totalRebatesReceived + rebateAmount
        });
      }
    }

    // 6. Update System Metrics
    let metrics = await getOrCreateSystemMetrics(context);
    context.SystemMetrics.set({
      ...metrics,
      totalSettlementsCount: metrics.totalSettlementsCount + 1n,
      totalSettledRebates: metrics.totalSettledRebates + rebateAmount,
      totalSlashedBonds: metrics.totalSlashedBonds + slashingAmount
    });
  }
);

indexer.onEvent(
  { contract: "SettlementController", event: "ContractFlaggedForReview" },
  async ({ event, context }) => {
    const { contractId } = event.params;
    const contract = await context.SLAContract.get(contractId);
    if (contract) {
      context.SLAContract.set({
        ...contract,
        status: "REVIEW_REQUIRED"
      });
    }
  }
);

indexer.onEvent(
  { contract: "SettlementController", event: "ReviewedContractResolved" },
  async ({ event, context }) => {
    const { contractId } = event.params;
    const contract = await context.SLAContract.get(contractId);
    if (contract) {
      context.SLAContract.set({
        ...contract,
        status: "FINALIZED"
      });
    }
  }
);

// =========================================================================
// CollateralVault Handlers (Financial Ledger of Truth)
// =========================================================================

indexer.onEvent(
  { contract: "CollateralVault", event: "EpochSettlementProcessed" },
  async ({ event, context }) => {
    const { contractId, remainingEscrow, remainingBond } = event.params;
    const contract = await context.SLAContract.get(contractId);
    if (contract) {
      // Calculate delta to adjust protocol-wide active balances
      const escrowDelta = contract.currentRemainingEscrow - remainingEscrow;
      const bondDelta = contract.currentRemainingBond - remainingBond;

      // Update contract's remaining balances
      context.SLAContract.set({
        ...contract,
        currentRemainingEscrow: remainingEscrow,
        currentRemainingBond: remainingBond
      });

      // Update System Metrics:
      // Note: TVL does not decrease here because earned fees and rebates stay in the vault
      // until finalized disbursement. But active escrow and active bond adjust to current remaining balances.
      let metrics = await getOrCreateSystemMetrics(context);
      const newActiveEscrow = metrics.totalActiveEscrow > escrowDelta ? metrics.totalActiveEscrow - escrowDelta : 0n;
      const newActiveBond = metrics.totalActiveBond > bondDelta ? metrics.totalActiveBond - bondDelta : 0n;
      context.SystemMetrics.set({
        ...metrics,
        totalActiveEscrow: newActiveEscrow,
        totalActiveBond: newActiveBond,
        curBps: metrics.totalValueLocked > 0n ? (newActiveBond * 10000n) / metrics.totalValueLocked : 0n
      });
    }
  }
);

indexer.onEvent(
  { contract: "CollateralVault", event: "FundsFinalized" },
  async ({ event, context }) => {
    const { contractId, buyer, provider: providerAddr, totalToBuyer, totalToProvider } = event.params;
    const contract = await context.SLAContract.get(contractId);

    // 1. Update Provider totalEarned and unlock active bond
    const provider = await context.Provider.get(providerAddr);
    if (provider) {
      const remainingBondToUnlock = contract ? contract.currentRemainingBond : 0n;
      const updatedLockedBond = provider.totalBondStaked > remainingBondToUnlock
        ? provider.totalBondStaked - remainingBondToUnlock
        : 0n;
      context.Provider.set({
        ...provider,
        activeContracts: provider.activeContracts > 0n ? provider.activeContracts - 1n : 0n,
        totalBondStaked: updatedLockedBond,
        totalEarned: provider.totalEarned + totalToProvider
      });
    }

    // 2. Update Buyer active contracts
    const buyerEntity = await context.Buyer.get(buyer);
    if (buyerEntity) {
      context.Buyer.set({
        ...buyerEntity,
        activeContracts: buyerEntity.activeContracts > 0n ? buyerEntity.activeContracts - 1n : 0n
      });
    }

    // 3. Mark contract finalized with zero remaining balances
    if (contract) {
      context.SLAContract.set({
        ...contract,
        status: "FINALIZED",
        currentRemainingEscrow: 0n,
        currentRemainingBond: 0n
      });
    }

    // 4. Actual Custody Disbursement: Reduces TVL by the total disbursed funds
    let metrics = await getOrCreateSystemMetrics(context);
    const totalDisbursed = totalToBuyer + totalToProvider;
    const newTVL = metrics.totalValueLocked > totalDisbursed ? metrics.totalValueLocked - totalDisbursed : 0n;
    context.SystemMetrics.set({
      ...metrics,
      totalValueLocked: newTVL,
      curBps: newTVL > 0n ? (metrics.totalActiveBond * 10000n) / newTVL : 0n
    });
  }
);
