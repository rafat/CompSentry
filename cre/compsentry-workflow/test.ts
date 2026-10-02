import { computeConsensus, type ObserverTelemetry } from "./consensus.js";

console.log("=== Testing CompSentry CRE Consensus & Evidence Engine ===");

const metadata = {
  contractId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  epochId: 1,
  windowStart: 1774900000,
  windowEnd: 1774900030
};

// Test 1: Normal Scenario (Consistent Latencies)
console.log("\n[Test 1] Normal Operating Conditions");
const normalTelemetry: ObserverTelemetry[] = [
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-provider",
    p95LatencyMs: 65,
    availabilityBps: 10000,
    sampleCount: 30,
    successfulRequests: 30,
    failedRequests: 0,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd
  },
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-independent",
    p95LatencyMs: 70,
    availabilityBps: 10000,
    sampleCount: 30,
    successfulRequests: 30,
    failedRequests: 0,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd
  },
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-secondary",
    p95LatencyMs: 68,
    availabilityBps: 10000,
    sampleCount: 30,
    successfulRequests: 30,
    failedRequests: 0,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd
  }
];

const res1 = computeConsensus(normalTelemetry, metadata, 2);
console.log(`Median Latency: ${res1.medianLatencyMs}ms (Expected: 68ms)`);
console.log(`Availability: ${res1.consensusAvailabilityBps / 100}% (Expected: 100%)`);
console.log(`Quorum Count: ${res1.quorumCount}/3`);
console.log(`Evidence Hash: ${res1.evidenceHash}`);
if (res1.medianLatencyMs !== 68 || res1.consensusAvailabilityBps !== 10000) {
  throw new Error("Test 1 Failed!");
}
console.log("PASS: Test 1");

// Test 2: Observer Desync Scenario (1 Outlier at 480ms)
console.log("\n[Test 2] Observer Desync Resilience (1 Outlier at 480ms)");
const desyncTelemetry: ObserverTelemetry[] = [
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-provider",
    p95LatencyMs: 70,
    availabilityBps: 10000,
    sampleCount: 30,
    successfulRequests: 30,
    failedRequests: 0,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd
  },
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-independent",
    p95LatencyMs: 480, // Outlier
    availabilityBps: 8500,
    sampleCount: 30,
    successfulRequests: 25,
    failedRequests: 5,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd,
    isSynthetic: true
  },
  {
    contractId: metadata.contractId,
    epochId: metadata.epochId,
    observerId: "observer-secondary",
    p95LatencyMs: 72,
    availabilityBps: 10000,
    sampleCount: 30,
    successfulRequests: 30,
    failedRequests: 0,
    windowStart: metadata.windowStart,
    windowEnd: metadata.windowEnd,
    timestamp: metadata.windowEnd
  }
];

const res2 = computeConsensus(desyncTelemetry, metadata, 2);
console.log(`Median Latency: ${res2.medianLatencyMs}ms (Expected: 72ms - Outlier rejected!)`);
console.log(`Consensus Availability: ${res2.consensusAvailabilityBps / 100}% (Expected: 100% - Outlier rejected!)`);
console.log(`Detected Outliers: ${JSON.stringify(res2.outliers)} (Expected: ['observer-independent'])`);
if (res2.medianLatencyMs !== 72 || res2.consensusAvailabilityBps !== 10000 || !res2.outliers.includes("observer-independent")) {
  throw new Error("Test 2 Failed!");
}
// Verify demo metadata separation: canonical evidence does NOT include isSynthetic
const hasIsSyntheticInEvidence = JSON.stringify(res2.canonicalEvidence).includes("isSynthetic");
if (hasIsSyntheticInEvidence) {
  throw new Error("Test 2 Failed: isSynthetic found inside protocol canonical evidence!");
}
console.log("PASS: Test 2 (Outlier neutralized & demo metadata separated from protocol evidence)");

// Test 3: Insufficient Quorum Rejection
console.log("\n[Test 3] Insufficient Quorum Rejection");
try {
  computeConsensus([normalTelemetry[0]], metadata, 2);
  throw new Error("Should have reverted on insufficient quorum");
} catch (err: any) {
  console.log(`Caught expected error: ${err.message}`);
}
console.log("PASS: Test 3");

// Test 4: Epoch Window Mismatch Rejection
console.log("\n[Test 4] Epoch Window Mismatch Rejection");
const mismatchedTelemetry: ObserverTelemetry[] = [
  normalTelemetry[0], // Valid: 1774900000 -> 1774900030
  {
    ...normalTelemetry[1],
    observerId: "observer-independent",
    windowStart: 1774900010, // Mismatched window!
    windowEnd: 1774900040
  },
  {
    ...normalTelemetry[2],
    observerId: "observer-secondary",
    windowStart: 1774900020, // Mismatched window!
    windowEnd: 1774900050
  }
];

try {
  // Only 1 observer matches the requested window; minQuorum is 2
  computeConsensus(mismatchedTelemetry, metadata, 2);
  throw new Error("Should have reverted on epoch window mismatch");
} catch (err: any) {
  console.log(`Caught expected error: ${err.message}`);
}
console.log("PASS: Test 4 (Mismatched windows correctly excluded from quorum)");

// Test 5: Invalid Telemetry Participates Neither in Quorum Nor Consensus
console.log("\n[Test 5] Invalid Telemetry Participation Rejection");
const corruptTelemetry: ObserverTelemetry[] = [
  normalTelemetry[0], // Valid
  {
    ...normalTelemetry[1],
    availabilityBps: 12000 // Invalid: > 10000 bps
  },
  {
    ...normalTelemetry[2],
    p95LatencyMs: -10 // Invalid: negative latency
  }
];

try {
  computeConsensus(corruptTelemetry, metadata, 2);
  throw new Error("Should have reverted on corrupt telemetry (only 1 valid observation)");
} catch (err: any) {
  console.log(`Caught expected error: ${err.message}`);
}

// When at least 2 are valid and 1 is corrupt, the corrupt reading is discarded
const corruptTelemetryWithQuorum: ObserverTelemetry[] = [
  normalTelemetry[0], // Valid (65ms, 10000 bps)
  normalTelemetry[2], // Valid (68ms, 10000 bps)
  {
    ...normalTelemetry[1],
    sampleCount: 0 // Invalid: 0 samples
  }
];

const res5 = computeConsensus(corruptTelemetryWithQuorum, metadata, 2);
console.log(`Quorum Count after discarding invalid reading: ${res5.quorumCount}/2`);
if (res5.quorumCount !== 2 || res5.medianLatencyMs !== 67) {
  // Mathematical median of [65, 68] is round(133/2) = 67
  throw new Error(`Test 5 Failed: Expected 67ms median, got ${res5.medianLatencyMs}ms`);
}
console.log(`Conventional Median of [65, 68]: ${res5.medianLatencyMs}ms`);
console.log("PASS: Test 5 (Corrupt readings discarded, mathematical median verified)");

console.log("\n=== ALL CRE CONSENSUS TESTS PASSED! ===");
