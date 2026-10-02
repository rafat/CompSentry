import { ethers } from "ethers";

export interface ObserverTelemetry {
  contractId: string;
  epochId?: number;
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
  demoMetadata?: {
    outlierScenarios: Record<string, string>;
    syntheticObservers: string[];
  };
}

/**
 * @notice Computes conventional mathematical median for an array of numbers.
 * @dev For odd lengths, takes the middle element.
 *      For even lengths, takes the average of the two middle elements rounded to nearest integer.
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * @notice Pure deterministic aggregation of observer telemetry.
 * @dev Computes median P95 latency, median availability, and commits to a canonical evidence hash.
 *      Enforces strict window verification and field validity.
 *      Separates protocol evidence from offchain demo annotations (isSynthetic).
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
  // 1. Quorum & Telemetry Validity Filtering:
  // Reject observations that:
  // - Have zero samples (no telemetry recorded)
  // - Have negative latency or invalid availability (> 10000 bps or < 0)
  // - Suffer from window mismatch (mismatched epoch boundary)
  const validObservations = telemetryList.filter((t) => {
    if (!t) return false;
    if (typeof t.sampleCount !== "number" || t.sampleCount <= 0) return false;
    if (typeof t.p95LatencyMs !== "number" || t.p95LatencyMs < 0) return false;
    if (typeof t.availabilityBps !== "number" || t.availabilityBps < 0 || t.availabilityBps > 10000) return false;

    // Strict epoch window matching (allow max 1s clock tolerance)
    const windowStartDiff = Math.abs(t.windowStart - epochMetadata.windowStart);
    const windowEndDiff = Math.abs(t.windowEnd - epochMetadata.windowEnd);
    if (windowStartDiff > 1 || windowEndDiff > 1) {
      return false;
    }

    return true;
  });

  if (validObservations.length < minQuorum) {
    throw new Error(
      `Insufficient Quorum: received ${validObservations.length} valid observations, required minimum ${minQuorum}`
    );
  }

  // 2. Median P95 Latency Aggregation (Conventional Median)
  const medianLatencyMs = calculateMedian(validObservations.map((o) => o.p95LatencyMs));

  // 3. Median Availability Aggregation (Resistant to single-observer divergence)
  const consensusAvailabilityBps = calculateMedian(validObservations.map((o) => o.availabilityBps));

  // 4. Delivered Units (Median of successful delivered requests across observers)
  const deliveredUnits = calculateMedian(validObservations.map((o) => o.successfulRequests));

  // 5. Outlier Detection:
  // Flag any observer whose latency deviates by > 50% or > 50ms absolute floor
  const outliers: string[] = [];
  for (const obs of validObservations) {
    const deviation = Math.abs(obs.p95LatencyMs - medianLatencyMs);
    if (deviation > Math.max(50, medianLatencyMs * 0.5)) {
      outliers.push(obs.observerId);
    }
  }

  // 6. Protocol Evidence Package: Strictly commits to measurement observations,
  // NOT demo annotations like isSynthetic or scenario names.
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
      windowStart: o.windowStart,
      windowEnd: o.windowEnd,
      timestamp: o.timestamp
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

  // 7. Demo Metadata (separated from protocol evidence)
  const syntheticObservers = validObservations
    .filter((o) => o.isSynthetic)
    .map((o) => o.observerId);
  const outlierScenarios: Record<string, string> = {};
  for (const o of validObservations) {
    if (o.scenario) {
      outlierScenarios[o.observerId] = o.scenario;
    }
  }

  return {
    quorumCount: validObservations.length,
    medianLatencyMs,
    consensusAvailabilityBps,
    deliveredUnits,
    evidenceHash,
    outliers,
    canonicalEvidence,
    demoMetadata: {
      syntheticObservers,
      outlierScenarios
    }
  };
}
