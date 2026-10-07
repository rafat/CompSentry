"use client";

import React, { useState } from "react";
import { EpochSettlement } from "@/types";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { formatLatency, formatPercent, formatUSDC, shortenHash, formatTimestamp } from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import { ChevronDown, ChevronRight, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle, Layers } from "lucide-react";

interface EpochTableProps {
  settlements: EpochSettlement[];
}

export function EpochTable({ settlements }: EpochTableProps) {
  const [expandedEpoch, setExpandedEpoch] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEpoch(expandedEpoch === id ? null : id);
  };

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-monad-400" />
          <h2 className="font-bold text-white text-sm">Recent Epoch Settlements</h2>
        </div>
        <span className="text-gray-400 text-[11px]">
          {settlements.length} Epoch{settlements.length === 1 ? "" : "s"} Indexed
        </span>
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-cyber-bg/50 rounded-lg border border-cyber-border/60">
          <CheckCircle2 className="h-6 w-6 text-emerald-500/50 mx-auto mb-2" />
          <p className="font-semibold text-gray-300">Contract In Initial Monitoring Phase</p>
          <p className="text-[11px] text-gray-500 max-w-sm mx-auto mt-1">
            As Chainlink CRE completes micro-epoch consensus and posts to Monad Testnet, verified settlements will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-[10px] uppercase border-b border-cyber-border/70">
                <th className="py-2.5 px-3">Epoch</th>
                <th className="py-2.5 px-3">P95 Latency</th>
                <th className="py-2.5 px-3">Availability</th>
                <th className="py-2.5 px-3">Consensus Result</th>
                <th className="py-2.5 px-3">Buyer Rebate</th>
                <th className="py-2.5 px-3">Bond Slash</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-border/40">
              {settlements.map((epoch) => {
                const isExpanded = expandedEpoch === epoch.id;
                const isBreach = epoch.status === "BREACHED";

                return (
                  <React.Fragment key={epoch.id}>
                    <tr
                      onClick={() => toggleExpand(epoch.id)}
                      className={`hover:bg-cyber-bg/70 cursor-pointer transition ${
                        isExpanded ? "bg-cyber-bg" : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-white">#{epoch.epochId}</td>
                      <td className={`py-3 px-3 ${isBreach ? "text-rose-400 font-bold" : "text-gray-200"}`}>
                        {formatLatency(epoch.p95LatencyMs)}
                      </td>
                      <td className="py-3 px-3 text-gray-200">
                        {formatPercent(epoch.availabilityBps)}
                      </td>
                      <td className="py-3 px-3">
                        <SLAHealthBadge status={epoch.status} />
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">
                        {Number(epoch.rebateAmount) > 0 ? formatUSDC(epoch.rebateAmount) : "—"}
                      </td>
                      <td className="py-3 px-3 text-rose-400 font-semibold">
                        {Number(epoch.slashingAmount) > 0 ? formatUSDC(epoch.slashingAmount) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-400">
                        <button className="p-1 hover:text-white">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Audit Card */}
                    {isExpanded && (
                      <tr className="bg-cyber-bg/95">
                        <td colSpan={7} className="p-4 border-b border-cyber-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-cyber-card rounded-lg border border-cyber-border/70 text-[11px]">
                            <div>
                              <span className="text-gray-500 uppercase block text-[10px]">Evidence Commitment</span>
                              <span className="text-cyan-400 font-bold break-all">
                                {shortenHash(epoch.evidenceHash)}
                              </span>
                            </div>

                            <div>
                              <span className="text-gray-500 uppercase block text-[10px]">Observer Quorum</span>
                              <span className="text-white font-bold">3 / 3 Probes Agreed</span>
                            </div>

                            <div>
                              <span className="text-gray-500 uppercase block text-[10px]">Delivered Inference Units</span>
                              <span className="text-white font-bold">{epoch.deliveredUnits} Requests</span>
                            </div>

                            <div>
                              <span className="text-gray-500 uppercase block text-[10px]">Monad Settlement Tx</span>
                              <a
                                href={COMPSENTRY.explorer.txUrl(epoch.txHash)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-monad-400 hover:underline flex items-center gap-1 font-bold"
                              >
                                <span>{shortenHash(epoch.txHash)}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
