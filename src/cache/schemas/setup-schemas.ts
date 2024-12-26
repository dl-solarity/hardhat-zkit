import { z } from "zod";

export const ProvingSystemTypeSchema = z.enum(["groth16", "plonk"]);

export const ProvingSystemDataSchema = z.object({
  provingSystem: ProvingSystemTypeSchema,
  lastR1CSFileHash: z.string(),
});

export const SetupCacheEntrySchema = z.object({
  circuitSourceName: z.string(),
  r1csSourcePath: z.string(),
  provingSystemsData: ProvingSystemDataSchema.array(),
  contributionsNumber: z.number(),
});

export const SetupCacheSchema = z.object({
  _format: z.string(),
  files: z.record(z.string(), SetupCacheEntrySchema),
});
