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
  isSynthetic?: boolean;
  scenario?: string;
}

export interface ConsensusResult {
  quorumCount: number;
  medianLatencyMs: number;
  consensusAvailabilityBps: number;
  deliveredUnits: number;
  evidenceHash: string;
  outliers: string[];
  canonicalEvidence: Record<string, any>;
}

/**
 * @notice Pure deterministic aggregation of observer telemetry.
 * @dev Computes median P95 latency, median availability, and commits to a canonical evidence hash.
 *      Contains ZERO financial logic (payouts and slashing are strictly calculated on-chain).
 */
export function computeConsensus(
  telemetryList: ObserverTelemetry[],
  epochMetadata: {
    contractId: string;
    epochId: number;
    windowStart: number;
    windowEnd: number;
  },
  minQuorum: number = 2
): ConsensusResult {
  // 1. Quorum Validation
  const validObservations = telemetryList.filter(
    (t) => t && t.sampleCount > 0 && t.p95LatencyMs >= 0 && t.availabilityBps >= 0
  );

  if (validObservations.length < minQuorum) {
    throw new Error(
      `Insufficient Quorum: received ${validObservations.length} valid observations, required minimum ${minQuorum}`
    );
  }

  // 2. Median P95 Latency Aggregation
  const sortedLatencies = [...validObservations.map((o) => o.p95LatencyMs)].sort(
    (a, b) => a - b
  );
  const midLat = Math.floor(sortedLatencies.length / 2);
  const medianLatencyMs = sortedLatencies[midLat];

  // 3. Median Availability Aggregation (Resistant to single-observer divergence)
  const sortedAvailabilities = [...validObservations.map((o) => o.availabilityBps)].sort(
    (a, b) => a - b
  );
  const midAvail = Math.floor(sortedAvailabilities.length / 2);
  const consensusAvailabilityBps = sortedAvailabilities[midAvail];

  // 4. Delivered Units (Median of successful delivered requests across observers)
  const sortedDelivered = [...validObservations.map((o) => o.successfulRequests)].sort(
    (a, b) => a - b
  );
  const midDelivered = Math.floor(sortedDelivered.length / 2);
  const deliveredUnits = sortedDelivered[midDelivered];

  // 5. Outlier Detection (> 50% deviation from median latency)
  const outliers: string[] = [];
  for (const obs of validObservations) {
    if (Math.abs(obs.p95LatencyMs - medianLatencyMs) > medianLatencyMs * 0.5 && medianLatencyMs > 50) {
      outliers.push(obs.observerId);
    }
  }

  // 6. Canonical Evidence Package & Cryptographic Commitment
  const canonicalEvidence = {
    contractId: epochMetadata.contractId,
    epochId: epochMetadata.epochId,
    windowStart: epochMetadata.windowStart,
    windowEnd: epochMetadata.windowEnd,
    observations: validObservations.map((o) => ({
      observerId: o.observerId,
      sampleCount: o.sampleCount,
      successfulRequests: o.successfulRequests,
      failedRequests: o.failedRequests,
      p95LatencyMs: o.p95LatencyMs,
      availabilityBps: o.availabilityBps,
      timestamp: o.timestamp,
      isSynthetic: !!o.isSynthetic
    })),
    consensus: {
      quorumCount: validObservations.length,
      medianLatencyMs,
      consensusAvailabilityBps,
      deliveredUnits,
      outliers
    }
  };

  const canonicalJsonString = JSON.stringify(canonicalEvidence);
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJsonString));

  return {
    quorumCount: validObservations.length,
    medianLatencyMs,
    consensusAvailabilityBps,
    deliveredUnits,
    evidenceHash,
    outliers,
    canonicalEvidence
  };
}
