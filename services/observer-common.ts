import express from "express";
import cors from "cors";
import { getScenarioConfig } from "./scenario-engine/state";

export interface TelemetrySample {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  statusCode: number;
}

export function createObserverServer(observerId: string, port: number, probeIntervalMs: number = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const samples: TelemetrySample[] = [];
  const evaluatorUrl = process.env.EVALUATOR_URL || "http://localhost:4000";

  // Background probe loop
  setInterval(async () => {
    const start = Date.now();
    try {
      const resp = await fetch(`${evaluatorUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/Llama-3-70b-instruct",
          messages: [{ role: "user", content: "ping" }]
        })
      });

      const latencyMs = Date.now() - start;
      const success = resp.status === 200;

      samples.push({
        timestamp: Date.now(),
        latencyMs,
        success,
        statusCode: resp.status
      });
    } catch (err) {
      samples.push({
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        success: false,
        statusCode: 504
      });
    }

    // Retain only samples from last 2 minutes
    const cutoff = Date.now() - 120_000;
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift();
    }
  }, probeIntervalMs);

  // Endpoint queried by Chainlink CRE
  app.get("/telemetry", (req, res) => {
    const contractId = (req.query.contractId as string) || "0xdefault";
    const now = Date.now();
    const windowStart = now - 15_000; // last 15 seconds

    const recentSamples = samples.filter((s) => s.timestamp >= windowStart);

    let sampleCount = recentSamples.length;
    let successfulRequests = recentSamples.filter((s) => s.success).length;
    let failedRequests = sampleCount - successfulRequests;

    // Fallback if probe hasn't collected enough samples yet
    if (sampleCount === 0) {
      const config = getScenarioConfig();
      const mockSuccess = config.failureRateBps === 0;
      return res.json({
        contractId,
        observerId,
        p95LatencyMs: config.baseLatencyMs,
        availabilityBps: mockSuccess ? 10000 : 7000,
        sampleCount: 3,
        successfulRequests: mockSuccess ? 3 : 2,
        failedRequests: mockSuccess ? 0 : 1,
        windowStart: Math.floor(windowStart / 1000),
        windowEnd: Math.floor(now / 1000),
        timestamp: Math.floor(now / 1000)
      });
    }

    // Calculate P95 latency
    const sortedLatencies = recentSamples
      .filter((s) => s.success)
      .map((s) => s.latencyMs)
      .sort((a, b) => a - b);

    let p95Latency = 0;
    if (sortedLatencies.length > 0) {
      const p95Idx = Math.floor(sortedLatencies.length * 0.95);
      p95Latency = sortedLatencies[Math.min(p95Idx, sortedLatencies.length - 1)];
    }

    let availabilityBps = Math.round((successfulRequests / sampleCount) * 10000);

    // Check if this observer is configured to desync in the scenario
    const config = getScenarioConfig();
    if (config.type === "SCENARIO_OBSERVER_DESYNC" && config.desyncObserverId === observerId) {
      p95Latency = 480; // Outlier reporting high latency
      availabilityBps = 8500;
    }

    res.json({
      contractId,
      observerId,
      p95LatencyMs: p95Latency,
      availabilityBps,
      sampleCount,
      successfulRequests,
      failedRequests,
      windowStart: Math.floor(windowStart / 1000),
      windowEnd: Math.floor(now / 1000),
      timestamp: Math.floor(now / 1000)
    });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", observerId, port });
  });

  return app;
}
