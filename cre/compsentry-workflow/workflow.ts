import {
  cre,
  type Runtime,
  type CronPayload,
  type HTTPSendRequester,
  bytesToHex,
  encodeCallMsg,
  getNetwork,
  prepareReportRequest,
  LAST_FINALIZED_BLOCK_NUMBER,
  ok,
  json,
  Runner,
  consensusIdenticalAggregation
} from "@chainlink/cre-sdk";
import {
  type Address,
  decodeFunctionResult,
  encodeFunctionData,
  zeroAddress
} from "viem";
import { computeConsensus, type ObserverTelemetry } from "./consensus.js";
import { type Config, configSchema } from "./config.js";
import SettlementControllerABI from "./abi/SettlementController.json" with { type: "json" };
import ComputeSLAHubABI from "./abi/ComputeSLAHub.json" with { type: "json" };

/**
 * @notice Helper function executed across DON nodes to fetch observer telemetry
 */
const fetchObserverTelemetry = (
  sendRequester: HTTPSendRequester,
  url: string
): ObserverTelemetry => {
  const response = sendRequester.sendRequest({ url, method: "GET" }).result();
  if (!ok(response)) {
    throw new Error(`Observer probe request to ${url} failed with status: ${response.statusCode}`);
  }
  return json(response) as ObserverTelemetry;
};

/**
 * @notice CompSentry Chainlink Runtime Environment (CRE) SLA Consensus Workflow
 * @dev Coordinates decentralized DON execution:
 *      1. Triggered on recurring cron schedule matching SLA epoch duration
 *      2. Reads on-chain SLA parameters and settled epoch state
 *      3. Queries multiple independent observer probes via CRE HTTP capability with DON consensus
 *      4. Reaches DON consensus on median P95 latency and availability
 *      5. Submits cryptographically committed SLAReport to Monad SettlementController
 */
export async function onEpochCronTrigger(
  runtime: Runtime<Config>,
  _payload: CronPayload
) {
  runtime.log(`[CRE Workflow] Executing CompSentry SLA verification cycle for contract ${runtime.config.contractId}...`);

  // 1. Initialize EVM capability on Monad Testnet
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evm.chainSelectorName || "monad-testnet",
    isTestnet: true
  });

  if (!network) {
    throw new Error(
      `Unsupported CRE network: ${runtime.config.evm.chainSelectorName}. Please ensure this network is registered in CRE SDK.`
    );
  }

  const chainSelector = network.chainSelector.selector;
  const evmClient = new cre.capabilities.EVMClient(chainSelector);

  const controllerAddress = runtime.config.evm.settlementControllerAddress as Address;
  const hubAddress = runtime.config.evm.hubAddress as Address;
  const contractId = runtime.config.contractId as `0x${string}`;

  // 2. EVM Read: Fetch last settled epoch from SettlementController
  const lastEpochCallData = encodeFunctionData({
    abi: SettlementControllerABI,
    functionName: "lastSettledEpoch",
    args: [contractId]
  });

  const lastEpochCallResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: controllerAddress,
        data: lastEpochCallData
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER
    })
    .result();

  const lastSettledEpoch = Number(
    decodeFunctionResult({
      abi: SettlementControllerABI,
      functionName: "lastSettledEpoch",
      data: bytesToHex(lastEpochCallResult.data)
    })
  );

  // 3. EVM Read: Fetch SLA contract details from ComputeSLAHub
  const contractCallData = encodeFunctionData({
    abi: ComputeSLAHubABI,
    functionName: "getContract",
    args: [contractId]
  });

  const contractCallResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: hubAddress,
        data: contractCallData
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER
    })
    .result();

  const slaContract = decodeFunctionResult({
    abi: ComputeSLAHubABI,
    functionName: "getContract",
    data: bytesToHex(contractCallResult.data)
  }) as any;

  const targetEpoch = lastSettledEpoch + 1;
  const totalEpochs = Number(slaContract.totalEpochs);

  if (targetEpoch > totalEpochs) {
    runtime.log(`[CRE Workflow] Contract ${contractId} has already completed all ${totalEpochs} epochs.`);
    return { status: "COMPLETED", lastSettledEpoch, totalEpochs };
  }

  // 4. Deterministic Epoch Time Window Calculation (derived strictly from contract parameters)
  const startTimestamp = Number(slaContract.startTimestamp);
  const epochDuration = Number(slaContract.epochDuration);

  const windowStart = startTimestamp + (targetEpoch - 1) * epochDuration;
  const windowEnd = windowStart + epochDuration;

  runtime.log(
    `[CRE Workflow] Evaluating Target Epoch ${targetEpoch}/${totalEpochs} (Window: ${windowStart} -> ${windowEnd})`
  );

  // 5. HTTP Fetch: Query 3 independent observer probes via CRE HTTP capability
  const httpClient = new cre.capabilities.HTTPClient();
  const rawObservations: ObserverTelemetry[] = [];

  for (const observerBaseUrl of runtime.config.observers) {
    const url = `${observerBaseUrl}?contractId=${contractId}&epochId=${targetEpoch}&windowStart=${windowStart}&windowEnd=${windowEnd}`;
    try {
      const fetchWithConsensus = httpClient.sendRequest(
        runtime,
        fetchObserverTelemetry,
        consensusIdenticalAggregation<ObserverTelemetry>()
      );
      const telemetry = fetchWithConsensus(url).result();
      rawObservations.push(telemetry);
      runtime.log(`[CRE Workflow] Received telemetry from ${telemetry.observerId}: ${telemetry.p95LatencyMs}ms, ${telemetry.availabilityBps / 100}% avail`);
    } catch (err: any) {
      runtime.log(`[CRE Workflow] Observer ${observerBaseUrl} query failed: ${err.message}`);
    }
  }

  // 6. Deterministic Consensus Aggregation (median P95 latency + median availability + evidence commitment)
  const consensus = computeConsensus(
    rawObservations,
    {
      contractId,
      epochId: targetEpoch,
      windowStart,
      windowEnd
    },
    runtime.config.minObserverQuorum
  );

  runtime.log(
    `[CRE Consensus] Epoch ${targetEpoch} Consensus: Median Latency = ${consensus.medianLatencyMs}ms, Availability = ${consensus.consensusAvailabilityBps / 100}%, Quorum = ${consensus.quorumCount}`
  );

  // 7. Construct Objective SLAReport (Stripped of financial outcomes)
  // NOTE: SLAReport.timestamp represents the canonical epoch observation boundary (windowEnd),
  // while the evidence hash commits to the underlying observer measurements and their timestamps.
  const slaReport = {
    contractId,
    epochId: BigInt(targetEpoch),
    p95LatencyMs: BigInt(consensus.medianLatencyMs),
    availabilityBps: consensus.consensusAvailabilityBps,
    deliveredUnits: BigInt(consensus.deliveredUnits),
    evidenceHash: consensus.evidenceHash as `0x${string}`,
    timestamp: BigInt(windowEnd), // Strict deterministic epoch boundary timestamp
    observerQuorum: consensus.quorumCount
  };

  // 8. EVM Write: Prepare and write report to Monad SettlementController
  const writeData = encodeFunctionData({
    abi: SettlementControllerABI,
    functionName: "settleEpoch",
    args: [slaReport]
  });

  const report = runtime.report(prepareReportRequest(writeData)).result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: controllerAddress,
      report
    })
    .result();

  runtime.log(`[CRE Settlement] Successfully written report to SettlementController for Epoch ${targetEpoch}. Tx Status: ${writeResult.txStatus}`);

  return {
    contractId,
    epochId: targetEpoch,
    consensus,
    txStatus: writeResult.txStatus
  };
}

export const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  return [
    cre.handler(
      cron.trigger({ schedule: config.schedule }),
      onEpochCronTrigger
    )
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configParser: (c: any) => configSchema.parse(c)
  });
  await runner.run(initWorkflow);
}
