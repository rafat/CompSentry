import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeConsensus, type ObserverTelemetry } from "./consensus.js";
import { configSchema } from "./config.js";
import defaultRawConfig from "./config.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const configFile = process.env.CRE_CONFIG || (process.env.CRE_ENV === "online" ? "config.online.json" : "config.json");
  const configPath = path.resolve(__dirname, configFile);
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return defaultRawConfig;
}

async function runLocalSimulation() {
  const rawConfig = loadConfig();
  const configName = process.env.CRE_CONFIG || (process.env.CRE_ENV === "online" ? "config.online.json" : "config.json");
  console.log(`=== CompSentry CRE Workflow Simulation (${configName}) ===`);

  const config = configSchema.parse(rawConfig);

  const cliContractArg = process.argv.find((arg, i, arr) => (arg === "--contract" || arg === "-c") && arr[i + 1])
    ? process.argv[process.argv.findIndex((a) => a === "--contract" || a === "-c") + 1]
    : undefined;
  const activeContractId = (process.env.CRE_CONTRACT || cliContractArg || config.contractId) as `0x${string}`;

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 30;
  const windowEnd = now;

  console.log(`Contract: ${activeContractId}`);
  console.log(`Epoch Window: ${windowStart} -> ${windowEnd} (30s duration)`);
  console.log(`Polling Observers: ${config.observers.join(", ")}`);

  const rawObservations: ObserverTelemetry[] = [];

  for (const observerBaseUrl of config.observers) {
    const url = `${observerBaseUrl}?contractId=${config.contractId}&windowStart=${windowStart}&windowEnd=${windowEnd}`;
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

  if (rawObservations.length < config.minObserverQuorum) {
    console.error(
      `[CRE Consensus] FAILED: Quorum not met (${rawObservations.length}/${config.minObserverQuorum})`
    );
    return;
  }

  const consensus = computeConsensus(
    rawObservations,
    {
      contractId: activeContractId,
      epochId: 1,
      windowStart,
      windowEnd
    },
    config.minObserverQuorum
  );

  console.log("\n--- CRE Consensus Reached ---");
  console.log(`Quorum: ${consensus.quorumCount}/${config.observers.length}`);
  console.log(`Median P95 Latency: ${consensus.medianLatencyMs}ms`);
  console.log(`Consensus Availability: ${consensus.consensusAvailabilityBps / 100}%`);
  console.log(`Delivered Units: ${consensus.deliveredUnits}`);
  console.log(`Evidence Hash: ${consensus.evidenceHash}`);
  if (consensus.outliers.length > 0) {
    console.log(`Neutralized Outliers: ${consensus.outliers.join(", ")}`);
  }

  console.log("\n--- Objective SLAReport Generated for Monad SettlementController ---");
  const slaReport = {
    contractId: activeContractId,
    epochId: 1,
    p95LatencyMs: consensus.medianLatencyMs,
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: consensus.deliveredUnits,
    evidenceHash: consensus.evidenceHash,
    timestamp: windowEnd,
    observerQuorum: consensus.quorumCount
  };
  console.log(JSON.stringify(slaReport, null, 2));

  if (process.env.SUBMIT_ONCHAIN !== "false") {
    try {
      const { createWalletClient, createPublicClient, http } = await import("viem");
      const { privateKeyToAccount } = await import("viem/accounts");
      const SettlementControllerABI = (await import("./abi/SettlementController.json", { with: { type: "json" } })).default;

      console.log("\n--- Submitting Settlement to Monad SettlementController ---");
      const monadTestnet = {
        id: 10143,
        name: "Monad Testnet",
        nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
        rpcUrls: {
          default: { http: [process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"] }
        }
      } as const;

      const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required to submit on-chain settlements.");
      }
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz")
      });
      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz")
      });

      const controllerAddress = (config.evm.settlementControllerAddress || "0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f") as `0x${string}`;

      let targetEpoch = 1n;
      try {
        const lastEpoch = (await publicClient.readContract({
          address: controllerAddress,
          abi: SettlementControllerABI,
          functionName: "lastSettledEpoch",
          args: [activeContractId]
        })) as bigint;
        targetEpoch = lastEpoch + 1n;
      } catch (e) {
        targetEpoch = 1n;
      }
      console.log(`Settling for Contract ${activeContractId} -> Target Epoch: ${targetEpoch}`);

      const hash = await walletClient.writeContract({
        address: controllerAddress,
        abi: SettlementControllerABI,
        functionName: "settleEpoch",
        args: [{
          contractId: activeContractId,
          epochId: targetEpoch,
          p95LatencyMs: BigInt(slaReport.p95LatencyMs),
          availabilityBps: slaReport.availabilityBps,
          deliveredUnits: BigInt(slaReport.deliveredUnits),
          evidenceHash: slaReport.evidenceHash as `0x${string}`,
          timestamp: BigInt(slaReport.timestamp),
          observerQuorum: slaReport.observerQuorum
        }]
      });
      console.log(`Settlement Tx Submitted: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Settled on Monad Testnet in block ${receipt.blockNumber}! Status: ${receipt.status}`);
      console.log(`MonadScan Explorer: https://testnet.monadscan.com/tx/${hash}`);
    } catch (err: any) {
      console.warn(`[SettlementController] On-chain broadcast notice: ${err.shortMessage || err.message}`);
    }
  }
}

runLocalSimulation().catch(console.error);

