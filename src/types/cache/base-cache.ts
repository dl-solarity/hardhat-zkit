import { z } from "zod";

import { SetupCacheEntry } from "./circuits-setup-cache";
import { CompileCacheEntry } from "./circuits-compile-cache";

export type BaseCacheEntry = SetupCacheEntry | CompileCacheEntry;

export type BaseCacheType<T extends BaseCacheEntry> = {
  _format: string;
  files: Record<string, T>;
};

export type BaseCacheSchema = z.ZodObject<{
  _format: z.ZodString;
  files: z.ZodRecord;
}>;
