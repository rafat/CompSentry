import { executeCREEpochSettlement } from "./workflow";

async function main() {
  const contractId = process.argv[2] || process.env.CONTRACT_ID;
  if (!contractId) {
    console.error("Usage: pnpm run run-epoch <contractId>");
    process.exit(1);
  }

  try {
    await executeCREEpochSettlement(contractId);
  } catch (err: any) {
    console.error("[CRE Workflow Error]", err);
    process.exit(1);
  }
}

main();
