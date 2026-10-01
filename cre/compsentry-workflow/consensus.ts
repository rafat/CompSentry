import { ethers } from "ethers";

export interface ObserverTelemetry {
  contractId: string;
  observerId: string;
  p95LatencyMs: number;
  availabilityBps: number;
  sampleCount: number;
  successfulRequests: number;
  failedRequests: number;
  windowStart: number;
  windowEnd: number;
  timestamp: number;
}

export interface ContractSLATerms {
  contractId: string;
  totalEpochs: number;
  availabilityThresholdBps: number;
  latencyThresholdMs: number;
  epochPayoutCap: bigint;
  maxTotalPayout: bigint;
  providerBond: bigint;
  cumulativeRebates: bigint;
  cumulativeSlashing: bigint;
}

export interface ConsensusResult {
  quorumCount: number;
  medianLatencyMs: number;
  consensusAvailabilityBps: number;
  deliveredUnits: number;
  rebateAmount: bigint;
  slashingAmount: bigint;
  evidenceHash: string;
  status: number; // 0 = Compliant, 1 = Breached
  outliers: string[];
}

export function computeConsensus(
  telemetryList: ObserverTelemetry[],
  terms: ContractSLATerms,
  minQuorum: number = 2
): ConsensusResult {
  // 1. Quorum Check
  const validObservations = telemetryList.filter(
    (t) => t.sampleCount > 0 && t.p95LatencyMs >= 0 && t.availabilityBps >= 0
  );

  if (validObservations.length < minQuorum) {
    throw new Error(
      `Insufficient Quorum: received ${validObservations.length} valid observations, required ${minQuorum}`
    );
  }

  // 2. Median P95 Latency
  const sortedLatencies = [...validObservations.map((o) => o.p95LatencyMs)].sort(
    (a, b) => a - b
  );
  const mid = Math.floor(sortedLatencies.length / 2);
  const medianLatencyMs =
    sortedLatencies.length % 2 !== 0
      ? sortedLatencies[mid]
      : Math.round((sortedLatencies[mid - 1] + sortedLatencies[mid]) / 2);

  // 3. Consensus Availability (Average across valid observations)
  const totalAvailability = validObservations.reduce((acc, cur) => acc + cur.availabilityBps, 0);
  const consensusAvailabilityBps = Math.round(totalAvailability / validObservations.length);

  // 4. Delivered Units (Average sample count across observers)
  const totalDelivered = validObservations.reduce((acc, cur) => acc + cur.successfulRequests, 0);
  const deliveredUnits = Math.round(totalDelivered / validObservations.length);

  // 5. Outlier Detection (> 50% deviation from median latency)
  const outliers: string[] = [];
  for (const obs of validObservations) {
    if (Math.abs(obs.p95LatencyMs - medianLatencyMs) > medianLatencyMs * 0.5 && medianLatencyMs > 50) {
      outliers.push(obs.observerId);
    }
  }

  // 6. SLA Breach & Payout Policy Evaluation
  let status = 0; // 0: Compliant
  let rebateAmount = 0n;
  let slashingAmount = 0n;

  const isLatencyBreach = medianLatencyMs > terms.latencyThresholdMs;
  const isAvailabilityBreach = consensusAvailabilityBps < terms.availabilityThresholdBps;

  if (isLatencyBreach || isAvailabilityBreach) {
    status = 1; // Breached

    // Payout calculation
    let maxRebate = terms.epochPayoutCap;
    let computedRebate = 0n;

    if (isLatencyBreach) {
      // Linear penalty based on latency overshoot
      const excess = BigInt(medianLatencyMs - terms.latencyThresholdMs);
      const threshold = BigInt(terms.latencyThresholdMs);
      const latencyPenalty = (maxRebate * excess) / threshold;
      computedRebate += latencyPenalty;
    }

    if (isAvailabilityBreach) {
      // Proportional rebate for dropped requests
      const unavailableBps = BigInt(10000 - consensusAvailabilityBps);
      const availPenalty = (maxRebate * unavailableBps) / 1000n; // scaled
      computedRebate += availPenalty;

      // If availability is critically degraded (< 90%), slash provider bond
      if (consensusAvailabilityBps < 9000 && terms.totalEpochs > 0) {
        // Slash up to 10% of bond divided across epochs
        const epochBondShare = terms.providerBond / BigInt(terms.totalEpochs);
        slashingAmount = epochBondShare / 2n;
      }
    }

    if (computedRebate > maxRebate) {
      computedRebate = maxRebate;
    }

    // Apply cumulative rebate cap
    const remainingContractRebateBudget = terms.maxTotalPayout - terms.cumulativeRebates;
    if (computedRebate > remainingContractRebateBudget) {
      computedRebate = remainingContractRebateBudget;
    }
    rebateAmount = computedRebate;

    // Apply remaining provider bond cap
    const remainingBond = terms.providerBond - terms.cumulativeSlashing;
    if (slashingAmount > remainingBond) {
      slashingAmount = remainingBond;
    }
  }

  // 7. Canonical Evidence Hash
  const canonicalBytes = ethers.toUtf8Bytes(
    JSON.stringify({
      contractId: terms.contractId,
      quorumCount: validObservations.length,
      medianLatencyMs,
      consensusAvailabilityBps,
      observations: validObservations.map((o) => ({
        id: o.observerId,
        lat: o.p95LatencyMs,
        avail: o.availabilityBps,
        ts: o.timestamp
      }))
    })
  );
  const evidenceHash = ethers.keccak256(canonicalBytes);

  return {
    quorumCount: validObservations.length,
    medianLatencyMs,
    consensusAvailabilityBps,
    deliveredUnits,
    rebateAmount,
    slashingAmount,
    evidenceHash,
    status,
    outliers
  };
}
