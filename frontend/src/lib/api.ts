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
export async function fetchSystemMetrics(): Promise<SystemMetricsData | null> {
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
    // Indexer offline / not yet ready
  }

  return null;
}

// Fetch Active Offers from Envio
export async function fetchActiveOffers(): Promise<SLAOfferData[]> {
  const query = `
    query GetActiveOffers {
      SLAOffer(where: { active: { _eq: true } }, order_by: { id: asc }) {
        id
        provider {
          id
          priScore
          totalContracts
        }
        token
        resourceId
        serviceFee
        bondBps
        availabilityThresholdBps
        latencyThresholdMs
        epochDuration
        totalEpochs
        epochPayoutCap
        maxTotalPayout
        active
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
    if (json.data?.SLAOffer) {
      return json.data.SLAOffer;
    }
  } catch (err) {
    console.warn("Could not fetch offers from indexer:", err);
  }

  return [];
}

// Fetch Active Contracts from Envio
export async function fetchActiveContracts(): Promise<SLAContractData[]> {
  const query = `
    query GetActiveContracts {
      SLAContract(where: { status: { _eq: "ACTIVE" } }, order_by: { startTimestamp: desc }) {
        id
        offer {
          id
          resourceId
          availabilityThresholdBps
          latencyThresholdMs
        }
        buyer { id }
        provider { id, priScore }
        serviceFee
        providerBond
        currentRemainingEscrow
        currentRemainingBond
        startTimestamp
        endTimestamp
        totalEpochs
        epochDuration
        availabilityThresholdBps
        latencyThresholdMs
        epochPayoutCap
        maxTotalPayout
        settledEpochsCount
        cumulativeRebates
        cumulativeSlashing
        status
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
    if (json.data?.SLAContract) {
      return json.data.SLAContract;
    }
  } catch (err) {
    console.warn("Could not fetch active contracts from indexer:", err);
  }

  return [];
}

// Fetch Incidents from Envio
export async function fetchContractIncidents(contractId?: string): Promise<IncidentData[]> {
  const whereFilter = contractId ? `where: { contractId: { _eq: "${contractId}" } }, ` : "";
  const query = `
    query GetIncidents {
      Incident(${whereFilter}order_by: { timestamp: desc }, limit: 10) {
        id
        contractId
        epochId
        p95LatencyMs
        availabilityBps
        rebateAmount
        slashingAmount
        breachType
        evidenceHash
        timestamp
        txHash
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
    if (json.data?.Incident) {
      return json.data.Incident;
    }
  } catch (err) {
    console.warn("Could not fetch incidents from indexer:", err);
  }

  return [];
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
