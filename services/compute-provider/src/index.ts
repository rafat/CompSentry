import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;
const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json());

export type Scenario = "NORMAL" | "HIGH_LATENCY" | "OUTAGE";

interface ScenarioState {
  current: Scenario;
  baseLatencyMs: number;
  jitterMs: number;
  failureRateBps: number;
  description: string;
}

const SCENARIOS: Record<Scenario, ScenarioState> = {
  NORMAL: {
    current: "NORMAL",
    baseLatencyMs: 85,
    jitterMs: 15,
    failureRateBps: 0,
    description: "Optimal performance: 100% availability, ~85ms P95 latency",
  },
  HIGH_LATENCY: {
    current: "HIGH_LATENCY",
    baseLatencyMs: 440,
    jitterMs: 40,
    failureRateBps: 0,
    description: "GPU Thermal Throttle: Sustained latency spike to ~440ms (exceeds SLA threshold)",
  },
  OUTAGE: {
    current: "OUTAGE",
    baseLatencyMs: 90,
    jitterMs: 20,
    failureRateBps: 10000, // 100% failure rate
    description: "Cluster Outage: CUDA out of memory / Service Unavailable (HTTP 503)",
  },
};

let activeScenario: Scenario = "NORMAL";

// Normalizes scenario input from various formats (e.g. SCENARIO_LATENCY_SPIKE -> HIGH_LATENCY)
function normalizeScenario(input: string): Scenario {
  const upper = (input || "").toUpperCase().trim();
  if (upper === "NORMAL" || upper === "SCENARIO_NORMAL") return "NORMAL";
  if (upper === "HIGH_LATENCY" || upper === "SCENARIO_LATENCY_SPIKE" || upper === "LATENCY_SPIKE") return "HIGH_LATENCY";
  if (upper === "OUTAGE" || upper === "SCENARIO_OUTAGE") return "OUTAGE";
  return "NORMAL";
}

// Admin key check middleware for write operations
function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  if (!DEMO_ADMIN_KEY) {
    return next(); // If no key configured in env, allow for local dev
  }
  const providedKey = req.headers["x-admin-key"] || req.body?.adminKey || req.query?.adminKey;
  if (providedKey !== DEMO_ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing DEMO_ADMIN_KEY" });
  }
  next();
}

// 1. Health check (Cloud Run liveness)
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "compsentry-compute-provider",
    activeScenario,
    timestamp: Date.now(),
  });
});

// 2. Status check
app.get("/status", (_req: Request, res: Response) => {
  res.json({
    activeScenario,
    config: SCENARIOS[activeScenario],
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  });
});

// 3. Admin scenario control (GET & POST)
app.get("/admin/scenario", (_req: Request, res: Response) => {
  res.json({
    current: activeScenario,
    config: SCENARIOS[activeScenario],
  });
});

app.post("/admin/scenario", requireAdminKey, (req: Request, res: Response) => {
  const raw = req.body?.scenario || req.body?.type;
  if (!raw) {
    return res.status(400).json({ error: "Missing 'scenario' field in body" });
  }
  activeScenario = normalizeScenario(raw);
  console.log(`[Compute Provider] Switched scenario to: ${activeScenario} (${SCENARIOS[activeScenario].description})`);
  res.json({
    success: true,
    activeScenario,
    config: SCENARIOS[activeScenario],
  });
});

// Legacy backward-compatibility endpoint for frontend /api/scenario
app.post("/api/scenario", requireAdminKey, (req: Request, res: Response) => {
  const raw = req.body?.scenario || req.body?.type;
  if (!raw) {
    return res.status(400).json({ error: "Missing 'scenario' field in body" });
  }
  activeScenario = normalizeScenario(raw);
  res.json({
    success: true,
    scenario: SCENARIOS[activeScenario],
  });
});

app.get("/api/scenario", (_req: Request, res: Response) => {
  res.json({
    current: SCENARIOS[activeScenario],
  });
});

// Helper for inference simulation
async function handleInference(req: Request, res: Response) {
  const startTime = Date.now();
  const config = SCENARIOS[activeScenario];

  // 1. Check for failure (OUTAGE)
  if (config.failureRateBps >= 10000 || (config.failureRateBps > 0 && Math.random() * 10000 < config.failureRateBps)) {
    // Artificial small delay before failure
    await new Promise((resolve) => setTimeout(resolve, 35));
    return res.status(503).json({
      error: {
        message: "GPU Compute Node Overloaded: CUDA out of memory / Service Unavailable",
        type: "server_error",
        code: "compute_unavailable",
        timestamp: Date.now(),
      },
    });
  }

  // 2. Simulated latency with jitter
  const jitter = (Math.random() * 2 - 1) * config.jitterMs;
  const targetLatency = Math.max(10, Math.round(config.baseLatencyMs + jitter));

  const elapsed = Date.now() - startTime;
  const remainingDelay = Math.max(0, targetLatency - elapsed);

  setTimeout(() => {
    res.json({
      id: `chatcmpl-${Math.random().toString(36).substring(2, 11)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body?.model || "vllm-llama-3-70b",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Deterministic SLA micro-settlement verified by CompSentry on Monad Testnet.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 18,
        completion_tokens: 12,
        total_tokens: 30,
      },
      simulatedLatencyMs: targetLatency,
      scenario: activeScenario,
    });
  }, remainingDelay);
}

// 4. Inference endpoints
app.post("/inference", handleInference);
app.post("/v1/chat/completions", handleInference);

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CompSentry AI Compute Provider running on port ${PORT}`);
  console.log(`Initial Scenario: ${activeScenario} (${SCENARIOS[activeScenario].description})`);
  console.log(`CORS: Enabled (*)`);
  console.log(`Admin Auth: ${DEMO_ADMIN_KEY ? "Protected with DEMO_ADMIN_KEY" : "Open (no key set)"}`);
  console.log(`====================================================`);
});
