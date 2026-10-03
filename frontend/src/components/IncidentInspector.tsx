"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, ShieldAlert, Sparkles, ExternalLink, Terminal, ShieldCheck } from "lucide-react";

interface IncidentInspectorProps {
  scenario: "normal" | "latency" | "outage" | "desync";
}

export function IncidentInspector({ scenario }: IncidentInspectorProps) {
  const [selectedIncident, setSelectedIncident] = useState<number | null>(0);

  const incidents = [
    {
      epoch: 4,
      status: "BREACHED",
      breachType: "LATENCY_BREACH",
      p95Latency: "455 ms",
      slaLatency: "120 ms",
      availability: "100.0%",
      rebate: "$15.00 USDC",
      slashing: "$0.00 USDC",
      txHash: "0x8f7d9c12a34b5e67890123456789abcdef0123456789abcdef0123456789abcd",
      evidenceHash: "0x3f5c928410294827019283746592019283746501928374650192837465019283",
      aiSummary:
        "The Chainlink CRE DON observed a prolonged P95 inference latency spike to 455ms across all 3 independent observer probes. All probes agreed that TTFT (Time To First Token) exceeded the 120ms SLA threshold due to memory bandwidth contention on the provider's H100 cluster during concurrent MoE layer routing. Vault automatically rebated $15.00 USDC back to the buyer while keeping provider bond intact.",
    },
    {
      epoch: 3,
      status: "COMPLIANT",
      breachType: "NONE",
      p95Latency: "71 ms",
      slaLatency: "120 ms",
      availability: "100.0%",
      rebate: "$0.00 USDC",
      slashing: "$0.00 USDC",
      txHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
      evidenceHash: "0x9e61b309435ff4306d0e68c40b4989b780fed839d1e48fda57ad58d937612123",
      aiSummary:
        "Cluster operated at peak throughput. Median latency of 71ms satisfied the < 120ms SLA with 100% availability across 30 consecutive prompt cycles. Service fee dished to provider custody balance.",
    },
    {
      epoch: 2,
      status: "BREACHED",
      breachType: "BOTH",
      p95Latency: "TIMEOUT",
      slaLatency: "120 ms",
      availability: "0.0%",
      rebate: "$25.00 USDC",
      slashing: "$1.00 USDC",
      txHash: "0x778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566",
      evidenceHash: "0x44556677889900112233445566778899aabbccddeeff00112233445566778899",
      aiSummary:
        "Critical service drop: All 3 probes reported connection drops to endpoint /v1/chat/completions resulting in 0% availability. Evaluator failed health probes. SettlementController executed automatic maximum rebate ($25.00 USDC) and slashed 5% of provider performance bond ($1.00 USDC) into buyer compensation escrow.",
    }
  ];

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-monad-500" />
            <span>AI Incident Explainer & Evidence Verifier</span>
          </h2>
          <p className="text-xs text-gray-400">
            Decoupled LLM post-mortem analysis committed to canonical CRE evidence hashes on Monad.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Settlement History List */}
        <div className="lg:col-span-5 space-y-2">
          <span className="text-[11px] font-mono text-gray-400 block uppercase">Epoch Settlement Records</span>
          {incidents.map((inc, idx) => {
            const isSelected = selectedIncident === idx;
            const isBreach = inc.status === "BREACHED";

            return (
              <div
                key={idx}
                onClick={() => setSelectedIncident(idx)}
                className={`p-3 rounded-lg border font-mono text-xs cursor-pointer transition ${
                  isSelected
                    ? "bg-cyber-bg border-monad-500 ring-1 ring-monad-500/50"
                    : "bg-cyber-bg/50 border-cyber-border hover:border-cyber-highlight"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {isBreach ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span className="font-bold text-white">Epoch #{inc.epoch}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                      isBreach
                        ? "bg-rose-950/80 text-rose-400 border-rose-500/30"
                        : "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {inc.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>P95: {inc.p95Latency}</span>
                  <span>Rebate: {inc.rebate}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Incident AI Post-Mortem Card */}
        <div className="lg:col-span-7 bg-cyber-bg border border-cyber-border rounded-xl p-4 flex flex-col justify-between font-mono text-xs">
          {selectedIncident !== null ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-cyber-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  <span className="font-bold text-white text-sm">
                    Epoch #{incidents[selectedIncident].epoch} Root Cause Analysis
                  </span>
                </div>
                <span className="text-[10px] bg-cyber-card px-2 py-0.5 rounded text-gray-400 border border-cyber-border">
                  Model: Claude 3.5 Sonnet / Gemini Flash
                </span>
              </div>

              {/* Natural Language Post-Mortem */}
              <div className="bg-cyber-card/80 border border-cyber-border p-3.5 rounded-lg text-gray-200 leading-relaxed text-xs">
                <p>{incidents[selectedIncident].aiSummary}</p>
              </div>

              {/* Audit Proofs */}
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Evidence Commitment</span>
                  <div className="text-[11px] text-monad-400 break-all bg-cyber-card p-2 rounded border border-cyber-border">
                    {incidents[selectedIncident].evidenceHash}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Monad Testnet Transaction</span>
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${incidents[selectedIncident].txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <span>{incidents[selectedIncident].txHash.slice(0, 32)}...</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select an epoch settlement to view its verified post-mortem analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
