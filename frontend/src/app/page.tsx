"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Marketplace } from "@/components/Marketplace";
import { ActiveContractCockpit } from "@/components/ActiveContractCockpit";
import { IncidentInspector } from "@/components/IncidentInspector";
import { ScenarioControls } from "@/components/ScenarioControls";
import { ShieldCheck, Cpu, Terminal, ArrowUpRight } from "lucide-react";
import { fetchActiveContracts, SLAContractData } from "@/lib/api";

export default function Home() {
  const [activeScenario, setActiveScenario] = useState<"normal" | "latency" | "outage" | "desync">("normal");
  const [currentEpoch, setCurrentEpoch] = useState(1);
  const [contracts, setContracts] = useState<SLAContractData[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // Dynamically load active contracts from Envio HyperIndex
  const loadContracts = async () => {
    try {
      const activeContracts = await fetchActiveContracts();
      setContracts(activeContracts);
      if (activeContracts.length > 0 && !selectedContractId) {
        setSelectedContractId(activeContracts[0].id);
      }
    } catch (err) {
      console.warn("Could not load contracts:", err);
    }
  };

  useEffect(() => {
    loadContracts();
    const interval = setInterval(loadContracts, 8_000);
    return () => clearInterval(interval);
  }, []);

  const activeContract = contracts.find((c) => c.id === selectedContractId) || (contracts.length > 0 ? contracts[0] : null);

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
          contract={activeContract}
          scenario={activeScenario}
          currentEpoch={currentEpoch}
        />

        {/* Incident Inspector & Decoupled AI Post-Mortem Card */}
        <IncidentInspector
          scenario={activeScenario}
        />

        {/* Verified Compute Marketplace */}
        <Marketplace
          onSelectOffer={(newContractId) => {
            setSelectedContractId(newContractId);
            setCurrentEpoch(1);
            loadContracts();
          }}
          activeContractId={selectedContractId}
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
              <span>Sub-Second Micro-Epoch Settlements</span>
            </span>
            <span>•</span>
            <span className="text-gray-400">Envio HyperIndex Realtime</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
