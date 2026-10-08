"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { fetchActiveContracts } from "@/graphql/queries";
import { SLAContract } from "@/types";
import {
  formatUSDC,
  formatLatency,
  formatPercent,
  shortenAddress,
  shortenHash,
  resolveResourceMetadata,
} from "@/lib/formatting";
import { useAccount } from "wagmi";
import { Shield, ArrowRight, Server, Layers, Cpu, CheckCircle2, Clock } from "lucide-react";

export default function MySLAsPage() {
  const { address } = useAccount();
  const [contracts, setContracts] = useState<SLAContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await fetchActiveContracts();
        if (mounted) setContracts(data);
      } catch (err) {
        console.warn("Failed to load contracts:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-cyber-border">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
              My SLA Contracts
            </h1>
            <p className="text-gray-400 text-sm">
              Active and settled compute performance agreements under autonomous Chainlink CRE arbitration.
            </p>
          </div>

          <Link
            href="/compute"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-monad-600 hover:bg-monad-500 text-white font-mono text-xs font-semibold self-start md:self-auto transition"
          >
            <span>Activate New Compute SLA</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Contract List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-cyber-card border border-cyber-border animate-pulse" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-16 bg-cyber-card border border-cyber-border rounded-xl p-8 space-y-4 font-mono">
            <Shield className="h-10 w-10 text-gray-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No SLA Contracts Found</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              You do not have any active compute SLA contracts yet. Browse the marketplace to activate a bonded GPU cluster.
            </p>
            <Link
              href="/compute"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-monad-600 text-white text-xs font-semibold"
            >
              Explore Compute Offers
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {contracts.map((c) => {
              const meta = resolveResourceMetadata(c.offer?.resourceId);
              const totalEpochs = Number(c.totalEpochs || 20);
              const settledEpochs = Number(c.settledEpochsCount || 0);
              const progress = Math.min(100, Math.round((settledEpochs / totalEpochs) * 100));

              const isBuyerAccount = address && c.buyer?.id?.toLowerCase() === address.toLowerCase();

              return (
                <div
                  key={c.id}
                  className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-monad-500/50 hover:shadow-xl hover:shadow-monad-500/5 transition flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">SLA #{shortenHash(c.id)}</span>
                          {isBuyerAccount && (
                            <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-semibold">
                              MY ORDER
                            </span>
                          )}
                        </div>
                        <span className="text-gray-300 font-semibold text-xs block mt-0.5">{meta.name}</span>
                        <span className="text-[11px] text-gray-500">Provider: {shortenAddress(c.provider?.id)}</span>
                      </div>
                      <SLAHealthBadge status={c.status} />
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70 space-y-1.5">
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-gray-400">
                          Epoch Progress: <strong className="text-white">{settledEpochs} / {totalEpochs}</strong>
                        </span>
                        <span className="text-cyan-400 font-semibold">{progress}%</span>
                      </div>
                      <div className="w-full bg-cyber-card rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-monad-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Telemetry & SLA Thresholds */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                      <div className="bg-cyber-bg/50 p-2 rounded border border-cyber-border/50">
                        <span className="text-gray-500 text-[10px] uppercase block">Latency Limit</span>
                        <span className="text-white font-bold">≤ {formatLatency(c.latencyThresholdMs)}</span>
                      </div>
                      <div className="bg-cyber-bg/50 p-2 rounded border border-cyber-border/50">
                        <span className="text-gray-500 text-[10px] uppercase block">Availability Min</span>
                        <span className="text-white font-bold">≥ {formatPercent(c.availabilityThresholdBps)}</span>
                      </div>
                    </div>

                    {/* Balances */}
                    <div className="flex items-center justify-between pt-2 border-t border-cyber-border/60 text-[11px]">
                      <div>
                        <span className="text-gray-500 text-[10px] uppercase block">Escrow Remaining</span>
                        <span className="text-emerald-400 font-bold">{formatUSDC(c.currentRemainingEscrow)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 text-[10px] uppercase block">Rebates Received</span>
                        <span className="text-cyan-400 font-bold">{formatUSDC(c.cumulativeRebates)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="pt-4 mt-2">
                    <Link
                      href={`/my-slas/${c.id}`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-cyber-bg hover:bg-monad-600 border border-cyber-border hover:border-monad-500 text-white font-semibold transition"
                    >
                      <span>View Live Monitoring & Audit</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
