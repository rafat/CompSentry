import { fetchGraphQL } from "./client";
import {
  SystemMetrics,
  SLAOffer,
  SLAContract,
  EpochSettlement,
  Incident,
  Provider,
} from "@/types";

export const GET_SYSTEM_METRICS = `
  query GetSystemMetrics {
    SystemMetrics(limit: 1) {
      id
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

export const GET_ACTIVE_OFFERS = `
  query GetActiveOffers {
    SLAOffer(where: { active: { _eq: true } }, order_by: { createdAtTimestamp: desc }) {
      id
      provider {
        id
        priScore
        totalContracts
        activeContracts
        totalEarned
        totalSlashed
        breachCount
        compliantEpochsCount
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
      createdAtBlock
      createdAtTimestamp
    }
  }
`;

export const GET_OFFER_BY_ID = `
  query GetOfferById($id: String!) {
    SLAOffer_by_pk(id: $id) {
      id
      provider {
        id
        priScore
        totalContracts
        activeContracts
        totalEarned
        totalSlashed
        breachCount
        compliantEpochsCount
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
      createdAtBlock
      createdAtTimestamp
    }
  }
`;

export const GET_ACTIVE_CONTRACTS = `
  query GetActiveContracts {
    SLAContract(order_by: { startTimestamp: desc }) {
      id
      offer {
        id
        resourceId
        availabilityThresholdBps
        latencyThresholdMs
      }
      buyer {
        id
      }
      provider {
        id
        priScore
      }
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
      createdAtBlock
      createdAtTimestamp
    }
  }
`;

export const GET_CONTRACT_BY_ID = `
  query GetContractById($id: String!) {
    SLAContract_by_pk(id: $id) {
      id
      offer {
        id
        resourceId
        availabilityThresholdBps
        latencyThresholdMs
        epochDuration
        totalEpochs
      }
      buyer {
        id
      }
      provider {
        id
        priScore
      }
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
      createdAtBlock
      createdAtTimestamp
    }
  }
`;

export const GET_EPOCH_SETTLEMENTS = `
  query GetEpochSettlements($contractId: String!) {
    EpochSettlement(where: { contract_id: { _eq: $contractId } }, order_by: { epochId: desc }, limit: 50) {
      id
      contract {
        id
      }
      epochId
      p95LatencyMs
      availabilityBps
      deliveredUnits
      rebateAmount
      slashingAmount
      evidenceHash
      status
      blockNumber
      blockTimestamp
      txHash
    }
  }
`;

export const GET_INCIDENTS = `
  query GetIncidents($contractId: String) {
    Incident(where: { contract_id: { _eq: $contractId } }, order_by: { timestamp: desc }, limit: 20) {
      id
      contract {
        id
      }
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

export const GET_ALL_RECENT_INCIDENTS = `
  query GetAllRecentIncidents {
    Incident(order_by: { timestamp: desc }, limit: 10) {
      id
      contract {
        id
      }
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

export const GET_ALL_PROVIDERS = `
  query GetAllProviders {
    Provider(order_by: { priScore: desc }) {
      id
      totalOffers
      totalContracts
      activeContracts
      totalBondStaked
      totalSlashed
      totalEarned
      breachCount
      compliantEpochsCount
      priScore
    }
  }
`;

export const GET_PROVIDER_BY_ID = `
  query GetProviderById($id: String!) {
    Provider_by_pk(id: $id) {
      id
      totalOffers
      totalContracts
      activeContracts
      totalBondStaked
      totalSlashed
      totalEarned
      breachCount
      compliantEpochsCount
      priScore
    }
  }
`;

// Helper execution functions
export async function fetchSystemMetrics(): Promise<SystemMetrics | null> {
  const data = await fetchGraphQL<{ SystemMetrics: SystemMetrics[] }>(GET_SYSTEM_METRICS);
  return data?.SystemMetrics?.[0] || null;
}

export async function fetchSLAOffers(): Promise<SLAOffer[]> {
  const data = await fetchGraphQL<{ SLAOffer: SLAOffer[] }>(GET_ACTIVE_OFFERS);
  const networkOffers = data?.SLAOffer || [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("compsentry_custom_offers");
      if (stored) {
        const custom: SLAOffer[] = JSON.parse(stored);
        const existingIds = new Set(networkOffers.map((o) => o.id.toLowerCase()));
        const uniqueCustom = custom.filter((o) => !existingIds.has(o.id.toLowerCase()));
        return [...uniqueCustom, ...networkOffers];
      }
    } catch {}
  }
  return networkOffers;
}

export async function fetchSLAOfferById(id: string): Promise<SLAOffer | null> {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("compsentry_custom_offers");
      if (stored) {
        const custom: SLAOffer[] = JSON.parse(stored);
        const match = custom.find((o) => o.id.toLowerCase() === id.toLowerCase());
        if (match) return match;
      }
    } catch {}
  }
  const data = await fetchGraphQL<{ SLAOffer_by_pk: SLAOffer }>(GET_OFFER_BY_ID, { id });
  return data?.SLAOffer_by_pk || null;
}

export async function fetchActiveContracts(): Promise<SLAContract[]> {
  const data = await fetchGraphQL<{ SLAContract: SLAContract[] }>(GET_ACTIVE_CONTRACTS);
  const networkContracts = data?.SLAContract || [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("compsentry_custom_contracts");
      if (stored) {
        const custom: SLAContract[] = JSON.parse(stored);
        const existingIds = new Set(networkContracts.map((c) => c.id.toLowerCase()));
        const uniqueCustom = custom.filter((c) => !existingIds.has(c.id.toLowerCase()));
        return [...uniqueCustom, ...networkContracts];
      }
    } catch {}
  }
  return networkContracts;
}

export async function fetchSLAContractById(id: string): Promise<SLAContract | null> {
  const data = await fetchGraphQL<{ SLAContract_by_pk: SLAContract }>(GET_CONTRACT_BY_ID, { id });
  return data?.SLAContract_by_pk || null;
}

export async function fetchEpochSettlements(contractId: string): Promise<EpochSettlement[]> {
  const data = await fetchGraphQL<{ EpochSettlement: EpochSettlement[] }>(GET_EPOCH_SETTLEMENTS, { contractId });
  return data?.EpochSettlement || [];
}

export async function fetchContractIncidents(contractId?: string): Promise<Incident[]> {
  if (contractId) {
    const data = await fetchGraphQL<{ Incident: Incident[] }>(GET_INCIDENTS, { contractId });
    return data?.Incident || [];
  }
  const data = await fetchGraphQL<{ Incident: Incident[] }>(GET_ALL_RECENT_INCIDENTS);
  return data?.Incident || [];
}

export async function fetchAllProviders(): Promise<Provider[]> {
  const data = await fetchGraphQL<{ Provider: Provider[] }>(GET_ALL_PROVIDERS);
  return data?.Provider || [];
}

export async function fetchProviderById(id: string): Promise<Provider | null> {
  const data = await fetchGraphQL<{ Provider_by_pk: Provider }>(GET_PROVIDER_BY_ID, { id });
  return data?.Provider_by_pk || null;
}
