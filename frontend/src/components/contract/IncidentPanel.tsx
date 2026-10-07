import React from "react";
import { Incident, SLAContract } from "@/types";
import { formatLatency, formatPercent, formatUSDC, shortenHash } from "@/lib/formatting";
import { formatBreachLabel } from "@/lib/breach";
import { COMPSENTRY } from "@/config/compsentry";
import { AlertTriangle, ExternalLink, ShieldAlert, CheckCircle2, ShieldCheck } from "lucide-react";

interface IncidentPanelProps {
  incidents: Incident[];
  contract?: SLAContract | null;
}

export function IncidentPanel({ incidents, contract }: IncidentPanelProps) {
  if (incidents.length === 0) {
    return (
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">SLA Protection Status: Fully Compliant</h3>
            <p className="text-gray-400 text-[11px]">
              0 objective SLA breaches recorded on Monad Testnet. Full provider performance bond remains intact.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block px-3 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px]">
          100% HEALTHY
        </span>
      </div>
    );
  }

  // Display the latest breach
  const latest = incidents[0];
  const isCritical = latest.breachType === "BOTH" || latest.breachType === "AVAILABILITY_BREACH";

  return (
    <div className={`rounded-xl border p-5 font-mono text-xs space-y-4 shadow-xl ${
      isCritical
        ? "bg-rose-950/20 border-rose-500/60 shadow-rose-950/20"
        : "bg-amber-950/20 border-amber-500/60 shadow-amber-950/20"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className={`h-5 w-5 ${isCritical ? "text-rose-400 animate-pulse" : "text-amber-400"}`} />
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight">
              ⚠ SLA BREACH DETECTED — Epoch #{latest.epochId}
            </h3>
            <span className="text-[11px] text-gray-400">
              Chainlink CRE consensus confirmed: <strong className="text-rose-300">{formatBreachLabel(latest.breachType)}</strong>
            </span>
          </div>
        </div>

        <a
          href={COMPSENTRY.explorer.txUrl(latest.txHash)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyber-bg border border-cyber-border hover:border-monad-500 text-cyan-400 text-xs transition"
        >
          <span>View Settlement Tx</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Grid of SLA Metrics & Compensations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-cyber-bg/90 border border-cyber-border/80 p-3 rounded-lg">
          <span className="text-gray-400 uppercase text-[10px] block">Observed P95 Latency</span>
          <span className="text-white font-bold text-sm">{formatLatency(latest.p95LatencyMs)}</span>
          <span className="text-[10px] text-gray-500 block mt-0.5">
            SLA Limit: ≤ {contract ? formatLatency(contract.latencyThresholdMs) : "120ms"}
          </span>
        </div>

        <div className="bg-cyber-bg/90 border border-cyber-border/80 p-3 rounded-lg">
          <span className="text-gray-400 uppercase text-[10px] block">Observed Availability</span>
          <span className="text-white font-bold text-sm">{formatPercent(latest.availabilityBps)}</span>
          <span className="text-[10px] text-gray-500 block mt-0.5">
            SLA Minimum: ≥ {contract ? formatPercent(contract.availabilityThresholdBps) : "99.50%"}
          </span>
        </div>

        <div className="bg-cyber-bg/90 border border-cyber-border/80 p-3 rounded-lg">
          <span className="text-emerald-400 uppercase text-[10px] block font-semibold">Buyer Rebate Credited</span>
          <span className="text-emerald-400 font-bold text-sm">+{formatUSDC(latest.rebateAmount)}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Refunded from Escrow</span>
        </div>

        <div className="bg-cyber-bg/90 border border-cyber-border/80 p-3 rounded-lg">
          <span className="text-rose-400 uppercase text-[10px] block font-semibold">Provider Bond Slashed</span>
          <span className="text-rose-400 font-bold text-sm">{formatUSDC(latest.slashingAmount)}</span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Liquidated Damages</span>
        </div>
      </div>

      {/* Audit Commitment Line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[11px] text-gray-400 border-t border-cyber-border/60">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-monad-400 shrink-0" />
          <span>Evidence Commitment: <span className="text-monad-300 font-bold break-all">{shortenHash(latest.evidenceHash)}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          <span>Validated by 3 Independent CRE Observers</span>
        </div>
      </div>
    </div>
  );
}
