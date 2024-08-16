import { BigIntOrNestedArray } from "@distributed-lab/circom-parser";
import { z } from "zod";

export const BigIntOrNestedArraySchema: z.ZodType<BigIntOrNestedArray> = z.lazy(() =>
  z.union([z.bigint(), BigIntOrNestedArraySchema.array()]),
);

export const PragmaComponentSchema = z.object({
  isCustom: z.boolean(),
  compilerVersion: z.string(),
});

export const TemplateSchema = z.object({
  inputs: z
    .object({
      name: z.string(),
      dimension: z.string().array(),
      type: z.string(),
    })
    .array(),
  parameters: z.string().array(),
  isCustom: z.boolean(),
});

export const TemplatesSchema = z.record(z.string(), TemplateSchema);

export const MainComponentSchema = z.object({
  templateName: z.union([z.string(), z.null()]),
  publicInputs: z.string().array(),
  parameters: BigIntOrNestedArraySchema.array(),
});

export const CircomFileDataSchema = z.object({
  pragmaInfo: PragmaComponentSchema,
  includes: z.string().array(),
  templates: TemplatesSchema,
  mainComponentInfo: MainComponentSchema,
});

export const CompileFlagsSchema = z.object({
  r1cs: z.boolean(),
  wasm: z.boolean(),
  sym: z.boolean(),
  json: z.boolean(),
  c: z.boolean(),
});

export const CompileCacheEntrySchema = z.object({
  lastModificationDate: z.number(),
  contentHash: z.string(),
  sourceName: z.string(),
  compileFlags: CompileFlagsSchema,
  fileData: CircomFileDataSchema,
});

export const CompileCacheSchema = z.object({
  _format: z.string(),
  files: z.record(z.string(), CompileCacheEntrySchema),
});
