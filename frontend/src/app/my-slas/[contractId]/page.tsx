"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContractHeader } from "@/components/contract/ContractHeader";
import { SLAHealth } from "@/components/contract/SLAHealth";
import { TelemetryChart } from "@/components/contract/TelemetryChart";
import { EpochTable } from "@/components/contract/EpochTable";
import { IncidentPanel } from "@/components/contract/IncidentPanel";
import {
  fetchSLAContractById,
  fetchEpochSettlements,
  fetchContractIncidents,
} from "@/graphql/queries";
import { SLAContract, EpochSettlement, Incident } from "@/types";
import { ArrowLeft, RefreshCw, Radio } from "lucide-react";

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.contractId as string;

  const [contract, setContract] = useState<SLAContract | null>(null);
  const [settlements, setSettlements] = useState<EpochSettlement[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  // Poll Envio indexed state every 3-4 seconds
  useEffect(() => {
    let mounted = true;

    async function loadContractData() {
      try {
        const [c, s, inc] = await Promise.all([
          fetchSLAContractById(contractId),
          fetchEpochSettlements(contractId),
          fetchContractIncidents(contractId),
        ]);

        if (!mounted) return;
        setContract(c);
        setSettlements(s);
        setIncidents(inc);
      } catch (err) {
        console.warn("Error fetching contract details:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (contractId) loadContractData();
    const interval = setInterval(loadContractData, 3500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [contractId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-cyber-bg font-mono">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse">
            <Radio className="h-4 w-4 text-cyan-400 animate-spin" />
            <span>Loading Live Telemetry & Settlements for SLA #{contractId?.slice(0, 8)}...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex flex-col bg-cyber-bg font-mono">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">SLA Contract Not Found</h2>
          <p className="text-gray-400 text-xs">
            Contract ID <code className="text-monad-400">{contractId}</code> was not found in the indexer database.
          </p>
          <Link href="/my-slas" className="text-monad-400 underline text-xs">
            Return to My SLAs
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Derive telemetry data points for the live chart
  const telemetryPoints = settlements
    .slice()
    .reverse()
    .map((s) => ({
      epoch: Number(s.epochId),
      latency: Number(s.p95LatencyMs),
      availability: Number(s.availabilityBps),
    }));

  const latestSettlement = settlements[0];
  const currentLatency = latestSettlement ? Number(latestSettlement.p95LatencyMs) : 71;
  const currentAvailability = latestSettlement ? Number(latestSettlement.availabilityBps) : 10000;

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Navigation & Live Signal Indicator */}
        <div className="flex items-center justify-between font-mono text-xs">
          <Link
            href="/my-slas"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to My SLAs</span>
          </Link>

          <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Envio Telemetry Sync (3s)</span>
          </div>
        </div>

        {/* 1. Contract Header (Section 7) */}
        <ContractHeader contract={contract} />

        {/* 2. SLA Health Metrics (Section 7) */}
        <SLAHealth
          contract={contract}
          currentLatency={currentLatency}
          currentAvailability={currentAvailability}
        />

        {/* 3. Incident Panel (Section 10) */}
        <IncidentPanel incidents={incidents} contract={contract} />

        {/* 4. Live Telemetry Charts (Section 8) */}
        <TelemetryChart
          data={telemetryPoints}
          latencyThreshold={Number(contract.latencyThresholdMs || 120)}
          availabilityThreshold={Number(contract.availabilityThresholdBps || 9950)}
        />

        {/* 5. Epoch Settlement Table (Section 9) */}
        <EpochTable settlements={settlements} />
      </main>

      <Footer />
    </div>
  );
}
