import fsExtra from "fs-extra";

import { ProvingSystemType } from "@solarity/zkit";
import { defaultCompileFlags, defaultContributionSettings } from "./constants.js";
import { CompileFlags } from "../src/types/core/compiler/circom-compiler.js";
import { CompileCacheEntry } from "../src/types/cache/circuits-compile-cache.js";
import { getNormalizedFullPath } from "../src/utils/path-utils.js";
import { getFileHash } from "../src/utils/utils.js";
import { CircomFilesParser } from "../src/core/resolve/parser/CircomFilesParser.js";
import { ResolvedFileData } from "../src/types/core/dependencies/circom-files-resolver.js";
import { ProvingSystemData, SetupCacheEntry } from "../src/types/cache/circuits-setup-cache.js";

export async function getCompileCacheEntry(
  projectRoot: string,
  sourceName: string,
  compileFlags: CompileFlags = defaultCompileFlags,
  contentHash?: string,
): Promise<CompileCacheEntry> {
  const circuitPath = getNormalizedFullPath(projectRoot, sourceName);

  if (!contentHash) {
    contentHash = await getFileHash(circuitPath);
  }

  const parser: CircomFilesParser = new CircomFilesParser();
  const fileData: ResolvedFileData = parser.parse(
    fsExtra.readFileSync(circuitPath, "utf-8"),
    circuitPath,
    await contentHash,
  );

  const stats = await fsExtra.stat(circuitPath);
  const lastModificationDate: Date = new Date(stats.ctime);

  return {
    sourceName,
    contentHash,
    lastModificationDate: lastModificationDate.valueOf(),
    compileFlags,
    fileData,
  };
}

export async function getSetupCacheEntry(
  sourceName: string,
  r1csSourcePath: string,
  provingSystemsData?: ProvingSystemData[],
): Promise<SetupCacheEntry> {
  if (!provingSystemsData) {
    provingSystemsData = await Promise.all(
      defaultContributionSettings.provingSystems.map(async (provingSystem) => {
        return {
          provingSystem: provingSystem,
          lastR1CSFileHash: await getFileHash(r1csSourcePath),
        };
      }),
    );
  }

  return {
    circuitSourceName: sourceName,
    r1csSourcePath,
    provingSystemsData,
    contributionsNumber: defaultContributionSettings.contributions,
  };
}

export function updateInclude(filePath: string, newIncludePath: string) {
  const fileContent = fsExtra.readFileSync(filePath, "utf-8");

  const updatedContent = fileContent.replace(/include\s*".*";/, `include "${newIncludePath}";`);

  fsExtra.writeFileSync(filePath, updatedContent, "utf-8");
}

export function updateProvingSystems(filePath: string, newProvingSystems: ProvingSystemType[]) {
  const fileContent = fsExtra.readFileSync(filePath, "utf-8");

  const provingSystemsStr: string = newProvingSystems
    .map((provingSystem: ProvingSystemType) => {
      return `"${provingSystem}"`;
    })
    .join(",");

  const updatedContent = fileContent.replace(
    /provingSystem: \[("\w+"|, *)+\],/,
    `provingSystem: [${provingSystemsStr}],`,
  );

  fsExtra.writeFileSync(filePath, updatedContent, "utf-8");
}

export function updateTypesDir(filePath: string, prevTypesDir: string, newTypesDir: string) {
  const fileContent = fsExtra.readFileSync(filePath, "utf-8");

  const updatedContent = fileContent.replace(/typesDir: "[\w\-/]+",/, `typesDir: "${newTypesDir}",`);

  fsExtra.writeFileSync(filePath, updatedContent, "utf-8");
  fsExtra.rmSync(prevTypesDir, { force: true, recursive: true });
}
