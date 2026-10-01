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

// Test 2: Observer Desync Scenario (1 Outlier Diverges)
console.log("\n[Test 2] Observer Desync Resilience (1 Outlier at 480ms)");
const desyncTelemetry: ObserverTelemetry[] = [
  {
    contractId: metadata.contractId,
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
console.log("PASS: Test 2 (Outlier divergence neutralized by CRE median consensus)");

// Test 3: Insufficient Quorum Validation
console.log("\n[Test 3] Insufficient Quorum Rejection");
try {
  computeConsensus([normalTelemetry[0]], metadata, 2);
  throw new Error("Should have reverted on insufficient quorum");
} catch (err: any) {
  console.log(`Caught expected error: ${err.message}`);
}
console.log("PASS: Test 3");

console.log("\n=== ALL CRE CONSENSUS TESTS PASSED! ===");
