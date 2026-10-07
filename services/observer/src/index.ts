import express, { Request, Response } from "express";
import cors from "cors";

const app = express();

const OBSERVER_ID = process.env.OBSERVER_ID || "observer-1";
const PROVIDER_URL = (process.env.PROVIDER_URL || "http://localhost:8080").replace(/\/+$/, "");
const PORT = process.env.PORT || 8080;
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || "5", 10);
let desyncLatencyOffsetMs = parseInt(process.env.DESYNC_LATENCY_OFFSET_MS || "0", 10);

app.use(cors({ origin: "*" }));
app.use(express.json());

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

// 1. Health endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    observerId: OBSERVER_ID,
    providerUrl: PROVIDER_URL,
    desyncOffsetMs: desyncLatencyOffsetMs,
    sampleSize: SAMPLE_SIZE,
    timestamp: Date.now(),
  });
});

// Single probe execution to the compute provider
async function probeProvider(): Promise<{ success: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s network timeout

    const resp = await fetch(`${PROVIDER_URL}/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "vllm-llama-3-70b",
        messages: [{ role: "user", content: "CompSentry SLA Probe" }],
        max_tokens: 16,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const isSuccess = resp.status >= 200 && resp.status < 400;
    let latencyMs = Math.round(performance.now() - start);

    if (isSuccess) {
      try {
        const body: any = await resp.json();
        if (typeof body?.simulatedLatencyMs === "number") {
          latencyMs = body.simulatedLatencyMs;
        }
      } catch {
        // Fall back to wall-clock elapsed time
      }
    }

    return {
      success: isSuccess,
      latencyMs,
    };
  } catch (_err) {
    const elapsed = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs: elapsed,
    };
  }
}

// Perform concurrent burst measurements
async function performMeasurementBurst(
  contractId: string,
  windowStart: number,
  windowEnd: number
): Promise<ObserverTelemetry> {
  const probePromises = Array.from({ length: SAMPLE_SIZE }, () => probeProvider());
  const results = await Promise.allSettled(probePromises);

  const successfulLatencies: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        successfulRequests++;
        successfulLatencies.push(result.value.latencyMs);
      } else {
        failedRequests++;
      }
    } else {
      failedRequests++;
    }
  }

  const sampleCount = SAMPLE_SIZE;
  const availabilityBps = Math.round((successfulRequests / sampleCount) * 10000);

  // Compute P95 latency among successful requests
  let p95LatencyMs = 0;
  if (successfulLatencies.length > 0) {
    successfulLatencies.sort((a, b) => a - b);
    const p95Index = Math.min(
      successfulLatencies.length - 1,
      Math.floor(successfulLatencies.length * 0.95)
    );
    p95LatencyMs = successfulLatencies[p95Index] + desyncLatencyOffsetMs;
  } else {
    // If 100% outage, register timeout/outage indicator
    p95LatencyMs = 9999;
  }

  return {
    contractId,
    observerId: OBSERVER_ID,
    p95LatencyMs: Math.max(1, p95LatencyMs),
    availabilityBps,
    sampleCount,
    successfulRequests,
    failedRequests,
    windowStart,
    windowEnd,
    timestamp: windowEnd,
  };
}

// 2. Telemetry endpoint queried by Chainlink CRE and UI
async function handleTelemetry(req: Request, res: Response) {
  const contractId = (req.params.contractId || req.query.contractId || "0x9795176caf70852d6d691f238a562c1cff9c48219f612ec37826b729903b9c21") as string;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = parseInt((req.query.windowStart as string) || `${now - 30}`, 10);
  const windowEnd = parseInt((req.query.windowEnd as string) || `${now}`, 10);

  try {
    const telemetry = await performMeasurementBurst(contractId, windowStart, windowEnd);
    res.json(telemetry);
  } catch (err: any) {
    console.error(`[Observer ${OBSERVER_ID}] Burst failed:`, err);
    res.status(500).json({
      error: "Observer measurement failed",
      details: err?.message,
    });
  }
}

app.get("/telemetry", handleTelemetry);
app.get("/telemetry/:contractId", handleTelemetry);

// 3. Admin desync control (for testing CRE Byzantine fault tolerance)
app.post("/admin/desync", (req: Request, res: Response) => {
  const { offsetMs, enabled } = req.body;
  if (enabled === false) {
    desyncLatencyOffsetMs = 0;
  } else if (typeof offsetMs === "number") {
    desyncLatencyOffsetMs = offsetMs;
  } else {
    desyncLatencyOffsetMs = 450; // default desync offset
  }
  console.log(`[Observer ${OBSERVER_ID}] Desync offset set to ${desyncLatencyOffsetMs}ms`);
  res.json({
    observerId: OBSERVER_ID,
    desyncOffsetMs: desyncLatencyOffsetMs,
    active: desyncLatencyOffsetMs > 0,
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🔭 CompSentry Observer [${OBSERVER_ID}] running on port ${PORT}`);
  console.log(`Target Compute Provider: ${PROVIDER_URL}`);
  console.log(`Burst Sample Size: ${SAMPLE_SIZE} concurrent probes`);
  console.log(`Desync Offset: ${desyncLatencyOffsetMs}ms`);
  console.log(`====================================================`);
});
