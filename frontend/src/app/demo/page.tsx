"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { fetchActiveContracts, fetchEpochSettlements, fetchContractIncidents } from "@/graphql/queries";
import { SLAContract, EpochSettlement, Incident } from "@/types";
import {
  formatUSDC,
  formatLatency,
  formatPercent,
  shortenAddress,
  shortenHash,
  resolveResourceMetadata,
} from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import {
  Activity,
  Zap,
  ShieldAlert,
  Server,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronRight,
  Database,
  RefreshCw,
} from "lucide-react";

type ScenarioType = "SCENARIO_NORMAL" | "SCENARIO_LATENCY_SPIKE" | "SCENARIO_OUTAGE" | "SCENARIO_OBSERVER_DESYNC";

interface ObserverReading {
  id: string;
  name: string;
  port: number;
  latencyMs: number;
  availabilityBps: number;
  sampleCount: number;
  status: "ONLINE" | "CORRUPTED" | "OFFLINE";
}

export default function LiveDemoPage() {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>("SCENARIO_NORMAL");
  const [switching, setSwitching] = useState(false);

  const [contract, setContract] = useState<SLAContract | null>(null);
  const [settlements, setSettlements] = useState<EpochSettlement[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Observer readings
  const [observers, setObservers] = useState<ObserverReading[]>([
    { id: "observer-provider", name: "Observer 1 (Provider Node)", port: 4001, latencyMs: 72, availabilityBps: 10000, sampleCount: 12, status: "ONLINE" },
    { id: "observer-independent", name: "Observer 2 (Independent Probe)", port: 4002, latencyMs: 71, availabilityBps: 10000, sampleCount: 12, status: "ONLINE" },
    { id: "observer-secondary", name: "Observer 3 (Secondary Monitor)", port: 4003, latencyMs: 75, availabilityBps: 10000, sampleCount: 12, status: "ONLINE" },
  ]);

  // Load contract and telemetry data
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        // 1. Fetch active contract from Envio
        const contracts = await fetchActiveContracts();
        const active = contracts[0] || null;
        if (mounted && active) {
          setContract(active);
          const [s, inc] = await Promise.all([
            fetchEpochSettlements(active.id),
            fetchContractIncidents(active.id),
          ]);
          if (mounted) {
            setSettlements(s);
            setIncidents(inc);
          }
        }

        // 2. Fetch live telemetry from observer probes
        const [obs1, obs2, obs3] = COMPSENTRY.observers;
        const [r1, r2, r3] = await Promise.allSettled([
          fetch(`${obs1.url}/telemetry`).then((r) => r.json()),
          fetch(`${obs2.url}/telemetry`).then((r) => r.json()),
          fetch(`${obs3.url}/telemetry`).then((r) => r.json()),
        ]);

        if (mounted) {
          setObservers([
            {
              id: obs1.id,
              name: obs1.name,
              port: 4001,
              latencyMs: r1.status === "fulfilled" ? r1.value.p95LatencyMs || 72 : 72,
              availabilityBps: r1.status === "fulfilled" ? r1.value.availabilityBps || 10000 : 10000,
              sampleCount: r1.status === "fulfilled" ? r1.value.sampleCount || 10 : 0,
              status: "ONLINE",
            },
            {
              id: obs2.id,
              name: obs2.name,
              port: 4002,
              latencyMs: r2.status === "fulfilled" ? r2.value.p95LatencyMs || 71 : 71,
              availabilityBps: r2.status === "fulfilled" ? r2.value.availabilityBps || 10000 : 10000,
              sampleCount: r2.status === "fulfilled" ? r2.value.sampleCount || 10 : 0,
              status: activeScenario === "SCENARIO_OBSERVER_DESYNC" ? "CORRUPTED" : "ONLINE",
            },
            {
              id: obs3.id,
              name: obs3.name,
              port: 4003,
              latencyMs: r3.status === "fulfilled" ? r3.value.p95LatencyMs || 75 : 75,
              availabilityBps: r3.status === "fulfilled" ? r3.value.availabilityBps || 10000 : 10000,
              sampleCount: r3.status === "fulfilled" ? r3.value.sampleCount || 10 : 0,
              status: "ONLINE",
            },
          ]);
        }
      } catch (err) {
        console.warn("Live demo polling warning:", err);
      }
    }

    loadData();
    const interval = setInterval(loadData, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeScenario]);

  // Handle Scenario Switch
  const handleSwitchScenario = async (scenario: ScenarioType) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/demo/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        setActiveScenario(scenario);
      }
    } catch (err) {
      console.warn("Failed to switch scenario on evaluator service:", err);
      setActiveScenario(scenario);
    } finally {
      setSwitching(false);
    }
  };

  // Compute mathematical median for Chainlink CRE Consensus
  const latencies = observers.map((o) => o.latencyMs).sort((a, b) => a - b);
  const medianLatency = latencies[1] || 72;

  const availabilities = observers.map((o) => o.availabilityBps).sort((a, b) => a - b);
  const medianAvailability = availabilities[1] || 10000;

  const metadata = resolveResourceMetadata(contract?.offer?.resourceId);
  const latencyLimit = Number(contract?.latencyThresholdMs || 120);
  const availabilityMin = Number(contract?.availabilityThresholdBps || 9950);

  const isLatencyBreach = medianLatency > latencyLimit;
  const isAvailabilityBreach = medianAvailability < availabilityMin;
  const isBreach = isLatencyBreach || isAvailabilityBreach;

  const latestSettlement = settlements[0];

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Top Header Card (Section 12) */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-monad-400 bg-monad-950 px-2 py-0.5 rounded border border-monad-500/30">
                CHAOS FAULT INJECTION & LIVE CONSENSUS HARNESS
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                CompSentry Live Demo Monitor
              </h1>
              <p className="text-gray-400 text-xs">
                SLA #{shortenHash(contract?.id)} • {metadata.name}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>MONITORING ACTIVE</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-cyber-bg/80 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Observed Latency (Median)</span>
              <span className={`text-base font-bold ${isLatencyBreach ? "text-rose-400" : "text-cyan-400"}`}>
                {formatLatency(medianLatency)}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">SLA Limit: ≤ {latencyLimit}ms</span>
            </div>

            <div className="bg-cyber-bg/80 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Observed Availability</span>
              <span className={`text-base font-bold ${isAvailabilityBreach ? "text-rose-400" : "text-emerald-400"}`}>
                {formatPercent(medianAvailability)}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">SLA Min: ≥ {formatPercent(availabilityMin)}</span>
            </div>

            <div className="bg-cyber-bg/80 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Observer Quorum</span>
              <span className="text-white font-bold text-base">3 / 3 Probes</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">Decentralized Oracles</span>
            </div>

            <div className="bg-cyber-bg/80 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Arbitration Protocol</span>
              <span className="text-monad-400 font-bold text-base">Chainlink CRE</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">Monad Testnet</span>
            </div>
          </div>
        </div>

        {/* Chaos Injection Controls (Section 12) */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-cyber-border">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Simulate Provider Hardware Incident
            </h2>
            <span className="text-gray-400 text-[11px]">Click to inject network anomalies in real-time</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* 1. Normal */}
            <button
              onClick={() => handleSwitchScenario("SCENARIO_NORMAL")}
              disabled={switching}
              className={`p-4 rounded-xl border text-left transition relative ${
                activeScenario === "SCENARIO_NORMAL"
                  ? "bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                  : "bg-cyber-bg border-cyber-border hover:border-gray-500"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs">Normal Execution</span>
                <span className="text-[10px] text-emerald-400 font-semibold">65-75ms</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Healthy GPU cluster. All 3 probes agree latency is &lt; 120ms. Full epoch fee earned by provider.
              </p>
              {activeScenario === "SCENARIO_NORMAL" && (
                <div className="mt-3 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>ACTIVE SCENARIO</span>
                </div>
              )}
            </button>

            {/* 2. Latency Spike */}
            <button
              onClick={() => handleSwitchScenario("SCENARIO_LATENCY_SPIKE")}
              disabled={switching}
              className={`p-4 rounded-xl border text-left transition relative ${
                activeScenario === "SCENARIO_LATENCY_SPIKE"
                  ? "bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500"
                  : "bg-cyber-bg border-cyber-border hover:border-gray-500"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs">GPU Thermal Throttle</span>
                <span className="text-[10px] text-rose-400 font-semibold">420ms Spike</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Inference latency spikes to ~420ms (&gt; 120ms SLA). SettlementController credits buyer rebate automatically.
              </p>
              {activeScenario === "SCENARIO_LATENCY_SPIKE" && (
                <div className="mt-3 text-[10px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>ACTIVE SCENARIO</span>
                </div>
              )}
            </button>

            {/* 3. Outage */}
            <button
              onClick={() => handleSwitchScenario("SCENARIO_OUTAGE")}
              disabled={switching}
              className={`p-4 rounded-xl border text-left transition relative ${
                activeScenario === "SCENARIO_OUTAGE"
                  ? "bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500"
                  : "bg-cyber-bg border-cyber-border hover:border-gray-500"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs">Cluster Outage</span>
                <span className="text-[10px] text-rose-400 font-semibold">HTTP 503s</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Compute node fails. Triggers max epoch rebate and slashes 5% provider performance bond on Monad.
              </p>
              {activeScenario === "SCENARIO_OUTAGE" && (
                <div className="mt-3 text-[10px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>ACTIVE SCENARIO</span>
                </div>
              )}
            </button>

            {/* 4. Observer Desync Attack */}
            <button
              onClick={() => handleSwitchScenario("SCENARIO_OBSERVER_DESYNC")}
              disabled={switching}
              className={`p-4 rounded-xl border text-left transition relative ${
                activeScenario === "SCENARIO_OBSERVER_DESYNC"
                  ? "bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500"
                  : "bg-cyber-bg border-cyber-border hover:border-gray-500"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs">Observer Desync Attack</span>
                <span className="text-[10px] text-cyan-400 font-semibold">BFT Quorum</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Probe #2 sends rogue 480ms reading. Chainlink CRE median neutralizes outlier as false alarm. Honest provider safe.
              </p>
              {activeScenario === "SCENARIO_OBSERVER_DESYNC" && (
                <div className="mt-3 text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>ACTIVE SCENARIO</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Live Observer Probes Readings */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Chainlink CRE Observer Quorum Telemetry</h3>
            </div>
            <span className="text-[11px] text-gray-400">Live HTTP Endpoints (Ports 4001, 4002, 4003)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {observers.map((obs) => (
              <div
                key={obs.id}
                className={`p-4 rounded-xl border ${
                  obs.status === "CORRUPTED"
                    ? "bg-amber-950/20 border-amber-500/50"
                    : "bg-cyber-bg/80 border-cyber-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-xs">{obs.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    obs.status === "CORRUPTED"
                      ? "bg-amber-950 text-amber-400 border border-amber-500/40"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                  }`}>
                    {obs.status}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-gray-400 mt-2">
                  <div className="flex justify-between">
                    <span>Observed P95:</span>
                    <strong className={obs.latencyMs > latencyLimit ? "text-rose-400" : "text-white"}>
                      {formatLatency(obs.latencyMs)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Availability:</span>
                    <strong className={obs.availabilityBps < availabilityMin ? "text-rose-400" : "text-white"}>
                      {formatPercent(obs.availabilityBps)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Probe Window:</span>
                    <span className="text-gray-500">{obs.sampleCount} Samples Collected</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Pipeline Visualization (Section 12) */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-cyber-border">
            Autonomous Arbitration & Settlement Event Pipeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center items-center py-2">
            {/* Step 1 */}
            <div className="p-3 bg-cyber-bg rounded-lg border border-cyber-border space-y-1">
              <span className="text-[10px] text-gray-500 uppercase block">Step 1</span>
              <span className="font-bold text-white text-xs block">Observer Telemetry</span>
              <span className="text-[10px] text-cyan-400 block">{formatLatency(medianLatency)} observed</span>
            </div>

            <ChevronRight className="hidden md:block h-5 w-5 text-gray-600 mx-auto" />

            {/* Step 2 */}
            <div className="p-3 bg-cyber-bg rounded-lg border border-cyber-border space-y-1">
              <span className="text-[10px] text-gray-500 uppercase block">Step 2</span>
              <span className="font-bold text-white text-xs block">CRE Consensus</span>
              <span className="text-[10px] text-monad-400 block">Median Aggregated</span>
            </div>

            <ChevronRight className="hidden md:block h-5 w-5 text-gray-600 mx-auto" />

            {/* Step 3 */}
            <div className="p-3 bg-cyber-bg rounded-lg border border-cyber-border space-y-1">
              <span className="text-[10px] text-gray-500 uppercase block">Step 3</span>
              <span className="font-bold text-white text-xs block">Monad Settlement</span>
              <span className="text-[10px] text-emerald-400 block">Smart Contract Vault</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
