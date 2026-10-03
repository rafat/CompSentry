export interface SystemMetricsData {
  totalValueLocked: string;
  totalActiveEscrow: string;
  totalActiveBond: string;
  totalSettledRebates: string;
  totalSlashedBonds: string;
  totalSettlementsCount: string;
  totalContractsCount: string;
  curBps: string;
}

export interface SLAOfferData {
  id: string;
  provider: {
    id: string;
    priScore: string;
    totalContracts: string;
  };
  token: string;
  resourceId: string;
  serviceFee: string;
  bondBps: string;
  availabilityThresholdBps: string;
  latencyThresholdMs: string;
  epochDuration: string;
  totalEpochs: string;
  epochPayoutCap: string;
  maxTotalPayout: string;
  active: boolean;
}

export interface SLAContractData {
  id: string;
  offer: SLAOfferData;
  buyer: { id: string };
  provider: { id: string; priScore: string };
  serviceFee: string;
  providerBond: string;
  currentRemainingEscrow: string;
  currentRemainingBond: string;
  startTimestamp: string;
  endTimestamp: string;
  totalEpochs: string;
  epochDuration: string;
  availabilityThresholdBps: string;
  latencyThresholdMs: string;
  epochPayoutCap: string;
  maxTotalPayout: string;
  settledEpochsCount: string;
  cumulativeRebates: string;
  cumulativeSlashing: string;
  status: "ACTIVE" | "REVIEW_REQUIRED" | "FINALIZED";
}

export interface EpochSettlementData {
  id: string;
  contractId: string;
  epochId: string;
  p95LatencyMs: string;
  availabilityBps: string;
  deliveredUnits: string;
  rebateAmount: string;
  slashingAmount: string;
  evidenceHash: string;
  status: "COMPLIANT" | "BREACHED";
  blockTimestamp: string;
  txHash: string;
}

export interface IncidentData {
  id: string;
  contractId: string;
  epochId: string;
  p95LatencyMs: string;
  availabilityBps: string;
  rebateAmount: string;
  slashingAmount: string;
  breachType: "LATENCY_BREACH" | "AVAILABILITY_BREACH" | "BOTH";
  evidenceHash: string;
  timestamp: string;
  txHash: string;
  aiExplanation?: string;
}

const INDEXER_GRAPHQL_URL = process.env.NEXT_PUBLIC_INDEXER_GRAPHQL_URL || "http://localhost:8080/v1/graphql";
const EVALUATOR_URL = process.env.NEXT_PUBLIC_EVALUATOR_URL || "http://localhost:4000";

// Fetch System Metrics from Envio
export async function fetchSystemMetrics(): Promise<SystemMetricsData> {
  const query = `
    query GetSystemMetrics {
      SystemMetrics(id: "global_system_metrics") {
        totalValueLocked
        totalActiveEscrow
        totalActiveBond
        totalSettledRebates
        totalSlashedBonds
        totalSettlementsCount
        totalContractsCount
        curBps
      }
    }
  `;

  try {
    const res = await fetch(INDEXER_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    const json = await res.json();
    if (json.data?.SystemMetrics) {
      return json.data.SystemMetrics;
    }
  } catch {
    // Fallback demo state
  }

  return {
    totalValueLocked: "1200000000000000000000", // 1200 tokens
    totalActiveEscrow: "1000000000000000000000",
    totalActiveBond: "200000000000000000000",
    totalSettledRebates: "25000000000000000000",
    totalSlashedBonds: "5000000000000000000",
    totalSettlementsCount: "42",
    totalContractsCount: "6",
    curBps: "1666", // 16.66%
  };
}

// Fault Injection API trigger
export async function setChaosScenario(scenario: "normal" | "latency" | "outage" | "desync") {
  try {
    const res = await fetch(`${EVALUATOR_URL}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    return await res.json();
  } catch (err: any) {
    console.warn("Evaluator offline, simulated local scenario switch:", scenario);
    return { success: true, scenario, simulated: true };
  }
}
