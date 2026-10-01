import { executeCREEpochSettlement } from "./workflow";

const contractId = process.argv[2] || process.env.CONTRACT_ID;
const intervalSec = parseInt(process.env.EPOCH_INTERVAL_SEC || "30", 10);

if (!contractId) {
  console.error("Usage: pnpm run daemon <contractId>");
  process.exit(1);
}

console.log(`[CRE Daemon] Starting automated epoch settlement loop for ${contractId} every ${intervalSec}s...`);

async function tick() {
  try {
    const result = await executeCREEpochSettlement(contractId!);
    if (!result) {
      console.log("[CRE Daemon] Contract finished. Exiting daemon.");
      process.exit(0);
    }
  } catch (err: any) {
    console.error(`[CRE Daemon Error] ${err.message}`);
  }
}

// Initial run
tick();
setInterval(tick, intervalSec * 1000);
