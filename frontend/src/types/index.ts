export type ContractStatus = "ACTIVE" | "REVIEW_REQUIRED" | "FINALIZED";
export type EpochStatus = "COMPLIANT" | "BREACHED";
export type BreachType = "NONE" | "LATENCY_BREACH" | "AVAILABILITY_BREACH" | "BOTH";

export interface SystemMetrics {
  id: string;
  totalValueLocked: string;
  totalActiveEscrow: string;
  totalActiveBond: string;
  totalSettledRebates: string;
  totalSlashedBonds: string;
  totalSettlementsCount: string;
  totalContractsCount: string;
  curBps: string;
}

export interface Provider {
  id: string;
  totalOffers: string;
  totalContracts: string;
  activeContracts: string;
  totalBondStaked: string;
  totalSlashed: string;
  totalEarned: string;
  breachCount: string;
  compliantEpochsCount: string;
  priScore: string; // 0 - 10000 bps
}

export interface Buyer {
  id: string;
  totalContracts: string;
  activeContracts: string;
  totalEscrowFunded: string;
  totalRebatesReceived: string;
}

export interface SLAOffer {
  id: string;
  provider: Provider;
  token: string;
  resourceId: string;
  serviceFee: string;
  bondBps: string;
  availabilityThresholdBps: string;
  latencyThresholdMs: string;
  epochDuration: string;
  totalEpochs: string;
  epochPayoutCap: string;
  maxTotalPayout: string;
  active: boolean;
  createdAtBlock: string;
  createdAtTimestamp: string;
}

export interface SLAContract {
  id: string;
  offer: SLAOffer;
  buyer: Buyer;
  provider: Provider;

  serviceFee: string;
  providerBond: string;

  currentRemainingEscrow: string;
  currentRemainingBond: string;

  startTimestamp: string;
  endTimestamp: string;

  totalEpochs: string;
  epochDuration: string;

  availabilityThresholdBps: string;
  latencyThresholdMs: string;
  epochPayoutCap: string;
  maxTotalPayout: string;

  settledEpochsCount: string;
  cumulativeRebates: string;
  cumulativeSlashing: string;

  status: ContractStatus;

  createdAtBlock: string;
  createdAtTimestamp: string;
}

export interface EpochSettlement {
  id: string;
  contract: {
    id: string;
  };
  epochId: string;
  p95LatencyMs: string;
  availabilityBps: string;
  deliveredUnits: string;
  rebateAmount: string;
  slashingAmount: string;
  evidenceHash: string;
  status: EpochStatus;
  blockNumber: string;
  blockTimestamp: string;
  txHash: string;
}

export interface Incident {
  id: string;
  contract: {
    id: string;
  };
  epochId: string;
  p95LatencyMs: string;
  availabilityBps: string;
  rebateAmount: string;
  slashingAmount: string;
  breachType: BreachType;
  evidenceHash: string;
  timestamp: string;
  txHash: string;
}

export interface ObserverTelemetry {
  observerId: string;
  p95LatencyMs: number;
  availabilityBps: number;
  sampleCount: number;
  successfulRequests: number;
  failedRequests: number;
  windowStart: number;
  windowEnd: number;
  timestamp: number;
  scenario?: string;
}
