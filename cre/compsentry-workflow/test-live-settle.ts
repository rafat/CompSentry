import { createWalletClient, createPublicClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import SettlementControllerABI from "./abi/SettlementController.json" with { type: "json" };
import ComputeSLAHubABI from "./abi/ComputeSLAHub.json" with { type: "json" };
import { computeConsensus, type ObserverTelemetry } from "./consensus.js";

const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] }
  }
} as const;

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required to submit on-chain settlements.");
}
const account = privateKeyToAccount(privateKey as `0x${string}`);

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz")
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz")
});

const HUB_ADDRESS = "0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB" as const;
const CONTROLLER_ADDRESS = "0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f" as const;
const OFFER_1 = "0xe17577af34762ea69eb7c047da40c366272e2ed36271f27273e233fd6291ad5f" as const;

const OBSERVERS = [
  "https://compsentry-observer-1-961098530006.asia-south1.run.app/telemetry",
  "https://compsentry-observer-2-961098530006.asia-south1.run.app/telemetry",
  "https://compsentry-observer-3-961098530006.asia-south1.run.app/telemetry"
];

async function main() {
  console.log("=== Step 1: Activating Fresh SLA Contract on Monad Testnet ===");
  const activateTx = await walletClient.writeContract({
    address: HUB_ADDRESS,
    abi: ComputeSLAHubABI,
    functionName: "activateContract",
    args: [OFFER_1]
  });
  console.log(`Activation Tx sent: ${activateTx}`);
  const activateReceipt = await publicClient.waitForTransactionReceipt({ hash: activateTx });
  console.log(`Activation confirmed in block ${activateReceipt.blockNumber}! Status: ${activateReceipt.status}`);

  // Find contractId from logs
  let contractId: `0x${string}` | null = null;
  for (const log of activateReceipt.logs) {
    if (log.address.toLowerCase() === HUB_ADDRESS.toLowerCase() && log.topics[1]) {
      contractId = log.topics[1] as `0x${string}`;
      break;
    }
  }

  if (!contractId) {
    throw new Error("Could not find contractId in activation logs");
  }

  console.log(`\nActive SLA Contract ID: ${contractId}`);
  console.log(`Vercel Dashboard URL: https://comp-sentry.vercel.app/my-slas/${contractId}`);

  // Read SLA details
  const sla = (await publicClient.readContract({
    address: HUB_ADDRESS,
    abi: ComputeSLAHubABI,
    functionName: "getContract",
    args: [contractId]
  })) as any;

  const startTimestamp = Number(sla.startTimestamp);
  const epochDuration = Number(sla.epochDuration);
  const epochEnd = startTimestamp + epochDuration;

  console.log(`Start Timestamp: ${startTimestamp}`);
  console.log(`Epoch 1 Window: ${startTimestamp} -> ${epochEnd} (${epochDuration}s duration)`);

  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = epochEnd - now;
  if (waitSeconds > 0) {
    console.log(`\nWaiting ${waitSeconds} seconds for Epoch 1 window to conclude...`);
    await new Promise((r) => setTimeout(r, waitSeconds * 1000 + 1000));
  }

  console.log("\n=== Step 2: Polling Independent Observers for Telemetry ===");
  const rawObservations: ObserverTelemetry[] = [];

  for (const observerBaseUrl of OBSERVERS) {
    const url = `${observerBaseUrl}?contractId=${contractId}&windowStart=${startTimestamp}&windowEnd=${epochEnd}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const telemetry = (await resp.json()) as ObserverTelemetry;
        rawObservations.push(telemetry);
        console.log(
          `[Observer ${telemetry.observerId}] Latency: ${telemetry.p95LatencyMs}ms, Avail: ${
            telemetry.availabilityBps / 100
          }%, Samples: ${telemetry.sampleCount}`
        );
      } else {
        console.warn(`[Observer ${observerBaseUrl}] HTTP ${resp.status}`);
      }
    } catch (err: any) {
      console.warn(`[Observer ${observerBaseUrl}] Offline / Unreachable: ${err.message}`);
    }
  }

  console.log(`\n=== Step 3: Computing CRE Consensus ===`);
  const consensus = computeConsensus(
    rawObservations,
    {
      contractId,
      epochId: 1,
      windowStart: startTimestamp,
      windowEnd: epochEnd
    },
    2
  );

  console.log(`Quorum Reached: ${consensus.quorumCount}/3`);
  console.log(`Median P95 Latency: ${consensus.medianLatencyMs}ms (SLA Threshold: 120ms)`);
  console.log(`Consensus Availability: ${consensus.consensusAvailabilityBps / 100}%`);
  console.log(`Evidence Hash: ${consensus.evidenceHash}`);

  const slaReport = {
    contractId,
    epochId: 1n,
    p95LatencyMs: BigInt(consensus.medianLatencyMs),
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: BigInt(consensus.deliveredUnits),
    evidenceHash: consensus.evidenceHash as `0x${string}`,
    timestamp: BigInt(epochEnd),
    observerQuorum: consensus.quorumCount
  };

  console.log("\n=== Step 4: Submitting settleEpoch to Monad SettlementController ===");
  const settleTx = await walletClient.writeContract({
    address: CONTROLLER_ADDRESS,
    abi: SettlementControllerABI,
    functionName: "settleEpoch",
    args: [slaReport]
  });

  console.log(`Settlement Tx broadcasted: ${settleTx}`);
  const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleTx });
  console.log(`✅ Epoch 1 Settled in block ${settleReceipt.blockNumber}! Status: ${settleReceipt.status}`);
  console.log(`MonadVision Explorer: https://testnet.monadexplorer.com/tx/${settleTx}`);

  console.log("\n=== SUCCESS: SLA Contract Epoch 1 Settled On-Chain! ===");
  console.log(`Check Vercel: https://comp-sentry.vercel.app/my-slas/${contractId}`);
}

main().catch(console.error);
