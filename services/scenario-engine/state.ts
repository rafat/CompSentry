export type ScenarioType =
  | "SCENARIO_NORMAL"
  | "SCENARIO_LATENCY_SPIKE"
  | "SCENARIO_OUTAGE"
  | "SCENARIO_OBSERVER_DESYNC";

export interface ScenarioConfig {
  type: ScenarioType;
  baseLatencyMs: number;
  jitterMs: number;
  failureRateBps: number; // 0 - 10000 (bps)
  desyncObserverId?: string;
  description: string;
}

const DEFAULT_CONFIGS: Record<ScenarioType, ScenarioConfig> = {
  SCENARIO_NORMAL: {
    type: "SCENARIO_NORMAL",
    baseLatencyMs: 65,
    jitterMs: 15,
    failureRateBps: 0,
    description: "Optimal performance: 100% availability, ~65ms latency"
  },
  SCENARIO_LATENCY_SPIKE: {
    type: "SCENARIO_LATENCY_SPIKE",
    baseLatencyMs: 420,
    jitterMs: 50,
    failureRateBps: 0,
    description: "Sustained latency breach: ~420ms latency (exceeds 200ms threshold)"
  },
  SCENARIO_OUTAGE: {
    type: "SCENARIO_OUTAGE",
    baseLatencyMs: 95,
    jitterMs: 20,
    failureRateBps: 3000, // 30% failure rate
    description: "Availability breach: 30% synthetic 503 errors (violates 99% SLA)"
  },
  SCENARIO_OBSERVER_DESYNC: {
    type: "SCENARIO_OBSERVER_DESYNC",
    baseLatencyMs: 70,
    jitterMs: 15,
    failureRateBps: 0,
    desyncObserverId: "observer-independent",
    description: "Observer divergence: 1 observer sees 450ms, others see 70ms"
  }
};

let currentScenario: ScenarioConfig = { ...DEFAULT_CONFIGS.SCENARIO_NORMAL };

export function getScenarioConfig(): ScenarioConfig {
  return currentScenario;
}

export function setScenario(type: ScenarioType): ScenarioConfig {
  if (!DEFAULT_CONFIGS[type]) {
    throw new Error(`Unknown scenario: ${type}`);
  }
  currentScenario = { ...DEFAULT_CONFIGS[type] };
  console.log(`[Scenario Engine] Scenario switched to: ${type} - ${currentScenario.description}`);
  return currentScenario;
}
