import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeConsensus, type ObserverTelemetry } from "./consensus.js";
import { configSchema } from "./config.js";
import defaultRawConfig from "./config.json" with { type: "json" };
import SettlementControllerABI from "./abi/SettlementController.json" with { type: "json" };
import ComputeSLAHubABI from "./abi/ComputeSLAHub.json" with { type: "json" };
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const configFile = process.env.CRE_CONFIG || (process.env.CRE_ENV === "online" ? "config.online.json" : "config.json");
  const configPath = path.resolve(__dirname, configFile);
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return defaultRawConfig;
}

const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"] }
  }
} as const;

async function settleSingleEpoch({
  activeContractId,
  config,
  publicClient,
  walletClient,
  forceOutage,
  controllerAddress,
  hubAddress
}: {
  activeContractId: `0x${string}`;
  config: any;
  publicClient: any;
  walletClient: any;
  forceOutage: boolean;
  controllerAddress: `0x${string}`;
  hubAddress: `0x${string}`;
}): Promise<{ success: boolean; nextEpoch?: number; totalEpochs?: number }> {
  // 1. Fetch on-chain contract state and last settled epoch
  let sla: any;
  try {
    sla = await publicClient.readContract({
      address: hubAddress,
      abi: ComputeSLAHubABI,
      functionName: "getContract",
      args: [activeContractId]
    });
  } catch (err: any) {
    console.error(`❌ [Hub] Failed to fetch contract ${activeContractId}:`, err.message);
    return { success: false };
  }

  if (!sla || sla.status === 0) {
    console.error(`❌ [Hub] Contract ${activeContractId} does not exist on-chain.`);
    return { success: false };
  }

  const lastSettled = Number(
    await publicClient.readContract({
      address: controllerAddress,
      abi: SettlementControllerABI,
      functionName: "lastSettledEpoch",
      args: [activeContractId]
    })
  );

  const totalEpochs = Number(sla.totalEpochs);
  const targetEpoch = lastSettled + 1;

  if (targetEpoch > totalEpochs) {
    console.log(`\n🎉 [Completed] All ${totalEpochs}/${totalEpochs} epochs settled for contract ${activeContractId}!`);
    return { success: true, nextEpoch: targetEpoch, totalEpochs };
  }

  if (sla.status !== 1) {
    const statusNames = ["NONE", "ACTIVE", "FINALIZED", "REVIEW_REQUIRED"];
    console.warn(`⚠️ [Status] Contract is in state ${statusNames[sla.status] || sla.status}. Cannot settle epochs.`);
    return { success: false };
  }

  // 2. Derive strict deterministic epoch windows from startTimestamp & epochDuration
  const startTimestamp = Number(sla.startTimestamp);
  const epochDuration = Number(sla.epochDuration);
  const expectedStart = startTimestamp + (targetEpoch - 1) * epochDuration;
  const expectedEnd = expectedStart + epochDuration;

  console.log(`\n======================================================`);
  console.log(`=== CompSentry CRE Settlement: Epoch ${targetEpoch}/${totalEpochs} ===`);
  console.log(`======================================================`);
  console.log(`Contract:         ${activeContractId}`);
  console.log(`Epoch Window:     ${expectedStart} -> ${expectedEnd} (${epochDuration}s duration)`);
  console.log(`Window (Local):   ${new Date(expectedStart * 1000).toLocaleTimeString()} -> ${new Date(expectedEnd * 1000).toLocaleTimeString()}`);

  const now = Math.floor(Date.now() / 1000);

  // Check if epoch is in progress
  if (now < expectedEnd) {
    const waitSec = expectedEnd - now;
    console.log(`⏳ [Epoch In Progress] Waiting ${waitSec}s for Epoch ${targetEpoch} window to conclude...`);
    await new Promise((r) => setTimeout(r, waitSec * 1000 + 1000));
  } else if (now > expectedEnd + 120) {
    console.warn(`\n⚠️  [Epoch Window Lapsed]`);
    console.warn(`   Epoch ${targetEpoch} ended at ${new Date(expectedEnd * 1000).toLocaleTimeString()} (${now - expectedEnd}s ago).`);
    console.warn(`   The on-chain SettlementController enforces strict real-time telemetry windows (max 120s delay).`);
    console.warn(`   Because Epoch ${targetEpoch} was not settled during its active window, it can no longer be accepted by Monad.`);
    console.warn(`   👉 To demo live settlement: Activate a fresh rental on the dashboard and run CRE immediately.\n`);
    return { success: false };
  }

  // 3. Poll Observers for the exact epoch window
  console.log(`📡 Polling ${config.observers.length} Independent Observers...`);
  const rawObservations: ObserverTelemetry[] = [];

  for (const observerBaseUrl of config.observers) {
    const url = `${observerBaseUrl}?contractId=${activeContractId}&epochId=${targetEpoch}&windowStart=${expectedStart}&windowEnd=${expectedEnd}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const telemetry = (await resp.json()) as ObserverTelemetry;
        rawObservations.push(telemetry);
        console.log(
          `   [${telemetry.observerId}] Latency: ${telemetry.p95LatencyMs}ms | Avail: ${(
            telemetry.availabilityBps / 100
          ).toFixed(1)}% | Samples: ${telemetry.sampleCount}`
        );
      } else {
        console.warn(`   [Observer ${observerBaseUrl}] HTTP ${resp.status}`);
      }
    } catch (err: any) {
      console.warn(`   [Observer ${observerBaseUrl}] Offline: ${err.message}`);
    }
  }

  // 4. Inject Outage if requested (for demoing SLA breach & bond slashing)
  if (forceOutage) {
    console.log(`\n🚨 [SIMULATION ALERT] INJECTING GPU CLUSTER OUTAGE & SLA BREACH (--outage)...`);
    rawObservations.length = 0;
    rawObservations.push(
      {
        contractId: activeContractId,
        epochId: targetEpoch,
        observerId: "observer-1",
        p95LatencyMs: 1420,
        availabilityBps: 3850,
        sampleCount: 15,
        successfulRequests: 6,
        failedRequests: 9,
        windowStart: expectedStart,
        windowEnd: expectedEnd,
        timestamp: expectedEnd
      },
      {
        contractId: activeContractId,
        epochId: targetEpoch,
        observerId: "observer-2",
        p95LatencyMs: 1680,
        availabilityBps: 4200,
        sampleCount: 15,
        successfulRequests: 6,
        failedRequests: 9,
        windowStart: expectedStart,
        windowEnd: expectedEnd,
        timestamp: expectedEnd
      },
      {
        contractId: activeContractId,
        epochId: targetEpoch,
        observerId: "observer-3",
        p95LatencyMs: 1510,
        availabilityBps: 4000,
        sampleCount: 15,
        successfulRequests: 6,
        failedRequests: 9,
        windowStart: expectedStart,
        windowEnd: expectedEnd,
        timestamp: expectedEnd
      }
    );
    for (const obs of rawObservations) {
      console.log(
        `   [${obs.observerId}] Latency: ${obs.p95LatencyMs}ms [BREACH ⚠️] | Avail: ${(obs.availabilityBps / 100).toFixed(1)}% [MAJOR OUTAGE 💥]`
      );
    }
  }

  if (rawObservations.length < config.minObserverQuorum) {
    console.error(`❌ [Consensus Failed] Quorum not met (${rawObservations.length}/${config.minObserverQuorum})`);
    return { success: false };
  }

  // 5. Compute CRE Consensus
  const consensus = computeConsensus(
    rawObservations,
    {
      contractId: activeContractId,
      epochId: targetEpoch,
      windowStart: expectedStart,
      windowEnd: expectedEnd
    },
    config.minObserverQuorum
  );

  console.log(`\n--- CRE Consensus Reached ---`);
  console.log(`Quorum:               ${consensus.quorumCount}/${config.observers.length}`);
  console.log(`Median P95 Latency:   ${consensus.medianLatencyMs}ms (Threshold: ${sla.latencyThresholdMs}ms)`);
  console.log(`Consensus Avail:      ${(consensus.consensusAvailabilityBps / 100).toFixed(2)}% (Threshold: ${(Number(sla.availabilityThresholdBps) / 100).toFixed(2)}%)`);
  console.log(`Delivered Units:      ${consensus.deliveredUnits}`);
  console.log(`Evidence Hash:        ${consensus.evidenceHash}`);
  if (consensus.outliers.length > 0) {
    console.log(`Neutralized Outliers: ${consensus.outliers.join(", ")}`);
  }

  // Timestamp must be within [expectedStart, expectedEnd + 30] and <= block.timestamp + 30
  const submissionTimestamp = BigInt(expectedEnd);

  const slaReport = {
    contractId: activeContractId,
    epochId: BigInt(targetEpoch),
    p95LatencyMs: BigInt(consensus.medianLatencyMs),
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: BigInt(consensus.deliveredUnits),
    evidenceHash: consensus.evidenceHash as `0x${string}`,
    timestamp: submissionTimestamp,
    observerQuorum: consensus.quorumCount
  };

  // 6. Submit on-chain settlement
  if (process.env.SUBMIT_ONCHAIN !== "false") {
    console.log(`\n--- Submitting Settlement to Monad SettlementController ---`);
    console.log(`Calling settleEpoch for Epoch ${targetEpoch} (timestamp: ${submissionTimestamp})...`);

    try {
      const hash = await walletClient.writeContract({
        address: controllerAddress,
        abi: SettlementControllerABI,
        functionName: "settleEpoch",
        args: [slaReport]
      });

      console.log(`Tx Submitted: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Settled on Monad Testnet in block ${receipt.blockNumber}! Status: ${receipt.status}`);
      console.log(`Explorer: https://testnet.monadscan.com/tx/${hash}`);
      return { success: true, nextEpoch: targetEpoch + 1, totalEpochs };
    } catch (err: any) {
      console.error(`❌ [SettlementController] Reverted:`, err.shortMessage || err.message);
      return { success: false };
    }
  } else {
    console.log(`ℹ️ SUBMIT_ONCHAIN=false, skipping on-chain transaction.`);
    return { success: true, nextEpoch: targetEpoch + 1, totalEpochs };
  }
}

async function main() {
  const rawConfig = loadConfig();
  const configName = process.env.CRE_CONFIG || (process.env.CRE_ENV === "online" ? "config.online.json" : "config.json");
  console.log(`=== CompSentry CRE Workflow Runner (${configName}) ===`);

  const config = configSchema.parse(rawConfig);

  const cliContractArg = process.argv.find((arg, i, arr) => (arg === "--contract" || arg === "-c") && arr[i + 1])
    ? process.argv[process.argv.findIndex((a) => a === "--contract" || a === "-c") + 1]
    : undefined;
  const activeContractId = (process.env.CRE_CONTRACT || cliContractArg || config.contractId) as `0x${string}`;

  const isDaemon = process.argv.includes("--daemon") || process.env.CRE_DAEMON === "true";
  const cliOutageArg = process.env.CRE_OUTAGE === "true" || process.argv.includes("--outage");
  const outageEpochArg = process.argv.find((arg, i, arr) => (arg === "--outage-epoch") && arr[i + 1])
    ? Number(process.argv[process.argv.findIndex((a) => a === "--outage-epoch") + 1])
    : undefined;

  const controllerAddress = (config.evm.settlementControllerAddress || "0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f") as `0x${string}`;
  const hubAddress = (config.evm.hubAddress || "0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB") as `0x${string}`;

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey && process.env.SUBMIT_ONCHAIN !== "false") {
    throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required to submit on-chain settlements.");
  }

  const account = privateKey ? privateKeyToAccount(privateKey as `0x${string}`) : undefined;
  const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl)
  });

  const walletClient = account
    ? createWalletClient({
        account,
        chain: monadTestnet,
        transport: http(rpcUrl)
      })
    : null;

  if (isDaemon) {
    console.log(`\n🚀 [Daemon Mode Active] CRE will run continuously at fixed intervals until contract is finalized.`);
    if (outageEpochArg) {
      console.log(`   (Outage scheduled automatically for Epoch ${outageEpochArg})`);
    }

    let running = true;
    while (running) {
      // Determine if outage should be injected for this epoch
      const lastSettled = Number(
        await publicClient.readContract({
          address: controllerAddress,
          abi: SettlementControllerABI,
          functionName: "lastSettledEpoch",
          args: [activeContractId]
        })
      );
      const currentTarget = lastSettled + 1;
      const shouldOutage = cliOutageArg || (outageEpochArg !== undefined && currentTarget === outageEpochArg);

      const res = await settleSingleEpoch({
        activeContractId,
        config,
        publicClient,
        walletClient,
        forceOutage: shouldOutage,
        controllerAddress,
        hubAddress
      });

      if (!res.success) {
        console.log(`\n⏸️  Daemon paused. Retrying in 15 seconds...`);
        await new Promise((r) => setTimeout(r, 15000));
      } else if (res.nextEpoch && res.totalEpochs && res.nextEpoch > res.totalEpochs) {
        console.log(`\n🏁 Contract fully finalized! Exiting daemon.`);
        running = false;
      }
    }
  } else {
    // Single-epoch run
    await settleSingleEpoch({
      activeContractId,
      config,
      publicClient,
      walletClient,
      forceOutage: cliOutageArg,
      controllerAddress,
      hubAddress
    });
  }
}

main().catch(console.error);
