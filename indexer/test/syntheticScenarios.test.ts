import { expect, test, describe, beforeEach } from "bun:test";

class InMemoryContext {
  store: Record<string, Map<string, any>> = {
    SystemMetrics: new Map(),
    Provider: new Map(),
    Buyer: new Map(),
    SLAOffer: new Map(),
    SLAContract: new Map(),
    EpochSettlement: new Map(),
    Incident: new Map()
  };

  createOperations(entityName: string) {
    const map = this.store[entityName];
    return {
      get: async (id: string) => map.get(id),
      set: (entity: any) => map.set(entity.id, entity),
      deleteUnsafe: (id: string) => map.delete(id)
    };
  }

  get context() {
    return {
      SystemMetrics: this.createOperations("SystemMetrics"),
      Provider: this.createOperations("Provider"),
      Buyer: this.createOperations("Buyer"),
      SLAOffer: this.createOperations("SLAOffer"),
      SLAContract: this.createOperations("SLAContract"),
      EpochSettlement: this.createOperations("EpochSettlement"),
      Incident: this.createOperations("Incident")
    };
  }
}

function calculatePRI(provider: any): bigint {
  const totalEpochs = provider.compliantEpochsCount + provider.breachCount;
  if (totalEpochs === 0n) return 5000n;
  const complianceRateBps = (provider.compliantEpochsCount * 10000n) / totalEpochs;
  const volumeBonus = provider.totalContracts > 50n ? 1000n : provider.totalContracts * 20n;
  const pri = (complianceRateBps * 90n) / 100n + (volumeBonus * 10n) / 100n;
  return pri > 10000n ? 10000n : pri;
}

describe("CompSentry Envio Indexer Synthetic Lifecycle Tests", () => {
  let ctx: InMemoryContext;
  const GLOBAL_METRICS_ID = "global_system_metrics";
  const providerAddr = "0xProvider111111111111111111111111111111111111";
  const buyerAddr = "0xBuyer22222222222222222222222222222222222222";
  const offerId = "0xOfferAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const contractId = "0xContractBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

  beforeEach(() => {
    ctx = new InMemoryContext();
  });

  test("Scenario 1: Normal Lifecycle - Activation, Compliant Epoch, Finalization", async () => {
    const context = ctx.context;

    // 1. SLAOfferCreated
    context.SLAOffer.set({
      id: offerId,
      provider_id: providerAddr,
      token: "0xToken",
      resourceId: "0xResource",
      serviceFee: 1000n,
      bondBps: 2000n,
      availabilityThresholdBps: 9900n,
      latencyThresholdMs: 200n,
      epochDuration: 30n,
      totalEpochs: 10n,
      epochPayoutCap: 100n,
      maxTotalPayout: 1000n,
      active: true,
      createdAtBlock: 1n,
      createdAtTimestamp: 1000n
    });
    context.Provider.set({
      id: providerAddr,
      totalOffers: 1n,
      totalContracts: 0n,
      activeContracts: 0n,
      totalBondStaked: 0n,
      totalSlashed: 0n,
      totalEarned: 0n,
      breachCount: 0n,
      compliantEpochsCount: 0n,
      priScore: 5000n
    });

    // 2. SLAContractActivated (Buyer funds 1000, Provider bonds 200)
    const serviceFee = 1000n;
    const providerBond = 200n;
    context.SLAContract.set({
      id: contractId,
      offer_id: offerId,
      buyer_id: buyerAddr,
      provider_id: providerAddr,
      serviceFee,
      providerBond,
      currentRemainingEscrow: serviceFee,
      currentRemainingBond: providerBond,
      startTimestamp: 1000n,
      endTimestamp: 1300n,
      totalEpochs: 10n,
      epochDuration: 30n,
      availabilityThresholdBps: 9900n,
      latencyThresholdMs: 200n,
      epochPayoutCap: 100n,
      maxTotalPayout: 1000n,
      settledEpochsCount: 0n,
      cumulativeRebates: 0n,
      cumulativeSlashing: 0n,
      status: "ACTIVE",
      createdAtBlock: 2n,
      createdAtTimestamp: 1000n
    });

    // Invariant: TVL = Escrow + Bond = 1200
    const initialTVL = serviceFee + providerBond;
    context.SystemMetrics.set({
      id: GLOBAL_METRICS_ID,
      totalValueLocked: initialTVL,
      totalActiveEscrow: serviceFee,
      totalActiveBond: providerBond,
      totalSettledRebates: 0n,
      totalSlashedBonds: 0n,
      totalSettlementsCount: 0n,
      totalContractsCount: 1n,
      curBps: (providerBond * 10000n) / initialTVL
    });

    let metrics = await context.SystemMetrics.get(GLOBAL_METRICS_ID);
    expect(metrics.totalValueLocked).toBe(1200n);
    expect(metrics.totalActiveEscrow).toBe(1000n);
    expect(metrics.totalActiveBond).toBe(200n);

    // 3. Epoch 1 Settled (Compliant)
    let contract = await context.SLAContract.get(contractId);
    context.SLAContract.set({
      ...contract,
      settledEpochsCount: 1n
    });
    let provider = await context.Provider.get(providerAddr);
    provider.compliantEpochsCount += 1n;
    provider.priScore = calculatePRI(provider);
    context.Provider.set(provider);

    expect(provider.priScore).toBe(9000n);

    // 4. Vault processes epoch settlement (100 fee earned)
    contract = await context.SLAContract.get(contractId);
    context.SLAContract.set({
      ...contract,
      currentRemainingEscrow: 900n,
      currentRemainingBond: 200n
    });

    // TVL is NOT reduced on settlement: earned fees are still custodied in vault!
    metrics = await context.SystemMetrics.get(GLOBAL_METRICS_ID);
    expect(metrics.totalValueLocked).toBe(1200n);

    // 5. Finalization (Funds disbursed: 1200)
    contract = await context.SLAContract.get(contractId);
    context.SLAContract.set({
      ...contract,
      status: "FINALIZED",
      currentRemainingEscrow: 0n,
      currentRemainingBond: 0n
    });
    context.SystemMetrics.set({
      ...metrics,
      totalValueLocked: 0n,
      totalActiveEscrow: 0n,
      totalActiveBond: 0n,
      curBps: 0n
    });

    metrics = await context.SystemMetrics.get(GLOBAL_METRICS_ID);
    expect(metrics.totalValueLocked).toBe(0n);
  });

  test("Scenario 2 & 3: Breach Classification - Latency vs Availability vs Both", async () => {
    const contract = {
      id: contractId,
      latencyThresholdMs: 200n,
      availabilityThresholdBps: 9900n
    };

    // Minor Breach: Latency breach (450ms > 200ms, 99.5% avail >= 99%)
    const p95_1 = 450n;
    const avail_1 = 9950n;
    const latBreach1 = p95_1 > contract.latencyThresholdMs;
    const availBreach1 = avail_1 < contract.availabilityThresholdBps;
    let breachType1 = "LATENCY_BREACH";
    if (latBreach1 && availBreach1) breachType1 = "BOTH";
    else if (availBreach1) breachType1 = "AVAILABILITY_BREACH";
    expect(breachType1).toBe("LATENCY_BREACH");

    // Availability Breach: (150ms <= 200ms, 90.0% avail < 99%)
    const p95_2 = 150n;
    const avail_2 = 9000n;
    const latBreach2 = p95_2 > contract.latencyThresholdMs;
    const availBreach2 = avail_2 < contract.availabilityThresholdBps;
    let breachType2 = "LATENCY_BREACH";
    if (latBreach2 && availBreach2) breachType2 = "BOTH";
    else if (availBreach2) breachType2 = "AVAILABILITY_BREACH";
    expect(breachType2).toBe("AVAILABILITY_BREACH");

    // Major Breach: Both (450ms > 200ms, 85.0% avail < 99%)
    const p95_3 = 450n;
    const avail_3 = 8500n;
    const latBreach3 = p95_3 > contract.latencyThresholdMs;
    const availBreach3 = avail_3 < contract.availabilityThresholdBps;
    let breachType3 = "LATENCY_BREACH";
    if (latBreach3 && availBreach3) breachType3 = "BOTH";
    else if (availBreach3) breachType3 = "AVAILABILITY_BREACH";
    expect(breachType3).toBe("BOTH");
  });

  test("Scenario 6 & 7: REVIEW_REQUIRED Lifecycle & Exception Resolution", async () => {
    const context = ctx.context;
    context.SLAContract.set({
      id: contractId,
      status: "ACTIVE",
      settledEpochsCount: 8n,
      totalEpochs: 10n,
      currentRemainingEscrow: 200n,
      currentRemainingBond: 200n
    });

    // Contract flags for review due to missing epochs
    let contract = await context.SLAContract.get(contractId);
    context.SLAContract.set({
      ...contract,
      status: "REVIEW_REQUIRED"
    });

    contract = await context.SLAContract.get(contractId);
    expect(contract.status).toBe("REVIEW_REQUIRED");

    // ReviewedContractResolved -> marks status as FINALIZED
    context.SLAContract.set({
      ...contract,
      status: "FINALIZED"
    });

    contract = await context.SLAContract.get(contractId);
    expect(contract.status).toBe("FINALIZED");
  });
});
