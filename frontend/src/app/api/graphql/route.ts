import { NextRequest, NextResponse } from "next/server";
import { COMPSENTRY } from "@/config/compsentry";

export const dynamic = "force-dynamic";

// In-memory cache to deduplicate bursts and prevent hitting Envio's 429 rate limiter
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 3000; // 3-second deduplication cache

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

    // If rate-limited (429), serve stale cache if available, or wait and retry once
    if (res.status === 429) {
      console.warn("[GraphQL Proxy] Envio 429 Rate Limit encountered. Serving cache or retrying...");
      if (cached) {
        return NextResponse.json(cached.data);
      }
      await new Promise((r) => setTimeout(r, 1200));
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cacheKey,
        cache: "no-store",
      });
    }

    if (!res.ok) {
      if (cached) {
        return NextResponse.json(cached.data);
      }
      const errorText = await res.text();
      return NextResponse.json(
        { errors: [{ message: `Envio HTTP ${res.status}: ${errorText}` }] },
        { status: res.status }
      );
    }

    const data = await res.json();
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
