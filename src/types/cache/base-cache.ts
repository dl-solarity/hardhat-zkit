import { z } from "zod";

export type BaseCacheType<T> = {
  _format: string;
  files: Record<string, T>;
};

export type BaseCacheSchema = z.ZodObject<{
  _format: z.ZodString;
  files: z.ZodRecord;
}>;
