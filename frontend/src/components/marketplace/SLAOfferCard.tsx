import React from "react";
import Link from "next/link";
import { SLAOffer } from "@/types";
import { formatUSDC, formatPercent, formatLatency, shortenAddress, resolveResourceMetadata } from "@/lib/formatting";
import { Cpu, Shield, ArrowRight, Activity, Zap, Server } from "lucide-react";

interface SLAOfferCardProps {
  offer: SLAOffer;
}

export function SLAOfferCard({ offer }: SLAOfferCardProps) {
  const metadata = resolveResourceMetadata(offer.resourceId);
  const priScore = Number(offer.provider?.priScore || 5000);
  const priPercent = (priScore / 100).toFixed(1);

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-monad-500/50 hover:shadow-xl hover:shadow-monad-500/5 transition flex flex-col justify-between group">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyber-bg border border-cyber-border flex items-center justify-center group-hover:border-monad-500/40 transition">
              <Server className="h-4 w-4 text-monad-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-tight">{metadata.name}</h3>
              <span className="text-[11px] font-mono text-gray-400">
                Resource: <span className="text-gray-300">{metadata.tag}</span>
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-semibold">
            ● AVAILABLE
          </span>
        </div>

        {/* Pricing & Epochs Banner */}
        <div className="bg-cyber-bg/80 border border-cyber-border/80 rounded-lg p-3 my-3.5 flex items-baseline justify-between font-mono">
          <div>
            <span className="text-xs text-gray-400 block text-[10px] uppercase">Service Fee</span>
            <span className="text-base font-bold text-emerald-400">{formatUSDC(offer.serviceFee)}</span>
            <span className="text-[11px] text-gray-500"> / SLA</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block text-[10px] uppercase">Epoch Schedule</span>
            <span className="text-xs text-gray-200">
              {offer.epochDuration}s × {offer.totalEpochs} epochs
            </span>
          </div>
        </div>

        {/* SLA Commitments */}
        <div className="space-y-2 py-1 font-mono text-xs">
          <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
            <span className="text-gray-400">Availability SLA</span>
            <span className="text-white font-semibold">≥ {formatPercent(offer.availabilityThresholdBps)}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
            <span className="text-gray-400">P95 Latency SLA</span>
            <span className="text-white font-semibold">≤ {formatLatency(offer.latencyThresholdMs)}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
            <span className="text-gray-400">Provider Bond</span>
            <span className="text-cyan-400 font-semibold">{formatPercent(offer.bondBps)}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-gray-400">Provider PRI</span>
            <span className="text-monad-400 font-semibold">{priPercent}% Reliability</span>
          </div>
        </div>
      </div>

      {/* Card Action */}
      <div className="pt-4 mt-2 border-t border-cyber-border">
        <Link
          href={`/compute/${offer.id}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyber-bg hover:bg-monad-600 border border-cyber-border hover:border-monad-500 text-white font-mono text-xs font-semibold transition group-hover:bg-monad-600/90"
        >
          <span>View SLA & Protection Terms</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
        </Link>
      </div>
    </div>
  );
}
