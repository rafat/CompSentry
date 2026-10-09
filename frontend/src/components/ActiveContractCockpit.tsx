"use client";

import React, { useEffect, useState } from "react";
import { Clock, Shield, Activity, Coins, CheckCircle, AlertTriangle, Cpu, Radio, Hash, Copy, Check, ExternalLink } from "lucide-react";
import { SLAContractData } from "@/lib/api";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

interface ActiveContractCockpitProps {
  contract: SLAContractData | null;
  scenario: "normal" | "latency" | "outage" | "desync";
  currentEpoch: number;
}

const CATALOG_METADATA: Record<string, { modelName: string; hardware: string }> = {
  "0xf37913391db8ae88e6202ba99fc5299a7d4dd5c992fddcfea2ad6579d269ffe2": {
    modelName: "vLLM — Llama 3 70B Instruct",
    hardware: "4x NVIDIA H100 80GB SXM5",
  },
  "0x892a083f2dc57fbf6b4bf0f1c6fe90fae00508f6580f48ca090e94bb519e4fc4": {
    modelName: "DeepSeek R1 671B (FP8 MoE)",
    hardware: "8x NVIDIA H100 80GB SXM5",
  },
  "0xb81c7ff683d73634351ea9e29f4585cb78848db90fb69e8533c373a0df4c0840": {
    modelName: "Mistral Large 2 (123B)",
    hardware: "4x NVIDIA A100 80GB PCIe",
  },
};

export function ActiveContractCockpit({ contract, scenario, currentEpoch }: ActiveContractCockpitProps) {
  const epochDuration = Number(contract?.epochDuration || 30);
  const [secondsRemaining, setSecondsRemaining] = useState(epochDuration);
  const [copiedHash, setCopiedHash] = useState(false);

  // Epoch countdown timer
  useEffect(() => {
    setSecondsRemaining(epochDuration);
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? epochDuration : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [epochDuration]);

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
          { name: "Independent Probe (:4002)", latency: 480, avail: 85, isOutlier: true }, // Neutralized by consensus
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

  const consensusMedianLatency =
    scenario === "desync"
      ? 70
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

  if (!contract) {
    return (
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-8 text-center space-y-4 shadow-xl">
        <Activity className="h-10 w-10 text-monad-400 mx-auto animate-pulse" />
        <h3 className="text-base font-bold text-white">No Active SLA Contract Selected</h3>
        <p className="text-xs text-gray-400 max-w-lg mx-auto">
          There are currently no active SLA contracts under monitoring. Select any GPU cluster from the marketplace below and click <span className="text-monad-400 font-semibold">Activate SLA</span> to lock performance bond collateral on Monad Testnet and initiate real-time telemetry.
        </p>
      </div>
    );
  }

  const resourceId = contract.offer?.resourceId || "";
  const modelMeta = CATALOG_METADATA[resourceId] || {
    modelName: "Custom GPU Model",
    hardware: "NVIDIA Accelerator",
  };

  const remainingEscrowUsdc = (Number(contract.currentRemainingEscrow) / 1e6).toFixed(2);
  const totalServiceFeeUsdc = (Number(contract.serviceFee) / 1e6).toFixed(2);
  const remainingBondUsdc = (Number(contract.currentRemainingBond) / 1e6).toFixed(2);
  const totalBondUsdc = (Number(contract.providerBond) / 1e6).toFixed(2);
  const rebatesUsdc = (Number(contract.cumulativeRebates || 0) / 1e6).toFixed(2);
  const slashedUsdc = (Number(contract.cumulativeSlashing || 0) / 1e6).toFixed(2);

  const contractShortId = `${contract.id.slice(0, 6)}...${contract.id.slice(-4)}`;

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-xl space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">CONTRACT:</span>
            <a
              href={`https://testnet.monadscan.com/address/${CONTRACT_ADDRESSES.hub}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-cyan-400 hover:text-cyan-300 bg-cyber-bg px-2 py-0.5 rounded border border-cyber-border flex items-center gap-1 transition"
            >
              <span>{contractShortId}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              {contract.status}
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">{modelMeta.modelName} Live SLA Cockpit</h2>
        </div>

        {/* Countdown Ring */}
        <div className="flex items-center gap-3 bg-cyber-bg border border-cyber-border px-4 py-2 rounded-xl">
          <Clock className="h-4 w-4 text-monad-500 animate-spin" style={{ animationDuration: "6s" }} />
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase">Settlement Countdown</div>
            <div className="text-sm font-bold font-mono text-white">
              Epoch {currentEpoch} • <span className="text-monad-500">{secondsRemaining}s</span> / {epochDuration}s
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Custody Ledger & Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">BUYER ESCROW REMAINING</span>
          <span className="text-sm font-bold text-emerald-400">${remainingEscrowUsdc} USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">of ${totalServiceFeeUsdc} deposited</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">PROVIDER BOND LOCKED</span>
          <span className="text-sm font-bold text-monad-400">${remainingBondUsdc} USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">of ${totalBondUsdc} bonded</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">ACCRUED REBATES</span>
          <span className="text-sm font-bold text-amber-400">${rebatesUsdc} USDC</span>
          <span className="text-[10px] text-gray-500 block mt-1">Returned to Buyer</span>
        </div>

        <div className="bg-cyber-bg border border-cyber-border rounded-lg p-3">
          <span className="text-[10px] text-gray-400 block">SLASHED BOND</span>
          <span className="text-sm font-bold text-rose-400">${slashedUsdc} USDC</span>
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
            Decentralized Verification
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
                  <span className="text-[10px] text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/30">
                    OUTLIER REJECTED
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    QUORUM OK
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block text-[10px]">P95 LATENCY</span>
                  <span className={`font-bold ${obs.latency > 120 || obs.latency === 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {obs.latency === 0 ? "TIMEOUT" : `${obs.latency} ms`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">AVAILABILITY</span>
                  <span className={`font-bold ${obs.avail < 99 ? "text-rose-400" : "text-emerald-400"}`}>
                    {obs.avail.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chainlink CRE Consensus Proof & SLASettlement Ledger */}
      <div className="bg-cyber-bg border border-cyber-border rounded-xl p-4 space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-monad-400" />
            <span className="text-xs font-bold text-white">CHAINLINK CRE CONSENSUS PROOF</span>
            <span className="text-[10px] text-gray-400 bg-cyber-card px-2 py-0.5 rounded border border-cyber-border">
              DON Quorum: 3/3
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">EVIDENCE HASH:</span>
            <div className="flex items-center gap-1 bg-cyber-card px-2 py-1 rounded border border-cyber-border text-[11px] text-gray-300">
              <span>{evidenceHash.slice(0, 10)}...{evidenceHash.slice(-8)}</span>
              <button onClick={handleCopyHash} className="hover:text-white transition">
                {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-cyber-border text-xs">
          <div>
            <span className="text-[10px] text-gray-500 block">MEDIAN P95 LATENCY</span>
            <span className={`font-bold ${consensusMedianLatency > 120 || consensusMedianLatency === 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {consensusMedianLatency === 0 ? "TIMEOUT" : `${consensusMedianLatency} ms`}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block">MEDIAN AVAILABILITY</span>
            <span className={`font-bold ${consensusAvail < 99 ? "text-rose-400" : "text-emerald-400"}`}>
              {consensusAvail.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block">EPOCH EVALUATION</span>
            {isBreached ? (
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                SLA BREACHED
              </span>
            ) : (
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                SLA COMPLIANT
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] text-gray-500 block">ON-CHAIN ACTION</span>
            <span className="font-bold text-white">
              {scenario === "outage"
                ? "Slashing & Rebate"
                : scenario === "latency"
                ? "Buyer Rebate"
                : "Fee Earned"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
