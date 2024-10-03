import { SetupCache, SetupCacheEntry } from "@src/types/cache/circuits-setup-cache";
import { CompileCache, CompileCacheEntry } from "@src/types/cache/circuits-compile-cache";

export type BaseCacheType = SetupCache | CompileCache;

export type BaseCacheEntry = SetupCacheEntry | CompileCacheEntry;
