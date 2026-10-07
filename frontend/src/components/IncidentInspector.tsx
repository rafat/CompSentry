"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Sparkles, ExternalLink, Terminal, ShieldCheck } from "lucide-react";
import { fetchContractIncidents, IncidentData } from "@/lib/api";

interface IncidentInspectorProps {
  scenario: "normal" | "latency" | "outage" | "desync";
  contractId?: string | null;
}

export function IncidentInspector({ scenario, contractId }: IncidentInspectorProps) {
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadIncidents = async () => {
      try {
        const data = await fetchContractIncidents(contractId || undefined);
        if (isMounted) {
          setIncidents(data);
          if (data.length > 0 && selectedIncident === null) {
            setSelectedIncident(0);
          }
        }
      } catch (err) {
        console.warn("Could not fetch incidents:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadIncidents();
    const interval = setInterval(loadIncidents, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [contractId]);

  const formatUSDC = (amountStr: string) => {
    try {
      const val = Number(BigInt(amountStr)) / 1e6;
      return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    } catch {
      return "$0.00 USDC";
    }
  };

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

      {incidents.length === 0 ? (
        <div className="bg-cyber-bg border border-cyber-border rounded-xl p-8 text-center font-mono space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-white">Zero SLA Breaches Recorded</h3>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            All micro-epochs have operated within SLA thresholds. When an epoch breach is settled on Monad Testnet via the Chainlink CRE consensus, automated rebates and cryptographic evidence hashes will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Settlement History List */}
          <div className="lg:col-span-5 space-y-2">
            <span className="text-[11px] font-mono text-gray-400 block uppercase">Epoch Settlement Records</span>
            {incidents.map((inc, idx) => {
              const isSelected = selectedIncident === idx;
              const isBreach = Boolean(inc.breachType);

              return (
                <div
                  key={inc.id || idx}
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
                      <span className="font-bold text-white">Epoch #{inc.epochId}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        isBreach
                          ? "bg-rose-950/80 text-rose-400 border-rose-500/30"
                          : "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {inc.breachType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>P95: {inc.p95LatencyMs} ms</span>
                    <span>Rebate: {formatUSDC(inc.rebateAmount)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Incident AI Post-Mortem Card */}
          <div className="lg:col-span-7 bg-cyber-bg border border-cyber-border rounded-xl p-4 flex flex-col justify-between font-mono text-xs">
            {selectedIncident !== null && incidents[selectedIncident] ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-cyber-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-cyan-400" />
                    <span className="font-bold text-white text-sm">
                      Epoch #{incidents[selectedIncident].epochId} Root Cause Analysis
                    </span>
                  </div>
                  <span className="text-[10px] bg-cyber-card px-2 py-0.5 rounded text-gray-400 border border-cyber-border">
                    Chainlink CRE Attestation
                  </span>
                </div>

                {/* AI / Oracle Post-Mortem */}
                <div className="bg-cyber-card/80 border border-cyber-border p-3.5 rounded-lg text-gray-200 leading-relaxed text-xs">
                  <p>
                    {incidents[selectedIncident].aiExplanation ||
                      `Epoch #${incidents[selectedIncident].epochId} recorded an SLA event (${incidents[selectedIncident].breachType}). P95 latency was measured at ${incidents[selectedIncident].p95LatencyMs}ms with availability at ${(Number(incidents[selectedIncident].availabilityBps) / 100).toFixed(1)}%. Automated rebate of ${formatUSDC(incidents[selectedIncident].rebateAmount)} was credited to buyer.`}
                  </p>
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
                      href={`https://testnet.monadvision.com/tx/${incidents[selectedIncident].txHash}`}
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
      )}
    </div>
  );
}
