"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { fetchAllProviders, fetchActiveContracts } from "@/graphql/queries";
import { Provider, SLAContract } from "@/types";
import {
  formatUSDC,
  formatPercent,
  shortenAddress,
  shortenHash,
  resolveResourceMetadata,
} from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import { useAccount } from "wagmi";
import {
  Server,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Layers,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

export default function ProviderDashboardPage() {
  const { address } = useAccount();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [contracts, setContracts] = useState<SLAContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProviderData() {
      try {
        const [p, c] = await Promise.all([fetchAllProviders(), fetchActiveContracts()]);
        if (!mounted) return;
        setProviders(p);
        setContracts(c);
      } catch (err) {
        console.warn("Failed to load provider metrics:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProviderData();
    const interval = setInterval(loadProviderData, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Find active provider matching connected wallet, or fallback to the primary indexed provider
  const currentProvider =
    providers.find((p) => address && p.id.toLowerCase() === address.toLowerCase()) ||
    providers[0] ||
    null;

  const priPercent = currentProvider ? (Number(currentProvider.priScore || 5000) / 100).toFixed(1) : "95.0";

  // Provider's contracts
  const providerContracts = currentProvider
    ? contracts.filter((c) => c.provider?.id?.toLowerCase() === currentProvider.id.toLowerCase())
    : contracts;

  const compliantEpochs = Number(currentProvider?.compliantEpochsCount || 0);
  const breachCount = Number(currentProvider?.breachCount || 0);
  const totalEvaluated = compliantEpochs + breachCount;
  const complianceRate = totalEvaluated > 0 ? ((compliantEpochs / totalEvaluated) * 100).toFixed(1) : "100.0";

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Header (Section 11) */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-monad-400 bg-monad-950 px-2 py-0.5 rounded border border-monad-500/30">
                GPU PROVIDER PROFILE
              </span>
              <div className="flex items-center gap-3 pt-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Provider {currentProvider ? shortenAddress(currentProvider.id) : "Cluster 01"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>HEALTHY</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-cyber-bg p-3 rounded-lg border border-cyber-border">
              <div>
                <span className="text-gray-500 text-[10px] uppercase block">Provider PRI</span>
                <span className="text-base font-bold text-monad-400">{priPercent}% Score</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-monad-950/80 border border-monad-500/30 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-monad-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <span>Provider Address: <strong className="text-white">{currentProvider?.id || "—"}</strong></span>
            <span>•</span>
            <a
              href={currentProvider ? COMPSENTRY.explorer.addressUrl(currentProvider.id) : "#"}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>View On MonadVision</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* 5 Metrics Cards (Section 11) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 font-mono text-xs">
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Active SLAs</span>
            <div className="text-2xl font-bold text-cyan-400 mt-1">
              {currentProvider?.activeContracts ? Number(currentProvider.activeContracts) : providerContracts.length}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Live Inferences</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Bond Locked</span>
            <div className="text-2xl font-bold text-white mt-1">
              {formatUSDC(currentProvider?.totalBondStaked || "20000000")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Staked in Vault</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Earned Fees</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {formatUSDC(currentProvider?.totalEarned || "0")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Service Revenue</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Compliance Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {complianceRate}%
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">On-Time Settlements</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <span className="text-gray-400 text-[10px] uppercase block">Slashed Collateral</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {formatUSDC(currentProvider?.totalSlashed || "0")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Penalties Paid</span>
          </div>
        </div>

        {/* Reliability Overview Box */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-cyber-border">
            Provider Reliability Telemetry
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Compliance Rate</span>
              <span className="text-emerald-400 font-bold text-base">{complianceRate}%</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Breach Count</span>
              <span className="text-rose-400 font-bold text-base">{breachCount} Breaches</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Compliant Epochs</span>
              <span className="text-white font-bold text-base">{compliantEpochs} Epochs</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">PRI Reliability</span>
              <span className="text-monad-400 font-bold text-base">{priPercent} / 100</span>
            </div>
          </div>
        </div>

        {/* Provider Contracts Table */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Provider Hosted SLA Contracts</h3>
            </div>
            <span className="text-gray-400 text-[11px]">{providerContracts.length} Contracts Under Monitoring</span>
          </div>

          {providerContracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No contracts currently hosted for this provider.
            </div>
          ) : (
            <div className="divide-y divide-cyber-border/40">
              {providerContracts.map((c) => {
                const meta = resolveResourceMetadata(c.offer?.resourceId);
                return (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-cyber-bg/40 px-2 rounded-lg transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">SLA #{shortenHash(c.id)}</span>
                        <span className="text-gray-400">({meta.name})</span>
                      </div>
                      <span className="text-[11px] text-gray-500">
                        Buyer: {shortenAddress(c.buyer?.id)} • Bond: {formatUSDC(c.providerBond)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block uppercase">Remaining Bond</span>
                        <span className="text-cyan-400 font-bold">{formatUSDC(c.currentRemainingBond)}</span>
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
      </main>

      <Footer />
    </div>
  );
}
