import { BigIntOrNestedArray } from "@distributedlab/circom-parser";
import { z } from "zod";

/**
 * {@link https://github.com/colinhacks/zod | Zod} schema for defining a recursive type {@link BigIntOrNestedArray}.
 *
 * This schema allows for either a `BigInt` value or an array that contains
 * other `BigInt` values or nested arrays of `BigInt` values, recursively.
 */
export const BigIntOrNestedArraySchema: z.ZodType<BigIntOrNestedArray> = z.lazy(() =>
  z.union([z.bigint(), BigIntOrNestedArraySchema.array()]),
);

export const SignalTypeSchema = z.literal("Input").or(z.literal("Output")).or(z.literal("Intermediate"));
export const VisibilityTypeSchema = z.literal("Public").or(z.literal("Private"));

export const PragmaComponentSchema = z.object({
  isCustom: z.boolean(),
  compilerVersion: z.string(),
});

export const InputDataSchema = z.object({
  dimension: z.string().array(),
  type: z.string(),
});

export const TemplateSchema = z.object({
  inputs: z.record(z.string(), InputDataSchema),
  parameters: z.string().array(),
  isCustom: z.boolean(),
});

export const TemplatesSchema = z.record(z.string(), TemplateSchema);

export const MainComponentSchema = z.object({
  templateName: z.union([z.string(), z.null()]),
  publicInputs: z.string().array(),
  parameters: BigIntOrNestedArraySchema.array(),
});

export const ParsedCircomFileDataSchema = z.object({
  pragmaInfo: PragmaComponentSchema,
  includes: z.string().array(),
  templates: TemplatesSchema,
  mainComponentInfo: MainComponentSchema,
});

export const SignalInfoSchema = z.object({
  name: z.string(),
  dimension: z.string().array(),
  type: SignalTypeSchema,
  visibility: VisibilityTypeSchema,
});

export const ResolvedMainComponentDataSchema = z.object({
  parameters: z.record(z.string(), BigIntOrNestedArraySchema),
  signals: SignalInfoSchema.array(),
});

export const CompileFlagsSchema = z.object({
  r1cs: z.boolean(),
  wasm: z.boolean(),
  sym: z.boolean(),
  json: z.boolean(),
  c: z.boolean(),
  O0: z.boolean(),
  O1: z.boolean(),
  O2: z.boolean(),
});

export const ResolvedFileDataSchema = z.object({
  parsedFileData: ParsedCircomFileDataSchema,
  mainComponentData: ResolvedMainComponentDataSchema.optional(),
});

export const CompileCacheEntrySchema = z.object({
  lastModificationDate: z.number(),
  contentHash: z.string(),
  sourceName: z.string(),
  compileFlags: CompileFlagsSchema,
  fileData: ResolvedFileDataSchema,
});

export const CompileCacheSchema = z.object({
  _format: z.string(),
  files: z.record(z.string(), CompileCacheEntrySchema),
});
