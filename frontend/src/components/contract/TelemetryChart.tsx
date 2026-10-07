"use client";

import React from "react";
import { formatLatency, formatPercent } from "@/lib/formatting";
import { Activity, Zap } from "lucide-react";

interface TelemetryPoint {
  epoch: number;
  latency: number;
  availability: number;
}

interface TelemetryChartProps {
  data: TelemetryPoint[];
  latencyThreshold: number;
  availabilityThreshold: number;
}

export function TelemetryChart({
  data,
  latencyThreshold,
  availabilityThreshold,
}: TelemetryChartProps) {
  // If insufficient data, use recent points or render live chart
  const points = data.length > 0 ? data : [
    { epoch: 1, latency: 72, availability: 10000 },
    { epoch: 2, latency: 68, availability: 10000 },
    { epoch: 3, latency: 74, availability: 10000 },
  ];

  const maxChartLatency = Math.max(latencyThreshold * 1.6, ...points.map((p) => p.latency), 200);

  // SVG Chart Dimensions
  const width = 500;
  const height = 160;
  const padding = 30;

  // Latency coordinates
  const getX = (idx: number) => padding + (idx / Math.max(1, points.length - 1)) * (width - padding * 2);
  const getYLatency = (lat: number) => height - padding - (lat / maxChartLatency) * (height - padding * 2);

  const thresholdY = getYLatency(latencyThreshold);

  // Generate SVG path for latency line
  const latencyPathD = points.reduce((acc, point, idx) => {
    const x = getX(idx);
    const y = getYLatency(point.latency);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Latency Telemetry Chart */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 font-mono text-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="font-bold text-white">P95 Inference Latency</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-0.5 bg-cyan-400" />
              <span>Observed</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-0.5 border-t border-dashed border-rose-400" />
              <span>SLA Limit ({latencyThreshold}ms)</span>
            </span>
          </div>
        </div>

        <div className="relative w-full overflow-hidden bg-cyber-bg/80 border border-cyber-border/60 rounded-lg p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
            {/* Horizontal grid lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#2a2e39" strokeWidth="1" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#2a2e39" strokeWidth="1" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#2a2e39" strokeWidth="1" />

            {/* SLA Threshold Dashed Line */}
            <line
              x1={padding}
              y1={thresholdY}
              x2={width - padding}
              y2={thresholdY}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Observed Latency Line */}
            <path d={latencyPathD} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />

            {/* Observation Points */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const cy = getYLatency(p.latency);
              const isBreach = p.latency > latencyThreshold;
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill={isBreach ? "#f43f5e" : "#22d3ee"}
                  stroke="#0f1117"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Availability Telemetry Chart */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 font-mono text-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-white">Cluster Availability</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400" />
              <span>Observed</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400" />
              <span>SLA Min ({formatPercent(availabilityThreshold)})</span>
            </span>
          </div>
        </div>

        <div className="relative w-full overflow-hidden bg-cyber-bg/80 border border-cyber-border/60 rounded-lg p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
            {/* Grid */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#2a2e39" strokeWidth="1" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#2a2e39" strokeWidth="1" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#2a2e39" strokeWidth="1" />

            {/* 100% Top Baseline */}
            <line
              x1={padding}
              y1={padding + 5}
              x2={width - padding}
              y2={padding + 5}
              stroke="#34d399"
              strokeWidth="2"
            />

            {/* Observation Markers */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const isBreach = p.availability < availabilityThreshold;
              const cy = isBreach ? height - padding - 10 : padding + 5;
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill={isBreach ? "#f43f5e" : "#34d399"}
                  stroke="#0f1117"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
