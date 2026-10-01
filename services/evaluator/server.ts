import express from "express";
import cors from "cors";
import { getScenarioConfig, setScenario, ScenarioType } from "../scenario-engine/state";

const app = express();
const PORT = process.env.EVALUATOR_PORT || 4000;

app.use(cors());
app.use(express.json());

// Scenario control endpoints
app.get("/api/scenario", (req, res) => {
  res.json({ current: getScenarioConfig() });
});

app.post("/api/scenario", (req, res) => {
  const { scenario } = req.body;
  try {
    const updated = setScenario(scenario as ScenarioType);
    res.json({ success: true, scenario: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mock Inference Endpoint (e.g. OpenAI / vLLM compatible endpoint)
app.post("/v1/chat/completions", async (req, res) => {
  const startTime = Date.now();
  const config = getScenarioConfig();

  // 1. Check for failure injection
  const randomRoll = Math.floor(Math.random() * 10000);
  if (randomRoll < config.failureRateBps) {
    // Simulated failure
    return res.status(503).json({
      error: {
        message: "GPU Compute Node Overloaded: CUDA out of memory / Service Unavailable",
        type: "server_error",
        code: "compute_unavailable"
      }
    });
  }

  // 2. Simulated latency delay
  const jitter = (Math.random() * 2 - 1) * config.jitterMs;
  const targetDelay = Math.max(10, Math.round(config.baseLatencyMs + jitter));

  await new Promise((resolve) => setTimeout(resolve, targetDelay));

  const totalDuration = Date.now() - startTime;

  res.json({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "meta-llama/Llama-3-70b-instruct",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "CompSentry verified compute response generated with verified SLA."
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 15,
      total_tokens: 57
    },
    _telemetry: {
      latencyMs: totalDuration,
      status: 200,
      timestamp: Date.now()
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Evaluator] Inference Endpoint running at http://localhost:${PORT}`);
  });
}

export default app;
