import React from "react";
import { ContractStatus, EpochStatus, BreachType } from "@/types";
import { CheckCircle2, AlertTriangle, Clock, ShieldCheck, XCircle } from "lucide-react";

export type HealthStatusType =
  | "COMPLIANT"
  | "MONITORING"
  | "BREACH"
  | "REVIEW_REQUIRED"
  | "FINALIZED"
  | ContractStatus
  | EpochStatus
  | BreachType;

interface SLAHealthBadgeProps {
  status: HealthStatusType;
  className?: string;
  showIcon?: boolean;
}

export function SLAHealthBadge({ status, className = "", showIcon = true }: SLAHealthBadgeProps) {
  let label = "COMPLIANT";
  let bg = "bg-emerald-950/80 text-emerald-400 border-emerald-500/30";
  let dotColor = "bg-emerald-400";
  let Icon = CheckCircle2;

  switch (status) {
    case "COMPLIANT":
      label = "COMPLIANT";
      bg = "bg-emerald-950/80 text-emerald-400 border-emerald-500/30";
      dotColor = "bg-emerald-400";
      Icon = CheckCircle2;
      break;

    case "ACTIVE":
    case "MONITORING":
      label = "MONITORING";
      bg = "bg-cyan-950/80 text-cyan-400 border-cyan-500/30";
      dotColor = "bg-cyan-400 animate-pulse";
      Icon = Clock;
      break;

    case "BREACH":
    case "BREACHED":
    case "LATENCY_BREACH":
    case "AVAILABILITY_BREACH":
    case "BOTH":
      label = status === "BOTH" ? "CRITICAL BREACH" : status.replace("_", " ");
      bg = "bg-rose-950/80 text-rose-400 border-rose-500/30";
      dotColor = "bg-rose-400 animate-ping";
      Icon = AlertTriangle;
      break;

    case "REVIEW_REQUIRED":
      label = "REVIEW REQUIRED";
      bg = "bg-amber-950/80 text-amber-400 border-amber-500/30";
      dotColor = "bg-amber-400";
      Icon = AlertTriangle;
      break;

    case "FINALIZED":
      label = "FINALIZED";
      bg = "bg-gray-900/80 text-gray-400 border-gray-700";
      dotColor = "bg-gray-500";
      Icon = ShieldCheck;
      break;

    default:
      label = status;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
