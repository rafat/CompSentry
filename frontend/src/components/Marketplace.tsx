"use client";

import React, { useState } from "react";
import { Server, Zap, ShieldCheck, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { SLAOfferData } from "@/lib/api";

interface MarketplaceProps {
  onSelectOffer: (offerId: string) => void;
  activeContractId: string | null;
}

const SAMPLE_OFFERS = [
  {
    id: "0x4c6c616d612d332d373062000000000000000000000000000000000000000001",
    modelName: "vLLM — Llama 3 70B Instruct",
    hardware: "4x NVIDIA H100 80GB SXM5",
    providerName: "HyperCompute Cluster-01",
    providerAddr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    priScore: 9840, // 98.4%
    latencyThresholdMs: 120,
    availabilityThresholdBps: 9950, // 99.5%
    serviceFeeUsdc: "100.00",
    bondPercent: 20,
    epochDurationSec: 30,
    totalEpochs: 20,
  },
  {
    id: "0x446565705365656b2d52312d3637316200000000000000000000000000000002",
    modelName: "DeepSeek R1 671B (FP8 MoE)",
    hardware: "8x NVIDIA H100 80GB SXM5",
    providerName: "Aetheria Decentralized Node",
    providerAddr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    priScore: 9920, // 99.2%
    latencyThresholdMs: 250,
    availabilityThresholdBps: 9980, // 99.8%
    serviceFeeUsdc: "250.00",
    bondPercent: 25,
    epochDurationSec: 30,
    totalEpochs: 30,
  },
  {
    id: "0x4d69737472616c2d4c617267652d320000000000000000000000000000000003",
    modelName: "Mistral Large 2 (123B)",
    hardware: "4x NVIDIA A100 80GB PCIe",
    providerName: "NodeOps Genesis",
    providerAddr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    priScore: 9550, // 95.5%
    latencyThresholdMs: 180,
    availabilityThresholdBps: 9900, // 99.0%
    serviceFeeUsdc: "80.00",
    bondPercent: 15,
    epochDurationSec: 30,
    totalEpochs: 15,
  }
];

export function Marketplace({ onSelectOffer, activeContractId }: MarketplaceProps) {
  const [selectedOfferId, setSelectedOfferId] = useState(SAMPLE_OFFERS[0].id);
  const [isDeploying, setIsDeploying] = useState(false);

  const handleActivate = (offerId: string) => {
    setSelectedOfferId(offerId);
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      onSelectOffer(offerId);
    }, 1200);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 text-monad-500" />
            <span>Verified AI Compute Marketplace</span>
          </h2>
          <p className="text-xs text-gray-400">
            Select a high-performance GPU cluster with cryptographically enforced SLA collateral on Monad.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SAMPLE_OFFERS.map((offer) => {
          const isSelected = selectedOfferId === offer.id;
          return (
            <div
              key={offer.id}
              className={`relative bg-cyber-card rounded-xl border p-5 transition flex flex-col justify-between ${
                isSelected
                  ? "border-monad-500 ring-1 ring-monad-500/50 shadow-lg shadow-monad-500/10"
                  : "border-cyber-border hover:border-cyber-highlight"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">{offer.modelName}</h3>
                    <p className="text-xs text-monad-400 font-mono mt-0.5">{offer.hardware}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                    <ShieldCheck className="h-3 w-3" />
                    <span>PRI {(offer.priScore / 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* SLA Specifications */}
                <div className="grid grid-cols-2 gap-2 my-4 text-xs font-mono bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border">
                  <div>
                    <span className="text-gray-400 block text-[10px]">P95 LATENCY SLA</span>
                    <span className="text-emerald-400 font-semibold">&lt; {offer.latencyThresholdMs} ms</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">AVAILABILITY SLA</span>
                    <span className="text-emerald-400 font-semibold">{(offer.availabilityThresholdBps / 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-400 block text-[10px]">EPOCH DURATION</span>
                    <span className="text-gray-200">{offer.epochDurationSec}s Micro-Epoch</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-400 block text-[10px]">PROVIDER BOND</span>
                    <span className="text-monad-400 font-semibold">{offer.bondPercent}% Staked</span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>Independent Chainlink CRE Verification</span>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-cyber-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400">Total Escrow: </span>
                  <span className="text-sm font-bold text-white font-mono">${offer.serviceFeeUsdc} USDC</span>
                </div>
                <button
                  onClick={() => handleActivate(offer.id)}
                  disabled={isDeploying}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    isSelected
                      ? "bg-monad-600 hover:bg-monad-500 text-white shadow-md shadow-monad-600/30"
                      : "bg-cyber-highlight hover:bg-cyber-border text-gray-200"
                  }`}
                >
                  {isDeploying && isSelected ? (
                    <span>Activating...</span>
                  ) : (
                    <>
                      <span>Activate SLA</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
