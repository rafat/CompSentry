import { NextRequest, NextResponse } from "next/server";
import { COMPSENTRY } from "@/config/compsentry";

const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_KEY || "compsentry-hackathon-2025";

export async function GET() {
  try {
    const evaluatorUrl = COMPSENTRY.evaluator.url;
    const res = await fetch(`${evaluatorUrl}/admin/scenario`, {
      headers: { "x-admin-key": DEMO_ADMIN_KEY },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.warn("[API Scenario GET] Fallback to localhost:", err.message);
  }

  return NextResponse.json({
    current: "NORMAL",
    config: {
      type: "SCENARIO_NORMAL",
      baseLatencyMs: 85,
      jitterMs: 15,
      failureRateBps: 0,
      description: "Optimal performance: 100% availability, ~85ms latency",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const evaluatorUrl = COMPSENTRY.evaluator.url;

    // Map scenario to canonical name
    const scenario = body.scenario || body.type;

    // Send to evaluator/provider service
    const res = await fetch(`${evaluatorUrl}/admin/scenario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": DEMO_ADMIN_KEY,
      },
      body: JSON.stringify({ scenario, adminKey: DEMO_ADMIN_KEY }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, ...data });
    }

    // Try fallback endpoint (/api/scenario for local evaluator)
    const fallbackRes = await fetch(`${evaluatorUrl}/api/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return NextResponse.json({ success: true, ...data });
    }

    return NextResponse.json(
      { error: "Failed to switch scenario on provider service" },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal error switching scenario" },
      { status: 500 }
    );
  }
}
