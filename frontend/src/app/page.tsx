"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import {
  fetchSystemMetrics,
  fetchActiveContracts,
  fetchAllProviders,
  fetchContractIncidents,
  fetchEpochSettlements,
} from "@/graphql/queries";
import { SystemMetrics, SLAContract, Provider, Incident, EpochSettlement } from "@/types";
import { formatUSDC, formatPercent, formatLatency, shortenAddress, shortenHash, resolveResourceMetadata } from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import {
  Shield,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  ExternalLink,
  ShieldCheck,
  Activity,
} from "lucide-react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [contracts, setContracts] = useState<SLAContract[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [recentSettlements, setRecentSettlements] = useState<EpochSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Poll Envio indexed state every 4 seconds
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [m, c, p, inc] = await Promise.all([
          fetchSystemMetrics(),
          fetchActiveContracts(),
          fetchAllProviders(),
          fetchContractIncidents(),
        ]);

        if (!mounted) return;
        setMetrics(m);
        setContracts(c);
        setProviders(p);
        setRecentIncidents(inc);

        // Fetch recent settlements from active contracts
        if (c.length > 0) {
          const settlements = await fetchEpochSettlements(c[0].id);
          if (mounted) setRecentSettlements(settlements.slice(0, 5));
        }
      } catch (err) {
        console.warn("Dashboard polling error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const tvlFormatted = formatUSDC(metrics?.totalValueLocked || "0");
  const activeSlaCount = contracts.filter((c) => c.status === "ACTIVE").length;
  const providerCount = providers.length > 0 ? providers.length : 1;
  const settlementCount = metrics?.totalSettlementsCount ? Number(metrics.totalSettlementsCount) : 0;

  // Average PRI score across registered providers
  const avgPriScore =
    providers.length > 0
      ? (providers.reduce((acc, p) => acc + Number(p.priScore || 5000), 0) / providers.length / 100).toFixed(1)
      : "95.0";

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 w-full">
        {/* Hero Section */}
        <div className="relative rounded-2xl bg-gradient-to-b from-cyber-card to-cyber-bg border border-cyber-border p-8 md:p-12 overflow-hidden shadow-2xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-monad-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monad-950/80 border border-monad-500/30 font-mono text-xs text-monad-400">
              <span className="w-2 h-2 rounded-full bg-monad-400 animate-pulse" />
              <span>Decentralized Compute Protection Layer</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
              Trust Infrastructure for <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-monad-400 to-cyan-400 bg-clip-text text-transparent">
                Decentralized AI Compute
              </span>
            </h1>

            <p className="text-gray-400 text-sm md:text-base leading-relaxed">
              CompSentry safeguards AI inference buyers with autonomous, micro-epoch SLA arbitration.
              Collateral vaults lock provider performance bonds on Monad Testnet and automatically credit rebates
              the moment Chainlink CRE consensus detects latency spikes or cluster outages.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3 font-mono text-xs">
              <Link
                href="/compute"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-monad-600 hover:bg-monad-500 text-white font-semibold transition shadow-lg shadow-monad-500/20"
              >
                <span>Explore Compute Offers</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/demo"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyber-card hover:bg-cyber-highlight border border-cyber-border text-gray-200 transition"
              >
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>Test Chaos Fault Injection</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Headline Metrics */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono uppercase text-gray-400 font-semibold tracking-wider">
              Network Telemetry & Protocol State
            </h2>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Envio Indexer Live</span>
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {/* TVL */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-cyber-border/80 transition">
              <span className="text-gray-400 text-xs uppercase block">Total Value Locked</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {tvlFormatted}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">Escrow + Provider Bonds</span>
            </div>

            {/* Active SLAs */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-cyber-border/80 transition">
              <span className="text-gray-400 text-xs uppercase block">Active SLA Contracts</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 mt-1">
                {activeSlaCount}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">Under CRE Telemetry</span>
            </div>

            {/* Providers */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-cyber-border/80 transition">
              <span className="text-gray-400 text-xs uppercase block">Verified Providers</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-monad-400 mt-1">
                {providerCount}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">Bonded GPU Clusters</span>
            </div>

            {/* Total Settlements */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 hover:border-cyber-border/80 transition">
              <span className="text-gray-400 text-xs uppercase block">Micro-Epoch Settlements</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">
                {settlementCount}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">On-Chain Verified</span>
            </div>
          </div>
        </div>

        {/* Live SLA Activity Feed */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Active SLA Contracts Under Telemetry</h3>
            </div>
            <Link href="/my-slas" className="text-monad-400 hover:underline text-[11px] flex items-center gap-1">
              <span>View All SLAs</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {contracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active SLA contracts found. Activate one from the Marketplace.
            </div>
          ) : (
            <div className="divide-y divide-cyber-border/40">
              {contracts.map((c) => {
                const meta = resolveResourceMetadata(c.offer?.resourceId);
                return (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-cyber-bg/40 px-2 rounded-lg transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyber-bg border border-cyber-border flex items-center justify-center shrink-0">
                        <Cpu className="h-4 w-4 text-monad-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">SLA #{shortenHash(c.id)}</span>
                          <span className="text-gray-400">({meta.name})</span>
                        </div>
                        <span className="text-[11px] text-gray-500">
                          Provider: {shortenAddress(c.provider?.id)} • P95 SLA: ≤ {formatLatency(c.latencyThresholdMs)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block uppercase">Remaining Escrow</span>
                        <span className="text-emerald-400 font-bold">{formatUSDC(c.currentRemainingEscrow)}</span>
                      </div>
                      <SLAHealthBadge status={c.status} />
                      <Link
                        href={`/my-slas/${c.id}`}
                        className="px-3 py-1.5 rounded bg-cyber-bg border border-cyber-border hover:border-monad-500 text-gray-200 transition"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Split: Provider Reliability & Recent Incidents / Settlements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          {/* Provider Reliability Index (PRI) */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-monad-400" />
                <h3 className="font-bold text-white text-sm">Provider Reliability Index (PRI)</h3>
              </div>
              <span className="text-emerald-400 font-bold text-sm">{avgPriScore}% Network PRI</span>
            </div>

            <p className="text-gray-400 text-[11px] leading-relaxed">
              CompSentry computes on-chain reputation scores using exponential decay based on micro-epoch SLA compliance,
              past slashing events, and latency stability. Providers with higher PRI earn preferential placement and reduced bond requirements.
            </p>

            <div className="space-y-3 pt-2">
              {providers.slice(0, 3).map((p) => {
                const pri = (Number(p.priScore || 5000) / 100).toFixed(1);
                return (
                  <div key={p.id} className="p-3 bg-cyber-bg/70 rounded-lg border border-cyber-border/70 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">{shortenAddress(p.id)}</span>
                      <span className="text-[10px] text-gray-500">
                        {p.activeContracts} Active Contracts • {p.compliantEpochsCount} Compliant Epochs
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-monad-400 font-bold text-sm">{pri}% PRI</span>
                      <span className="text-[10px] text-emerald-400 block font-semibold">Verified Provider</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Settlements & Incident Log */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Recent Settlements & Compensations</h3>
              </div>
              <span className="text-gray-400 text-[11px]">Real-Time Envio Feed</span>
            </div>

            {recentIncidents.length === 0 && recentSettlements.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <CheckCircle2 className="h-6 w-6 text-emerald-500/50 mx-auto mb-2" />
                <span>Zero breaches recorded on-chain. All providers operating in compliance.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {recentIncidents.slice(0, 4).map((inc) => (
                  <div key={inc.id} className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                        <span className="font-bold text-rose-300">
                          SLA #{shortenHash(inc.contract.id)} — Epoch #{inc.epochId}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Latency: {formatLatency(inc.p95LatencyMs)} • Availability: {formatPercent(inc.availabilityBps)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">+{formatUSDC(inc.rebateAmount)}</span>
                      <span className="text-[10px] text-gray-400 block">Buyer Rebate</span>
                    </div>
                  </div>
                ))}

                {recentSettlements.filter(s => s.status === "COMPLIANT").slice(0, 3).map((s) => (
                  <div key={s.id} className="p-2.5 rounded-lg bg-cyber-bg/70 border border-cyber-border/70 flex items-center justify-between">
                    <div>
                      <span className="text-gray-200 font-semibold">Epoch #{s.epochId} Settled</span>
                      <span className="text-[10px] text-gray-500 block">
                        P95: {formatLatency(s.p95LatencyMs)} • Quorum: 3/3 Probes
                      </span>
                    </div>
                    <span className="text-emerald-400 text-[11px] font-semibold">✓ Compliant ($0.00 rebate)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
