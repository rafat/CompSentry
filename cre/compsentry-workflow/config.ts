import { z } from "zod";

export const configSchema = z.object({
  schedule: z.string().default("*/30 * * * * *"), // Cron every 30s matching epoch duration
  contractId: z.string(),
  minObserverQuorum: z.number().default(2),
  observers: z
    .array(z.string())
    .default([
      "http://localhost:4001/telemetry",
      "http://localhost:4002/telemetry",
      "http://localhost:4003/telemetry"
    ]),
  evm: z.object({
    chainSelectorName: z.string().default("monad-testnet"),
    settlementControllerAddress: z.string(),
    hubAddress: z.string()
  })
});

export type Config = z.infer<typeof configSchema>;
