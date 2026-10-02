import express from "express";
import cors from "cors";
import { getScenarioConfig } from "./scenario-engine/state";

export interface TelemetrySample {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  statusCode: number;
}

export function createObserverServer(
  observerId: string,
  port: number,
  probeIntervalMs: number = 1000
) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const samples: TelemetrySample[] = [];
  const evaluatorUrl = process.env.EVALUATOR_URL || "http://localhost:4000";

  // 1. High-frequency background probe loop (1-second intervals)
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

    // Retain samples for 10 minutes (600,000 ms) to support historical epoch window queries
    const cutoff = Date.now() - 600_000;
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift();
    }
  }, probeIntervalMs);

  // 2. Health & Diagnostic Endpoints
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      observerId,
      port,
      probeIntervalMs,
      totalBufferedSamples: samples.length,
      uptimeSeconds: Math.floor(process.uptime())
    });
  });

  app.get("/samples", (req, res) => {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    res.json({
      observerId,
      recentSamples: samples.slice(-limit)
    });
  });

  // 3. Epoch-Aware Telemetry Endpoint queried by Chainlink CRE
  app.get("/telemetry", (req, res) => {
    const contractId = (req.query.contractId as string) || "0xdefault";
    const epochId = req.query.epochId ? Number(req.query.epochId) : undefined;
    const now = Date.now();

    // Parse requested windowStart and windowEnd (supports unix seconds or ms)
    let windowStartMs: number;
    let windowEndMs: number;

    if (req.query.windowStart && req.query.windowEnd) {
      const rawStart = Number(req.query.windowStart);
      const rawEnd = Number(req.query.windowEnd);
      windowStartMs = rawStart < 1e11 ? rawStart * 1000 : rawStart;
      windowEndMs = rawEnd < 1e11 ? rawEnd * 1000 : rawEnd;
    } else {
      // Default fallback to past 30 seconds if unspecified
      windowEndMs = now;
      windowStartMs = now - 30_000;
    }

    // Strict time-window filtering: observations must strictly fall within requested window
    const epochSamples = samples.filter(
      (s) => s.timestamp >= windowStartMs && s.timestamp <= windowEndMs
    );

    const sampleCount = epochSamples.length;

    // Fail closed: Do NOT fabricate fallback telemetry if zero samples were collected
    if (sampleCount === 0) {
      return res.status(503).json({
        error: "NO_OBSERVATIONS_IN_WINDOW",
        message: "No probe observations were recorded in the requested epoch window",
        contractId,
        epochId,
        observerId,
        windowStart: Math.floor(windowStartMs / 1000),
        windowEnd: Math.floor(windowEndMs / 1000),
        sampleCount: 0
      });
    }

    const successfulRequests = epochSamples.filter((s) => s.success).length;
    const failedRequests = sampleCount - successfulRequests;

    // Calculate P95 latency accurately over all successful probes in this epoch
    const sortedLatencies = epochSamples
      .filter((s) => s.success)
      .map((s) => s.latencyMs)
      .sort((a, b) => a - b);

    let p95LatencyMs = 0;
    if (sortedLatencies.length > 0) {
      const p95Idx = Math.floor(sortedLatencies.length * 0.95);
      p95LatencyMs = sortedLatencies[Math.min(p95Idx, sortedLatencies.length - 1)];
    } else {
      // If 100% of probes failed, report max timeout latency
      p95LatencyMs = 2000;
    }

    let availabilityBps = Math.round((successfulRequests / sampleCount) * 10000);

    // Scenario Engine: check for synthetic divergence or desync
    const config = getScenarioConfig();
    let isSynthetic = false;
    let scenario = config.type;

    if (config.type === "SCENARIO_OBSERVER_DESYNC" && config.desyncObserverId === observerId) {
      p95LatencyMs = 480; // Synthetic divergent outlier
      availabilityBps = 8500;
      isSynthetic = true;
    }

    res.json({
      contractId,
      epochId,
      observerId,
      p95LatencyMs,
      availabilityBps,
      sampleCount,
      successfulRequests,
      failedRequests,
      windowStart: Math.floor(windowStartMs / 1000),
      windowEnd: Math.floor(windowEndMs / 1000),
      timestamp: Math.floor(now / 1000),
      isSynthetic,
      scenario
    });
  });

  return app;
}
