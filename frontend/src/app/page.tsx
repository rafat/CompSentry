"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Marketplace } from "@/components/Marketplace";
import { ActiveContractCockpit } from "@/components/ActiveContractCockpit";
import { IncidentInspector } from "@/components/IncidentInspector";
import { ScenarioControls } from "@/components/ScenarioControls";
import { ShieldCheck, Cpu, Terminal, ArrowUpRight } from "lucide-react";

export default function Home() {
  const [activeScenario, setActiveScenario] = useState<"normal" | "latency" | "outage" | "desync">("normal");
  const [currentEpoch, setCurrentEpoch] = useState(7);
  const [activeContractId, setActiveContractId] = useState<string | null>(
    "0x1b2539f0a82b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d"
  );

  return (
    <div className="flex-1 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Interactive Chaos / Scenario Controls */}
        <ScenarioControls
          currentScenario={activeScenario}
          onSelectScenario={setActiveScenario}
        />

        {/* Live Active Contract Micro-Settlement Cockpit */}
        <ActiveContractCockpit
          scenario={activeScenario}
          currentEpoch={currentEpoch}
        />

        {/* Incident Inspector & Decoupled AI Post-Mortem Card */}
        <IncidentInspector
          scenario={activeScenario}
        />

        {/* Verified Compute Marketplace */}
        <Marketplace
          onSelectOffer={(offerId) => {
            setActiveContractId(offerId);
            setCurrentEpoch(1);
          }}
          activeContractId={activeContractId}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-border bg-cyber-card/60 py-6 text-xs text-gray-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-monad-500" />
            <span>CompSentry Protocol • Monad Testnet (Chain ID 10143)</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Chainlink CRE Capability DON
            </span>
            <span>•</span>
            <span className="text-gray-400">Envio HyperIndex 3.12</span>
            <span>•</span>
            <span className="text-emerald-400">Deterministic Solvency Invariant Enforced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
