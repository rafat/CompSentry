import React from "react";
import { SLAContract } from "@/types";
import { formatLatency, formatPercent, formatUSDC } from "@/lib/formatting";
import { Activity, ShieldAlert, CheckCircle2, AlertTriangle, Zap, DollarSign } from "lucide-react";

interface SLAHealthProps {
  contract: SLAContract;
  currentLatency?: number;
  currentAvailability?: number;
}

export function SLAHealth({ contract, currentLatency = 72, currentAvailability = 10000 }: SLAHealthProps) {
  const maxLatency = Number(contract.latencyThresholdMs || 120);
  const minAvailability = Number(contract.availabilityThresholdBps || 9950);

  const isLatencyHealthy = currentLatency <= maxLatency;
  const isAvailabilityHealthy = currentAvailability >= minAvailability;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
      {/* P95 Latency Health */}
      <div className={`p-4 rounded-xl border ${
        isLatencyHealthy
          ? "bg-cyber-card border-cyber-border"
          : "bg-rose-950/20 border-rose-500/50"
      }`}>
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-[10px] uppercase font-semibold">P95 Latency</span>
          <Activity className={`h-3.5 w-3.5 ${isLatencyHealthy ? "text-cyan-400" : "text-rose-400"}`} />
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {formatLatency(currentLatency)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Limit: ≤ {formatLatency(maxLatency)}</span>
          <span className={`font-bold flex items-center gap-1 ${isLatencyHealthy ? "text-emerald-400" : "text-rose-400"}`}>
            {isLatencyHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            <span>{isLatencyHealthy ? "HEALTHY" : "BREACH"}</span>
          </span>
        </div>
      </div>

      {/* Availability Health */}
      <div className={`p-4 rounded-xl border ${
        isAvailabilityHealthy
          ? "bg-cyber-card border-cyber-border"
          : "bg-rose-950/20 border-rose-500/50"
      }`}>
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-[10px] uppercase font-semibold">Availability</span>
          <Zap className={`h-3.5 w-3.5 ${isAvailabilityHealthy ? "text-emerald-400" : "text-rose-400"}`} />
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {formatPercent(currentAvailability)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Minimum: ≥ {formatPercent(minAvailability)}</span>
          <span className={`font-bold flex items-center gap-1 ${isAvailabilityHealthy ? "text-emerald-400" : "text-rose-400"}`}>
            {isAvailabilityHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            <span>{isAvailabilityHealthy ? "HEALTHY" : "BREACH"}</span>
          </span>
        </div>
      </div>

      {/* Escrow Remaining */}
      <div className="p-4 rounded-xl bg-cyber-card border border-cyber-border">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-[10px] uppercase font-semibold">Buyer Escrow Remaining</span>
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-emerald-400 mb-1">
          {formatUSDC(contract.currentRemainingEscrow)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Initial: {formatUSDC(contract.serviceFee)}</span>
          <span className="text-gray-400">Locked in Vault</span>
        </div>
      </div>

      {/* Provider Bond & Rebates */}
      <div className="p-4 rounded-xl bg-cyber-card border border-cyber-border">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-[10px] uppercase font-semibold">Provider Bond Active</span>
          <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold text-cyan-400 mb-1">
          {formatUSDC(contract.currentRemainingBond)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Rebated: {formatUSDC(contract.cumulativeRebates)}</span>
          <span className="text-gray-400">Slash: {formatUSDC(contract.cumulativeSlashing)}</span>
        </div>
      </div>
    </div>
  );
}
