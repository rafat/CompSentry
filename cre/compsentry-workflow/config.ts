import { z } from "zod";

export const configSchema = z
  .object({
    schedule: z.string().default("*/30 * * * * *"), // Cron every 30s matching epoch duration
    contractId: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "contractId must be a valid 32-byte hex string (0x + 64 hex chars)"),
    minObserverQuorum: z.number().int().min(1).max(3).default(2),
    observers: z
      .array(z.string().url())
      .min(1)
      .default([
        "http://localhost:4001/telemetry",
        "http://localhost:4002/telemetry",
        "http://localhost:4003/telemetry"
      ]),
    evm: z.object({
      chainSelectorName: z.string().default("monad-testnet"),
      settlementControllerAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "settlementControllerAddress must be a valid 20-byte EVM address"),
      hubAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "hubAddress must be a valid 20-byte EVM address")
    })
  })
  .refine((data) => data.minObserverQuorum <= data.observers.length, {
    message: "minObserverQuorum cannot exceed the number of configured observers"
  });

export type Config = z.infer<typeof configSchema>;
