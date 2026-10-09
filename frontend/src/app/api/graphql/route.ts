import { NextRequest, NextResponse } from "next/server";
import { COMPSENTRY } from "@/config/compsentry";
import { fetchContractOnChain, fetchSettlementsOnChain, fetchOfferOnChain } from "@/lib/onchainFallback";

export const dynamic = "force-dynamic";

// In-memory cache to deduplicate bursts and prevent hitting Envio's 429 rate limiter
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cacheKey = JSON.stringify(body);
    const now = Date.now();

    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const endpoint = COMPSENTRY.indexer.graphqlUrl;

    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: cacheKey,
      cache: "no-store",
    });

    // If rate-limited (429), retry briefly
    if (res.status === 429) {
      if (cached) {
        return NextResponse.json(cached.data);
      }
      await new Promise((r) => setTimeout(r, 800));
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cacheKey,
        cache: "no-store",
      });
    }

    let data = res.ok ? await res.json() : null;

    // Fallback: If Envio is behind or missing live contract data, query Monad Testnet RPC directly
    if (body.query) {
      const q = body.query as string;

      // 0. Single Offer Query (SLAOffer_by_pk)
      if (q.includes("SLAOffer_by_pk")) {
        const offerId = body.variables?.id;
        if (offerId && (!data?.data?.SLAOffer_by_pk)) {
          const onchainOffer = await fetchOfferOnChain(offerId);
          if (onchainOffer) {
            data = data || { data: {} };
            data.data = data.data || {};
            data.data.SLAOffer_by_pk = onchainOffer;
          }
        }
      }

      // 1. Single Contract Query (SLAContract_by_pk)
      if (q.includes("SLAContract_by_pk")) {
        const contractId = body.variables?.id;
        if (contractId && (!data?.data?.SLAContract_by_pk)) {
          const onchainContract = await fetchContractOnChain(contractId);
          if (onchainContract) {
            data = data || { data: {} };
            data.data = data.data || {};
            data.data.SLAContract_by_pk = onchainContract;
          }
        }
      }

      // 2. Epoch Settlements Query (EpochSettlement)
      if (q.includes("EpochSettlement")) {
        const contractId =
          body.variables?.contractId ||
          body.variables?.id ||
          body.variables?.where?.contract_id?._eq;
        if (contractId && (!data?.data?.EpochSettlement || data.data.EpochSettlement.length === 0)) {
          const onchainSettlements = await fetchSettlementsOnChain(contractId);
          if (onchainSettlements.length > 0) {
            data = data || { data: {} };
            data.data = data.data || {};
            data.data.EpochSettlement = onchainSettlements;
          }
        }
      }

      // 3. Incidents Query (Incident)
      if (q.includes("Incident")) {
        const contractId = body.variables?.contractId;
        if (contractId && (!data?.data?.Incident || data.data.Incident.length === 0)) {
          const onchainSettlements = await fetchSettlementsOnChain(contractId);
          const incidents = onchainSettlements
            .filter((s) => s.status === "BREACHED")
            .map((s) => ({
              id: s.id,
              contract: s.contract,
              epochId: s.epochId,
              p95LatencyMs: s.p95LatencyMs,
              availabilityBps: s.availabilityBps,
              rebateAmount: s.rebateAmount,
              slashingAmount: s.slashingAmount,
              breachType: "LATENCY_BREACH",
              evidenceHash: s.evidenceHash,
              timestamp: s.blockTimestamp,
              txHash: s.txHash
            }));
          if (incidents.length > 0) {
            data = data || { data: {} };
            data.data = data.data || {};
            data.data.Incident = incidents;
          }
        }
      }

      // 4. Active Contracts List (SLAContract)
      if (q.includes("GetActiveContracts") || (q.includes("SLAContract") && !q.includes("SLAContract_by_pk"))) {
        const liveContract = await fetchContractOnChain("0x92aeeacbaf121ffe33d39aace49f331ac7419bda158c2553b5cd93024e515a81");
        if (liveContract) {
          data = data || { data: {} };
          data.data = data.data || {};
          const existingList = (data.data.SLAContract || []).filter(
            (c: any) => c.id.toLowerCase() !== liveContract.id.toLowerCase()
          );
          data.data.SLAContract = [liveContract, ...existingList];
        }
      }
    }

    if (!data) {
      if (cached) return NextResponse.json(cached.data);
      return NextResponse.json({ errors: [{ message: "Data unavailable" }] }, { status: 502 });
    }

    cache.set(cacheKey, { timestamp: now, data });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[GraphQL Proxy Error]:", err.message);
    return NextResponse.json(
      { errors: [{ message: err.message || "Failed to reach Envio GraphQL" }] },
      { status: 502 }
    );
  }
}
