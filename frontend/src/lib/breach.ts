import { BreachType, SLAContract } from "@/types";

/**
 * Objective SLA breach classifier.
 * Note: For settled financial outcomes, on-chain EpochSettlement/Incident data is authoritative.
 * This helper is used for real-time visualization and alerting.
 */
export function getBreachType(
  latencyMs: number,
  availabilityBps: number,
  contract: Pick<SLAContract, "latencyThresholdMs" | "availabilityThresholdBps">
): BreachType {
  const maxLatency = Number(contract.latencyThresholdMs);
  const minAvailability = Number(contract.availabilityThresholdBps);

  const latencyBreach = latencyMs > maxLatency;
  const availabilityBreach = availabilityBps < minAvailability;

  if (latencyBreach && availabilityBreach) {
    return "BOTH";
  }
  if (latencyBreach) {
    return "LATENCY_BREACH";
  }
  if (availabilityBreach) {
    return "AVAILABILITY_BREACH";
  }
  return "NONE";
}

export function formatBreachLabel(type: BreachType): string {
  switch (type) {
    case "LATENCY_BREACH":
      return "Latency Breach";
    case "AVAILABILITY_BREACH":
      return "Availability Breach";
    case "BOTH":
      return "Critical Outage (Latency + Avail)";
    case "NONE":
    default:
      return "Compliant";
  }
}
