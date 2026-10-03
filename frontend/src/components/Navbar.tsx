"use client";

import React, { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Shield, Activity, Wallet, Cpu, ExternalLink } from "lucide-react";
import { fetchSystemMetrics, SystemMetricsData } from "@/lib/api";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [metrics, setMetrics] = useState<SystemMetricsData | null>(null);

  useEffect(() => {
    fetchSystemMetrics().then(setMetrics);
    const interval = setInterval(() => {
      fetchSystemMetrics().then(setMetrics);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatEther = (weiStr: string) => {
    try {
      const val = Number(BigInt(weiStr) / 10000000000000000n) / 100;
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return "0.00";
    }
  };

  return (
    <header className="border-b border-cyber-border bg-cyber-bg/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-monad-700 to-monad-500 flex items-center justify-center shadow-lg shadow-monad-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">CompSentry</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-monad-900/80 text-monad-500 border border-monad-500/30">
                MONAD TESTNET
              </span>
            </div>
            <p className="text-xs text-gray-400">Deterministic SLA Micro-Settlement</p>
          </div>
        </div>

        {/* Global Protocol Invariant Badges */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          <div className="bg-cyber-card border border-cyber-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-gray-400">TVL:</span>
            <span className="text-emerald-400 font-semibold">
              ${metrics ? formatEther(metrics.totalValueLocked) : "1,200.00"} USDC
            </span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-gray-400">CUR:</span>
            <span className="text-monad-500 font-semibold">
              {metrics ? (Number(metrics.curBps) / 100).toFixed(2) : "16.66"}%
            </span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="text-gray-400">Chainlink CRE:</span>
            <span className="text-cyan-400 font-semibold">Active DON</span>
          </div>
        </div>

        {/* Wallet Connection */}
        <div>
          {isConnected && address ? (
            <button
              onClick={() => disconnect()}
              className="flex items-center gap-2 bg-cyber-card hover:bg-cyber-highlight border border-cyber-border text-white text-xs font-mono px-3.5 py-2 rounded-lg transition"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="flex items-center gap-2 bg-monad-600 hover:bg-monad-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg shadow-monad-600/25 transition"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
