import React from "react";
import { ShieldCheck, Cpu, Terminal, ExternalLink } from "lucide-react";
import { COMPSENTRY } from "@/config/compsentry";

export function Footer() {
  return (
    <footer className="border-t border-cyber-border bg-cyber-bg/90 py-8 text-xs text-gray-500 font-mono mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-monad-900 border border-monad-500/30 flex items-center justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-monad-400" />
          </div>
          <div>
            <span className="text-gray-300 font-bold">CompSentry Protocol</span>
            <span className="text-gray-500 text-[11px] block">
              Autonomous SLA Micro-Settlement for Decentralized AI Compute
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Monad Testnet (10143)</span>
          </span>
          <span>•</span>
          <span className="text-gray-400">Chainlink CRE Consensus</span>
          <span>•</span>
          <span className="text-gray-400">Envio HyperIndex Realtime</span>
          <span>•</span>
          <a
            href={COMPSENTRY.explorer.addressUrl(COMPSENTRY.contracts.hub)}
            target="_blank"
            rel="noreferrer"
            className="text-monad-400 hover:underline flex items-center gap-1"
          >
            <span>Hub Contract</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}
