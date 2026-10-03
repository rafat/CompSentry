"use client";

import React, { useState } from "react";
import { Play, Flame, ShieldAlert, Cpu, CheckCircle2, RefreshCw } from "lucide-react";
import { setChaosScenario } from "@/lib/api";

interface ScenarioControlsProps {
  currentScenario: "normal" | "latency" | "outage" | "desync";
  onSelectScenario: (scenario: "normal" | "latency" | "outage" | "desync") => void;
}

export function ScenarioControls({ currentScenario, onSelectScenario }: ScenarioControlsProps) {
  const [loading, setLoading] = useState(false);

  const handleTrigger = async (scenario: "normal" | "latency" | "outage" | "desync") => {
    setLoading(true);
    await setChaosScenario(scenario);
    onSelectScenario(scenario);
    setLoading(false);
  };

  const scenarios = [
    {
      id: "normal" as const,
      title: "Normal Execution",
      badge: "65-75ms • 100% Avail",
      desc: "All 3 probes report compliant inference. Full micro-epoch fee is earned by provider.",
      color: "border-emerald-500/50 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40",
      activeColor: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/50",
      icon: CheckCircle2,
    },
    {
      id: "latency" as const,
      title: "GPU Thermal Throttle (Latency Spike)",
      badge: "450ms Latency Spike",
      desc: "Inference latency spikes to 450ms (> 120ms SLA). SettlementController automatically credits buyer rebate.",
      color: "border-amber-500/50 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40",
      activeColor: "ring-2 ring-amber-500 border-amber-500 bg-amber-950/50",
      icon: Flame,
    },
    {
      id: "outage" as const,
      title: "Cluster Outage (HTTP 500s)",
      badge: "0% Availability",
      desc: "Node crashes. SettlementController triggers maximum epoch rebate and slashes 5% provider bond.",
      color: "border-rose-500/50 text-rose-400 bg-rose-950/20 hover:bg-rose-950/40",
      activeColor: "ring-2 ring-rose-500 border-rose-500 bg-rose-950/50",
      icon: ShieldAlert,
    },
    {
      id: "desync" as const,
      title: "Observer Desync Attack",
      badge: "CRE Outlier Rejection",
      desc: "Probe #2 is corrupted with 480ms reading. Chainlink CRE mathematical median neutralizes outlier as false alarm.",
      color: "border-monad-500/50 text-monad-400 bg-monad-950/20 hover:bg-monad-950/40",
      activeColor: "ring-2 ring-monad-500 border-monad-500 bg-monad-950/50",
      icon: Cpu,
    },
  ];

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <span>Interactive Fault Injection & Demo Controls</span>
          </h2>
          <p className="text-xs text-gray-400">
            Inject real-time network anomalies to watch the Chainlink CRE consensus and Monad smart contracts react live.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((sc) => {
          const isActive = currentScenario === sc.id;
          const Icon = sc.icon;

          return (
            <button
              key={sc.id}
              onClick={() => handleTrigger(sc.id)}
              disabled={loading}
              className={`text-left p-4 rounded-xl border transition flex flex-col justify-between ${sc.color} ${
                isActive ? sc.activeColor : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyber-bg border border-cyber-border text-gray-300">
                    {sc.badge}
                  </span>
                </div>
                <h3 className="font-bold text-white text-xs mb-1">{sc.title}</h3>
                <p className="text-[11px] text-gray-400 leading-snug">{sc.desc}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-cyber-border/40 flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-white">
                  {isActive ? "ACTIVE DEMO" : "CLICK TO INJECT"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
