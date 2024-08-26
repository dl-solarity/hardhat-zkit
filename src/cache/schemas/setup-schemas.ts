import { z } from "zod";

export const ContributionTemplateTypeSchema = z.literal("groth16");

export const ContributionSettingsSchema = z.object({
  contributionTemplate: ContributionTemplateTypeSchema,
  contributions: z.number(),
});

export const SetupCacheEntrySchema = z.object({
  circuitSourceName: z.string(),
  r1csContentHash: z.string(),
  r1csSourcePath: z.string(),
  contributionSettings: ContributionSettingsSchema,
});

export const SetupCacheSchema = z.object({
  _format: z.string(),
  files: z.record(z.string(), SetupCacheEntrySchema),
});
