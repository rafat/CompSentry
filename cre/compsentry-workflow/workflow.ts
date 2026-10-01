import { ethers } from "ethers";
import dotenv from "dotenv";
import { computeConsensus, ObserverTelemetry, ContractSLATerms } from "./consensus";

dotenv.config();

const OBSERVER_URLS = [
  process.env.OBSERVER_PROVIDER_URL || "http://localhost:4001",
  process.env.OBSERVER_INDEPENDENT_URL || "http://localhost:4002",
  process.env.OBSERVER_SECONDARY_URL || "http://localhost:4003"
];

const HUB_ABI = [
  "function getContract(bytes32 contractId) view returns (tuple(bytes32 contractId, bytes32 offerId, address buyer, address provider, address token, uint256 serviceFee, uint256 providerBond, uint64 startTimestamp, uint64 endTimestamp, uint64 epochDuration, uint32 totalEpochs, uint32 availabilityThresholdBps, uint32 latencyThresholdMs, uint256 epochPayoutCap, uint256 maxTotalPayout, uint8 status))"
];

const CONTROLLER_ABI = [
  "function lastSettledEpoch(bytes32 contractId) view returns (uint64)",
  "function cumulativeRebates(bytes32 contractId) view returns (uint256)",
  "function cumulativeSlashing(bytes32 contractId) view returns (uint256)",
  "function settleEpoch(tuple(bytes32 contractId, uint64 epochId, uint64 p95LatencyMs, uint32 availabilityBps, uint64 deliveredUnits, bytes32 evidenceHash, uint64 timestamp, uint8 observerQuorum) report) external",
  "function isSettled(bytes32 contractId, uint64 epochId) view returns (bool)"
];

export async function executeCREEpochSettlement(contractId: string) {
  const rpcUrl = process.env.MONAD_RPC_URL || "http://127.0.0.1:8545";
  const hubAddress = process.env.COMPUTE_SLA_HUB_ADDRESS;
  const controllerAddress = process.env.SETTLEMENT_CONTROLLER_ADDRESS;
  const reporterKey = process.env.CRE_REPORTER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  if (!hubAddress || !controllerAddress) {
    throw new Error("Missing contract addresses in environment (COMPUTE_SLA_HUB_ADDRESS, SETTLEMENT_CONTROLLER_ADDRESS)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(reporterKey, provider);

  const hubContract = new ethers.Contract(hubAddress, HUB_ABI, provider);
  const controllerContract = new ethers.Contract(controllerAddress, CONTROLLER_ABI, signer);

  // 1. Fetch on-chain contract terms
  const slaData = await hubContract.getContract(contractId);
  const lastEpoch = await controllerContract.lastSettledEpoch(contractId);
  const cumRebates = await controllerContract.cumulativeRebates(contractId);
  const cumSlashing = await controllerContract.cumulativeSlashing(contractId);

  const targetEpoch = Number(lastEpoch) + 1;
  const totalEpochs = Number(slaData.totalEpochs);

  if (targetEpoch > totalEpochs) {
    console.log(`[CRE Workflow] Contract ${contractId} already fully settled (epoch ${lastEpoch}/${totalEpochs}).`);
    return null;
  }

  console.log(`[CRE Workflow] Settle target epoch ${targetEpoch}/${totalEpochs} for contract ${contractId}`);

  // 2. Query Observers in parallel
  const telemetryResults: ObserverTelemetry[] = [];

  for (const url of OBSERVER_URLS) {
    try {
      const resp = await fetch(`${url}/telemetry?contractId=${contractId}`);
      if (resp.ok) {
        const data = await resp.json();
        telemetryResults.push(data);
      }
    } catch (err: any) {
      console.warn(`[CRE Workflow] Observer at ${url} unreachable: ${err.message}`);
    }
  }

  console.log(`[CRE Workflow] Collected ${telemetryResults.length} observer responses.`);

  const terms: ContractSLATerms = {
    contractId,
    totalEpochs,
    availabilityThresholdBps: Number(slaData.availabilityThresholdBps),
    latencyThresholdMs: Number(slaData.latencyThresholdMs),
    epochPayoutCap: BigInt(slaData.epochPayoutCap),
    maxTotalPayout: BigInt(slaData.maxTotalPayout),
    providerBond: BigInt(slaData.providerBond),
    cumulativeRebates: BigInt(cumRebates),
    cumulativeSlashing: BigInt(cumSlashing)
  };

  // 3. Compute Consensus
  const consensus = computeConsensus(telemetryResults, terms, 2);

  console.log(`[CRE Consensus] Median Latency: ${consensus.medianLatencyMs}ms (Threshold: ${terms.latencyThresholdMs}ms)`);
  console.log(`[CRE Consensus] Availability: ${(consensus.consensusAvailabilityBps / 100).toFixed(2)}% (Threshold: ${(terms.availabilityThresholdBps / 100).toFixed(2)}%)`);
  console.log(`[CRE Consensus] Status: ${consensus.status === 0 ? "COMPLIANT" : "BREACHED"}`);

  // 4. Construct SLAReport (Clean objective observations only - zero trusted financial outcomes)
  const report = {
    contractId,
    epochId: targetEpoch,
    p95LatencyMs: consensus.medianLatencyMs,
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: consensus.deliveredUnits,
    evidenceHash: consensus.evidenceHash,
    timestamp: Math.floor(Date.now() / 1000),
    observerQuorum: consensus.quorumCount
  };

  // 5. Submit Transaction to Monad
  const tx = await controllerContract.settleEpoch(report);
  console.log(`[CRE Workflow] Settle transaction broadcasted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[CRE Workflow] Epoch ${targetEpoch} settled successfully in block ${receipt.blockNumber}`);

  return { report, txHash: tx.hash, blockNumber: receipt.blockNumber };
}
