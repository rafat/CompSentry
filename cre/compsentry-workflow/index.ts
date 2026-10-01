import { computeConsensus, type ObserverTelemetry } from "./consensus.js";
import { configSchema } from "./config.js";
import rawConfig from "./config.json" with { type: "json" };

async function runLocalSimulation() {
  console.log("=== CompSentry CRE Workflow Local Simulation ===");

  const config = configSchema.parse(rawConfig);

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 30;
  const windowEnd = now;

  console.log(`Contract: ${config.contractId}`);
  console.log(`Epoch Window: ${windowStart} -> ${windowEnd} (30s duration)`);
  console.log(`Polling Observers: ${config.observers.join(", ")}`);

  const rawObservations: ObserverTelemetry[] = [];

  for (const observerBaseUrl of config.observers) {
    const url = `${observerBaseUrl}?contractId=${config.contractId}&windowStart=${windowStart}&windowEnd=${windowEnd}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const telemetry = (await resp.json()) as ObserverTelemetry;
        rawObservations.push(telemetry);
        console.log(
          `[Observer ${telemetry.observerId}] Latency: ${telemetry.p95LatencyMs}ms, Avail: ${
            telemetry.availabilityBps / 100
          }%, Samples: ${telemetry.sampleCount}`
        );
      } else {
        console.warn(`[Observer ${observerBaseUrl}] HTTP ${resp.status}`);
      }
    } catch (err: any) {
      console.warn(`[Observer ${observerBaseUrl}] Offline / Unreachable: ${err.message}`);
    }
  }

  if (rawObservations.length < config.minObserverQuorum) {
    console.error(
      `[CRE Consensus] FAILED: Quorum not met (${rawObservations.length}/${config.minObserverQuorum})`
    );
    return;
  }

  const consensus = computeConsensus(
    rawObservations,
    {
      contractId: config.contractId,
      epochId: 1,
      windowStart,
      windowEnd
    },
    config.minObserverQuorum
  );

  console.log("\n--- CRE Consensus Reached ---");
  console.log(`Quorum: ${consensus.quorumCount}/${config.observers.length}`);
  console.log(`Median P95 Latency: ${consensus.medianLatencyMs}ms`);
  console.log(`Consensus Availability: ${consensus.consensusAvailabilityBps / 100}%`);
  console.log(`Delivered Units: ${consensus.deliveredUnits}`);
  console.log(`Evidence Hash: ${consensus.evidenceHash}`);
  if (consensus.outliers.length > 0) {
    console.log(`Neutralized Outliers: ${consensus.outliers.join(", ")}`);
  }

  console.log("\n--- Objective SLAReport Generated for Monad SettlementController ---");
  const slaReport = {
    contractId: config.contractId,
    epochId: 1,
    p95LatencyMs: consensus.medianLatencyMs,
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: consensus.deliveredUnits,
    evidenceHash: consensus.evidenceHash,
    timestamp: windowEnd,
    observerQuorum: consensus.quorumCount
  };
  console.log(JSON.stringify(slaReport, null, 2));
}

runLocalSimulation().catch(console.error);
