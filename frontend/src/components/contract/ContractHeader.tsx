import React from "react";
import { SLAContract } from "@/types";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { shortenAddress, shortenHash, resolveResourceMetadata, formatTimestamp } from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import { ExternalLink, Clock, ShieldCheck, User, Server } from "lucide-react";

interface ContractHeaderProps {
  contract: SLAContract;
}

export function ContractHeader({ contract }: ContractHeaderProps) {
  const metadata = resolveResourceMetadata(contract.offer?.resourceId);
  const totalEpochs = Number(contract.totalEpochs || 20);
  const settledEpochs = Number(contract.settledEpochsCount || 0);
  const progressPercent = Math.min(100, Math.round((settledEpochs / totalEpochs) * 100));

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono tracking-tight">
              SLA Contract #{shortenHash(contract.id)}
            </h1>
            <SLAHealthBadge status={contract.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-400">
            <span className="text-gray-200 font-semibold">{metadata.name}</span>
            <span>•</span>
            <span>Hardware: {metadata.hardware}</span>
          </div>
        </div>

        {/* Monad Explorer Link */}
        <a
          href={COMPSENTRY.explorer.txUrl(contract.id)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyber-bg border border-cyber-border hover:border-monad-500 text-cyan-400 font-mono text-xs transition self-start sm:self-auto"
        >
          <span>MonadVision Explorer</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Progress & Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-cyber-bg/70 border border-cyber-border/70 rounded-lg p-3">
          <span className="text-[10px] text-gray-400 uppercase block">Epoch Progress</span>
          <div className="flex items-baseline justify-between mt-1 mb-2">
            <span className="text-white font-bold text-sm">
              Epoch {settledEpochs} / {totalEpochs}
            </span>
            <span className="text-gray-400 text-[11px]">{progressPercent}%</span>
          </div>
          <div className="w-full bg-cyber-card rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-monad-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-cyber-bg/70 border border-cyber-border/70 rounded-lg p-3">
          <span className="text-[10px] text-gray-400 uppercase block">Provider Node</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Server className="h-3.5 w-3.5 text-monad-400 shrink-0" />
            <a
              href={COMPSENTRY.explorer.addressUrl(contract.provider?.id)}
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-monad-400 font-semibold truncate transition"
            >
              {shortenAddress(contract.provider?.id)}
            </a>
          </div>
          <span className="text-[10px] text-gray-500 block mt-1">
            PRI Reliability: {(Number(contract.provider?.priScore || 5000) / 100).toFixed(1)}%
          </span>
        </div>

        <div className="bg-cyber-bg/70 border border-cyber-border/70 rounded-lg p-3">
          <span className="text-[10px] text-gray-400 uppercase block">Buyer Account</span>
          <div className="flex items-center gap-1.5 mt-1">
            <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <a
              href={COMPSENTRY.explorer.addressUrl(contract.buyer?.id)}
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-cyan-400 font-semibold truncate transition"
            >
              {shortenAddress(contract.buyer?.id)}
            </a>
          </div>
          <span className="text-[10px] text-gray-500 block mt-1">
            Created: {formatTimestamp(contract.startTimestamp)}
          </span>
        </div>

        <div className="bg-cyber-bg/70 border border-cyber-border/70 rounded-lg p-3">
          <span className="text-[10px] text-gray-400 uppercase block">Micro-Epoch Cadence</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-white font-bold text-sm">{contract.epochDuration} Seconds</span>
          </div>
          <span className="text-[10px] text-gray-500 block mt-1">Autonomous Settlement</span>
        </div>
      </div>
    </div>
  );
}
