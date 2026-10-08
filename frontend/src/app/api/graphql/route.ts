import { NextRequest, NextResponse } from "next/server";
import { COMPSENTRY } from "@/config/compsentry";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = COMPSENTRY.indexer.graphqlUrl;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { errors: [{ message: `Envio HTTP ${res.status}: ${errorText}` }] },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[GraphQL Proxy Error]:", err.message);
    return NextResponse.json(
      { errors: [{ message: err.message || "Failed to reach Envio GraphQL" }] },
      { status: 502 }
    );
  }
}
