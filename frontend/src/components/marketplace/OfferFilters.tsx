import React from "react";
import { Search, Filter, Cpu, SlidersHorizontal } from "lucide-react";

interface OfferFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  maxLatency: number;
  onMaxLatencyChange: (val: number) => void;
}

export function OfferFilters({
  searchQuery,
  onSearchChange,
  maxLatency,
  onMaxLatencyChange,
}: OfferFiltersProps) {
  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
      <div className="relative w-full md:w-72">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by resource or hardware..."
          className="w-full bg-cyber-bg border border-cyber-border rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-monad-500 transition"
        />
      </div>

      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
        <div className="flex items-center gap-2 text-gray-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Max SLA Latency:</span>
          <span className="text-white font-bold">{maxLatency === 500 ? "Any" : `≤ ${maxLatency}ms`}</span>
        </div>
        <input
          type="range"
          min="100"
          max="500"
          step="50"
          value={maxLatency}
          onChange={(e) => onMaxLatencyChange(Number(e.target.value))}
          className="accent-monad-500 cursor-pointer w-32"
        />
      </div>
    </div>
  );
}
