import { NextRequest, NextResponse } from "next/server";
import {
  fetchContractOnChain,
  fetchContractsOnChain,
  fetchSettlementsOnChain,
  fetchIncidentsOnChain,
  fetchOfferOnChain,
  fetchOffersOnChain,
  fetchSystemMetricsOnChain,
  fetchProvidersOnChain,
} from "@/lib/onchainFallback";

export const dynamic = "force-dynamic";

// In-memory cache to deduplicate bursts and optimize Monad RPC reads
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 2500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cacheKey = JSON.stringify(body);
    const now = Date.now();

    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const q = (body.query || "") as string;
    const vars = body.variables || {};

    const responseData: any = {};

    // 1. Single Offer Query (GetOfferById / SLAOffer_by_pk)
    if (q.includes("SLAOffer_by_pk") || (q.includes("GetOfferById") && vars.id)) {
      const offerId = vars.id;
      const offer = await fetchOfferOnChain(offerId);
      responseData.SLAOffer_by_pk = offer;
    }

    // 2. Offers List (GetActiveOffers / SLAOffer)
    else if (q.includes("SLAOffer") && !q.includes("SLAOffer_by_pk")) {
      const offers = await fetchOffersOnChain();
      responseData.SLAOffer = offers;
    }

    // 3. Single Contract Query (GetContractById / SLAContract_by_pk)
    else if (q.includes("SLAContract_by_pk") || (q.includes("GetContractById") && vars.id)) {
      const contractId = vars.id;
      const contract = await fetchContractOnChain(contractId);
      responseData.SLAContract_by_pk = contract;
    }

    // 4. Contracts List (GetActiveContracts / SLAContract)
    else if (q.includes("SLAContract") && !q.includes("SLAContract_by_pk")) {
      const contracts = await fetchContractsOnChain();
      responseData.SLAContract = contracts;
    }

    // 5. Epoch Settlements Query (GetEpochSettlements / EpochSettlement)
    else if (q.includes("EpochSettlement")) {
      const contractId =
        vars.contractId ||
        vars.id ||
        vars.where?.contract_id?._eq;
      if (contractId) {
        responseData.EpochSettlement = await fetchSettlementsOnChain(contractId);
      } else {
        responseData.EpochSettlement = [];
      }
    }

    // 6. Incidents Query (GetIncidents / GetAllRecentIncidents / Incident)
    else if (q.includes("Incident")) {
      const contractId = vars.contractId || vars.where?.contract_id?._eq;
      responseData.Incident = await fetchIncidentsOnChain(contractId);
    }

    // 7. System Metrics Query (GetSystemMetrics / SystemMetrics)
    else if (q.includes("SystemMetrics")) {
      const metrics = await fetchSystemMetricsOnChain();
      responseData.SystemMetrics = [metrics];
    }

    // 8. Single Provider Query (GetProviderById / Provider_by_pk)
    else if (q.includes("Provider_by_pk") || (q.includes("GetProviderById") && vars.id)) {
      const providerId = vars.id;
      const provider = await fetchProvidersOnChain(providerId);
      responseData.Provider_by_pk = provider;
    }

    // 9. Providers List (GetAllProviders / Provider)
    else if (q.includes("Provider") && !q.includes("Provider_by_pk")) {
      const providers = await fetchProvidersOnChain();
      responseData.Provider = providers;
    }

    const result = { data: responseData };
    cache.set(cacheKey, { timestamp: now, data: result });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[GraphQL Route Error]:", err);
    return NextResponse.json(
      { errors: [{ message: err.message || "Failed to resolve on-chain data" }] },
      { status: 500 }
    );
  }
}
