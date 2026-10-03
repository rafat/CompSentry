"use client";

import React, { useEffect, useState } from "react";
import { Clock, Shield, Activity, Coins, CheckCircle, AlertTriangle, Cpu, Radio, Hash, Copy, Check } from "lucide-react";

interface ActiveContractCockpitProps {
  scenario: "normal" | "latency" | "outage" | "desync";
  currentEpoch: number;
}

export function ActiveContractCockpit({ scenario, currentEpoch }: ActiveContractCockpitProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [copiedHash, setCopiedHash] = useState(false);

  // 30s countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live simulated observer readings based on active scenario
  const getObserverData = () => {
    switch (scenario) {
      case "latency":
        return [
          { name: "Provider Probe (:4001)", latency: 450, avail: 100, isOutlier: false },
          { name: "Independent Probe (:4002)", latency: 462, avail: 100, isOutlier: false },
          { name: "Secondary Probe (:4003)", latency: 455, avail: 100, isOutlier: false },
        ];
      case "outage":
        return [
          { name: "Provider Probe (:4001)", latency: 0, avail: 0, isOutlier: false },
          { name: "Independent Probe (:4002)", latency: 0, avail: 0, isOutlier: false },
          { name: "Secondary Probe (:4003)", latency: 0, avail: 0, isOutlier: false },
        ];
      case "desync":
        return [
          { name: "Provider Probe (:4001)", latency: 68, avail: 100, isOutlier: false },
          { name: "Independent Probe (:4002)", latency: 480, avail: 85, isOutlier: true }, // Outlier neutralized by CRE!
          { name: "Secondary Probe (:4003)", latency: 71, avail: 100, isOutlier: false },
        ];
      case "normal":
      default:
        return [
          { name: "Provider Probe (:4001)", latency: 68, avail: 100, isOutlier: false },
          { name: "Independent Probe (:4002)", latency: 74, avail: 100, isOutlier: false },
          { name: "Secondary Probe (:4003)", latency: 70, avail: 100, isOutlier: false },
        ];
    }
  };

  const observers = getObserverData();

  // CRE Consensus result
  const consensusMedianLatency =
    scenario === "desync"
      ? 70 // Median of 68 and 71 with 480 neutralized
      : scenario === "latency"
      ? 455
      : scenario === "outage"
      ? 0
      : 70;

  const consensusAvail = scenario === "outage" ? 0 : 100;
  const isBreached = scenario === "latency" || scenario === "outage";
  const evidenceHash =
    scenario === "normal"
      ? "0x9e61b309435ff4306d0e68c40b4989b780fed839d1e48fda57ad58d937612123"
      : scenario === "desync"
      ? "0x78ab221f009384bcda88910472658190dabbcef9912085734298174620482103"
      : "0x3f5c928410294827019283746592019283746501928374650192837465019283";

  const handleCopyHash = () => {
    navigator.clipboard.writeText(evidenceHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-xl space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">CONTRACT:</span>
            <span className="font-mono text-xs text-white bg-cyber-bg px-2 py-0.5 rounded border border-cyber-border">
              0x1b25...39f0
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">vLLM Llama-3-70B Live SLA Cockpit</h2>
        </div>

        {/* 30s Countdown Ring */}
        <div className="flex items-center gap-3 bg-cyber-bg border border-cyber-border px-4 py-2 rounded-xl">
          <Clock className="h-4 w-4 text-monad-500 animate-spin" style={{ animationDuration: "6s" }} />
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase">Settlement Countdown</div>
            <div className="text-sm font-bold font-mono text-white">
              Epoch {currentEpoch} • <span className="text-monad-500">{secondsRemaining}s</span> / 30s
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Custody Ledger & Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">BUYER ESCROW REMAINING</span>
          <span className="text-sm font-bold text-emerald-400">$85.00 USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">of $100.00 deposited</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">PROVIDER BOND LOCKED</span>
          <span className="text-sm font-bold text-monad-400">$19.00 USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">of $20.00 bonded (20%)</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">ACCRUED REBATES</span>
          <span className="text-sm font-bold text-amber-400">$15.00 USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">Returned to Buyer</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">SLASHED BOND</span>
          <span className="text-sm font-bold text-rose-400">$1.00 USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">Compensated to Buyer</span>
        </div>
      </div>

      {/* 3-Observer Probes Telemetry Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-semibold text-gray-300 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>3-OBSERVER INDEPENDENT TELEMETRY PROBES</span>
          </h3>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
            Fail-Closed Verification
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {observers.map((obs, idx) => (
            <div
              key={idx}
              className={`bg-cyber-bg border rounded-lg p-3.5 transition ${
                obs.isOutlier
                  ? "border-rose-500/80 bg-rose-950/10 ring-1 ring-rose-500/40"
                  : "border-cyber-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-300 font-semibold">{obs.name}</span>
                {obs.isOutlier ? (
                  <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                    OUTLIER REJECTED
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verified
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block">P95 LATENCY</span>
                  <span
                    className={`font-bold ${
                      obs.latency > 120 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {obs.latency} ms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">AVAILABILITY</span>
                  <span
                    className={`font-bold ${
                      obs.avail < 99 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {obs.avail.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chainlink CRE Consensus & Evidence Commitment */}
      <div className="bg-gradient-to-r from-cyber-bg via-monad-900/10 to-cyber-bg border border-monad-500/40 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Chainlink CRE DON Consensus Aggregation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              Quorum: 3/3 Valid Nodes
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                isBreached
                  ? "bg-rose-950/80 text-rose-400 border-rose-500/40"
                  : "bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
              }`}
            >
              Status: {isBreached ? "SLA BREACHED" : "COMPLIANT"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs pt-1">
          <div>
            <span className="text-gray-400 text-[10px] block">MEDIAN P95 LATENCY</span>
            <span className="text-white font-bold">{consensusMedianLatency} ms (SLA &lt; 120 ms)</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">CONSENSUS AVAILABILITY</span>
            <span className="text-white font-bold">{consensusAvail.toFixed(1)}% (SLA 99.5%)</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">SETTLEMENT OUTCOME</span>
            <span className={isBreached ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
              {scenario === "latency"
                ? "Rebate: $15.00 USDC • Slash: $0.00"
                : scenario === "outage"
                ? "Rebate: $25.00 USDC • Slash: $1.00"
                : "Full Fee Earned ($5.00 USDC)"}
            </span>
          </div>
        </div>

        {/* Cryptographic Evidence Hash */}
        <div className="pt-2 border-t border-cyber-border flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 truncate">
            <Hash className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-400 text-[11px]">EVIDENCE HASH:</span>
            <span className="text-monad-400 text-[11px] truncate">{evidenceHash}</span>
          </div>
          <button
            onClick={handleCopyHash}
            className="text-gray-400 hover:text-white flex items-center gap-1 text-[11px] shrink-0 ml-2 bg-cyber-card px-2 py-1 rounded border border-cyber-border transition"
          >
            {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copiedHash ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
