import os from "os";
import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";

import * as snarkjs from "snarkjs";

import { task, subtask, types } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_READ_FILE } from "hardhat/builtin-tasks/task-names";
import { localPathToSourceName, localSourceNameToPath } from "hardhat/utils/source-names";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";

import {
  TASK_CIRCUITS_COMPILE,
  TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS,
  TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES,
  TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH,
  TASK_CIRCUITS_COMPILE_GET_REMAPPINGS,
  TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE,
  TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS,
  TASK_CIRCUITS_COMPILE_FILTER_SOURCE_PATHS,
  TASK_CIRCUITS_COMPILE_GET_CIRCOM_COMPILER,
  TASK_CIRCUITS_COMPILE_COMPILE_CIRCUIT,
  TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES,
  TASK_CIRCUITS_COMPILE_GET_CIRCUIT_COMPILATION_INFO,
  TASK_CIRCUITS_COMPILE_GET_PTAU_FILE,
  TASK_CIRCUITS_COMPILE_GET_CONSTRAINTS_NUMBER,
  TASK_CIRCUITS_COMPILE_DOWNLOAD_PTAU_FILE,
  TASK_CIRCUITS_COMPILE_GENERATE_ZKEY_FILES,
  TASK_CIRCUITS_COMPILE_GENERATE_VKEY_FILES,
  TASK_CIRCUITS_COMPILE_MOVE_FROM_TEMP_TO_ARTIFACTS,
  TASK_CIRCUITS_COMPILE_VALIDATE_RESOLVED_FILES_TO_COMPILE,
} from "./task-names";

import {
  getArtifactsDirFullPath,
  getCircuitsDirFullPath,
  getCircomFilesCachePath,
  getPtauDirFullPath,
} from "../utils/path-utils";

import { ResolvedFileWithDependencies, CompileOptions, CircuitCompilationInfo, PtauInfo } from "../types/compile";
import { Parser } from "../internal/Parser";
import { ResolvedFile, Resolver } from "../internal/Resolver";
import { DependencyGraph } from "../internal/DependencyGraph";
import { CircomCircuitsCache } from "../internal/CircomCircuitsCache";
import { FileFilterSettings, ContributionTemplateType } from "../types/zkit-config";
import { MAIN_COMPONENT_REG_EXP, MAX_PTAU_ID, PTAU_FILE_REG_EXP } from "../internal/constants";
import { DuplicateCircuitsNameError, NonExistentR1CSHeader } from "../errors";
import { downloadFile, readDirRecursively } from "../utils/utils";

// eslint-disable-next-line
const { Context, CircomRunner, bindings } = require("@distributedlab/circom2");

subtask(TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS)
  .addParam("sourcePath", undefined, undefined, types.string)
  .setAction(async ({ sourcePath }: { sourcePath: string }): Promise<string[]> => {
    return getAllFilesMatching(sourcePath, (f) => f.endsWith(".circom"));
  });

subtask(TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES)
  .addParam("projectRoot", undefined, undefined, types.string)
  .addParam("sourcePaths", undefined, undefined, types.any)
  .setAction(
    async ({ projectRoot, sourcePaths }: { projectRoot: string; sourcePaths: string[] }): Promise<string[]> => {
      return Promise.all(sourcePaths.map((p) => localPathToSourceName(projectRoot, p)));
    },
  );

subtask(TASK_CIRCUITS_COMPILE_FILTER_SOURCE_PATHS)
  .addParam("circuitsRoot", undefined, undefined, types.string)
  .addParam("sourcePaths", undefined, undefined, types.any)
  .addParam("filterSettings", undefined, undefined, types.any)
  .setAction(
    async ({
      circuitsRoot,
      sourcePaths,
      filterSettings,
    }: {
      circuitsRoot: string;
      sourcePaths: string[];
      filterSettings: FileFilterSettings;
    }): Promise<string[]> => {
      return sourcePaths.filter((sourceName: string) => {
        return (
          (filterSettings.onlyFiles.length == 0 || contains(circuitsRoot, filterSettings.onlyFiles, sourceName)) &&
          !contains(circuitsRoot, filterSettings.skipFiles, sourceName)
        );
      });
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GET_CIRCOM_COMPILER).setAction(async (): Promise<typeof Context> => {
  return fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm"));
});

subtask(TASK_CIRCUITS_COMPILE_GET_CIRCUIT_COMPILATION_INFO)
  .addParam("circuitsDirFullPath", undefined, undefined, types.string)
  .addParam("artifactsDirFullPath", undefined, undefined, types.string)
  .addParam("resolvedFile", undefined, undefined, types.any)
  .addParam("compileOptions", undefined, undefined, types.any)
  .addParam("tempArtifactsPath", undefined, undefined, types.string)
  .setAction(
    async ({
      circuitsDirFullPath,
      artifactsDirFullPath,
      resolvedFile,
      compileOptions,
      tempArtifactsPath,
    }: {
      circuitsDirFullPath: string;
      artifactsDirFullPath: string;
      resolvedFile: ResolvedFile;
      compileOptions: CompileOptions;
      tempArtifactsPath: string;
    }): Promise<CircuitCompilationInfo> => {
      const args = [resolvedFile.absolutePath, "--r1cs", "--wasm"];

      compileOptions.sym && args.push("--sym");
      compileOptions.json && args.push("--json");
      compileOptions.c && args.push("--c");

      args.push("-o", tempArtifactsPath);

      return {
        circuitName: path.parse(resolvedFile.absolutePath).name,
        artifactsPath: resolvedFile.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath),
        tempArtifactsPath,
        compilationArgs: args,
        resolvedFile,
        compileOptions,
      };
    },
  );

subtask(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUIT)
  .addParam("compilationArgs", undefined, undefined, types.any)
  .addFlag("quiet", undefined)
  .setAction(
    async (
      {
        compilationArgs,
        quiet,
      }: {
        compilationArgs: string[];
        quiet: boolean;
      },
      { run },
    ) => {
      const compiler: typeof Context = await run(TASK_CIRCUITS_COMPILE_GET_CIRCOM_COMPILER);
      const circomRunner: typeof CircomRunner = new CircomRunner({
        args: compilationArgs,
        preopens: { "/": "/" },
        bindings: {
          ...bindings,
          exit(code: number) {
            throw new Error(`Compilation error. Exit code: ${code}.`);
          },
          fs,
        },
        quiet,
      });

      try {
        await circomRunner.execute(compiler);
      } catch (err) {
        if (quiet) {
          throw new Error(
            'Compilation failed with an unknown error. Consider passing "quiet=false" flag to see the compilation error.',
            { cause: err },
          );
        }

        throw new Error("Compilation failed.", { cause: err });
      }
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GET_REMAPPINGS).setAction(async (): Promise<Record<string, string>> => {
  return {};
});

subtask(TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH)
  .addOptionalParam("rootPath", undefined, undefined, types.string)
  .addParam("sourceNames", undefined, undefined, types.any)
  .addOptionalParam("circuitFilesCache", undefined, undefined, types.any)
  .setAction(
    async (
      {
        rootPath,
        sourceNames,
        circuitFilesCache,
      }: {
        rootPath?: string;
        sourceNames: string[];
        circuitFilesCache?: CircomCircuitsCache;
      },
      { config, run },
    ): Promise<DependencyGraph> => {
      const parser = new Parser(circuitFilesCache);
      const remappings = await run(TASK_CIRCUITS_COMPILE_GET_REMAPPINGS);
      const resolver = new Resolver(rootPath ?? config.paths.root, parser, remappings, (absolutePath: string) =>
        run(TASK_COMPILE_SOLIDITY_READ_FILE, { absolutePath }),
      );

      const resolvedFiles = await Promise.all(sourceNames.map((sn) => resolver.resolveSourceName(sn)));

      return DependencyGraph.createFromResolvedFiles(resolver, resolvedFiles);
    },
  );

subtask(TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE)
  .addParam("resolvedFilesToCompile", undefined, undefined, types.any)
  .addParam("dependencyGraph", undefined, undefined, types.any)
  .addParam("circuitFilesCache", undefined, undefined, types.any)
  .addParam("compileOptions", undefined, undefined, types.any)
  .addFlag("force", undefined)
  .setAction(
    async ({
      resolvedFilesToCompile,
      dependencyGraph,
      circuitFilesCache,
      compileOptions,
      force,
    }: {
      resolvedFilesToCompile: ResolvedFile[];
      dependencyGraph: DependencyGraph;
      circuitFilesCache: CircomCircuitsCache;
      compileOptions: CompileOptions;
      force: boolean;
    }): Promise<ResolvedFileWithDependencies[]> => {
      const resolvedFilesWithDependecies: ResolvedFileWithDependencies[] = [];

      for (const file of resolvedFilesToCompile) {
        resolvedFilesWithDependecies.push({
          resolvedFile: file,
          dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
        });
      }

      if (!force) {
        return resolvedFilesWithDependecies.filter((file) => needsCompilation(file, circuitFilesCache, compileOptions));
      }

      return resolvedFilesWithDependecies;
    },
  );

subtask(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS)
  .addParam("tempDir", undefined, undefined, types.string)
  .addParam("circuitsDirFullPath", undefined, undefined, types.string)
  .addParam("artifactsDirFullPath", undefined, undefined, types.string)
  .addParam("resolvedFilesToCompile", undefined, undefined, types.any)
  .addParam("compileOptions", undefined, undefined, types.any)
  .setAction(
    async (
      {
        tempDir,
        circuitsDirFullPath,
        artifactsDirFullPath,
        resolvedFilesToCompile,
        compileOptions,
      }: {
        tempDir: string;
        circuitsDirFullPath: string;
        artifactsDirFullPath: string;
        resolvedFilesToCompile: ResolvedFile[];
        compileOptions: CompileOptions;
      },
      { run },
    ): Promise<CircuitCompilationInfo[]> => {
      return await Promise.all(
        resolvedFilesToCompile.map(async (file: ResolvedFile): Promise<CircuitCompilationInfo> => {
          const tempArtifactsPath: string = localSourceNameToPath(tempDir, file.sourceName);

          const compilationInfo: CircuitCompilationInfo = await run(
            TASK_CIRCUITS_COMPILE_GET_CIRCUIT_COMPILATION_INFO,
            {
              circuitsDirFullPath,
              artifactsDirFullPath,
              resolvedFile: file,
              compileOptions,
              tempArtifactsPath,
            },
          );

          fs.mkdirSync(tempArtifactsPath, { recursive: true });

          await run(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUIT, {
            compilationArgs: compilationInfo.compilationArgs,
            quiet: compileOptions.quiet,
          });

          return compilationInfo;
        }),
      );
    },
  );

subtask(TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES)
  .addParam("resolvedFiles", undefined, undefined, types.any)
  .addParam("sourceNames", undefined, undefined, types.any)
  .addFlag("withMainComponent", undefined)
  .setAction(
    async ({
      resolvedFiles,
      sourceNames,
      withMainComponent,
    }: {
      resolvedFiles: ResolvedFile[];
      sourceNames: string[];
      withMainComponent: boolean;
    }): Promise<ResolvedFile[]> => {
      return resolvedFiles.filter((file: ResolvedFile) => {
        return (!withMainComponent || hasMainComponent(file)) && sourceNames.includes(file.sourceName);
      });
    },
  );

subtask(TASK_CIRCUITS_COMPILE_VALIDATE_RESOLVED_FILES_TO_COMPILE)
  .addParam("resolvedFiles", undefined, undefined, types.any)
  .setAction(async ({ resolvedFiles }: { resolvedFiles: ResolvedFile[] }) => {
    const circuitsNameCount = {} as Record<string, ResolvedFile>;

    resolvedFiles.forEach((file: ResolvedFile) => {
      const circuitName = path.parse(file.absolutePath).name;

      if (circuitsNameCount[circuitName]) {
        throw new DuplicateCircuitsNameError(file.sourceName, circuitsNameCount[circuitName].sourceName);
      }

      circuitsNameCount[circuitName] = file;
    });
  });

subtask(TASK_CIRCUITS_COMPILE_GET_CONSTRAINTS_NUMBER)
  .addParam("compilationInfo", undefined, undefined, types.any)
  .setAction(async ({ compilationInfo }: { compilationInfo: CircuitCompilationInfo }) => {
    const r1csFileName = `${compilationInfo.circuitName}.r1cs`;
    const r1csFile = localSourceNameToPath(compilationInfo.tempArtifactsPath, r1csFileName);
    const r1csDescriptor = fs.openSync(r1csFile, "r");

    const readBytes = (position: number, length: number): bigint => {
      const buffer = Buffer.alloc(length);

      fs.readSync(r1csDescriptor, buffer, { length, position });

      return BigInt(`0x${buffer.reverse().toString("hex")}`);
    };

    /// @dev https://github.com/iden3/r1csfile/blob/d82959da1f88fbd06db0407051fde94afbf8824a/doc/r1cs_bin_format.md#format-of-the-file
    const numberOfSections = readBytes(8, 4);
    let sectionStart = 12;

    for (let i = 0; i < numberOfSections; ++i) {
      const sectionType = Number(readBytes(sectionStart, 4));
      const sectionSize = Number(readBytes(sectionStart + 4, 8));

      /// @dev Reading header section
      if (sectionType == 1) {
        const totalConstraintsOffset = 4 + 8 + 4 + 32 + 4 + 4 + 4 + 4 + 8;

        return Number(readBytes(sectionStart + totalConstraintsOffset, 4));
      }

      sectionStart += 4 + 8 + sectionSize;
    }

    throw new NonExistentR1CSHeader(r1csFileName);
  });

subtask(TASK_CIRCUITS_COMPILE_DOWNLOAD_PTAU_FILE)
  .addParam("ptauInfo", undefined, undefined, types.any)
  .addParam("ptauDirFullPath", undefined, undefined, types.string)
  .addFlag("denyDownload", undefined)
  .setAction(
    async (
      {
        ptauInfo,
        ptauDirFullPath,
        denyDownload,
      }: {
        ptauInfo: PtauInfo;
        ptauDirFullPath: string;
        denyDownload: boolean;
      },
      { config },
    ) => {
      if (!config.zkit.allowDownload && denyDownload) {
        throw new Error(
          'Download is cancelled. Allow download or consider passing "ptauDir=PATH_TO_LOCAL_DIR" to the existing ptau files',
        );
      }

      fs.mkdirSync(ptauDirFullPath, { recursive: true });

      if (!(await downloadFile(ptauInfo.file, ptauInfo.downloadURL!))) {
        throw new Error("Something went wrong while downloading the ptau file.");
      }
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GET_PTAU_FILE)
  .addParam("compilationsInfo", undefined, undefined, types.any)
  .addFlag("denyDownload", undefined)
  .setAction(
    async (
      {
        compilationsInfo,
        denyDownload,
      }: {
        compilationsInfo: CircuitCompilationInfo[];
        denyDownload: boolean;
      },
      { config, run },
    ): Promise<string> => {
      const circuitsConstraintsNumber: number[] = await Promise.all(
        compilationsInfo.map(async (info: CircuitCompilationInfo) => {
          return await run(TASK_CIRCUITS_COMPILE_GET_CONSTRAINTS_NUMBER, { compilationInfo: info });
        }),
      );

      const maxConstraintsNumber = Math.max(...circuitsConstraintsNumber);
      const ptauId = Math.max(Math.ceil(Math.log2(maxConstraintsNumber)), 8);

      const ptauDirFullPath = getPtauDirFullPath(config.paths.root, config.zkit.ptauDir);

      let entries = [] as fs.Dirent[];

      if (fs.existsSync(ptauDirFullPath)) {
        entries = fs.readdirSync(ptauDirFullPath, { withFileTypes: true });
      }

      const entry = entries.find((entry) => {
        if (!entry.isFile()) {
          return false;
        }

        const match = entry.name.match(PTAU_FILE_REG_EXP);

        if (!match) {
          return false;
        }

        return ptauId <= parseInt(match[1]);
      });

      const file = path.join(ptauDirFullPath, entry ? entry.name : `powers-of-tau-${ptauId}.ptau`);
      const url = entry
        ? null
        : `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauId.toString().padStart(2, "0")}.ptau`;

      if (url) {
        if (ptauId > MAX_PTAU_ID) {
          throw new Error(
            `Circuits has too many constraints. The maximum ptauId to download is ${MAX_PTAU_ID}. Consider passing "ptauDir=PATH_TO_LOCAL_DIR" with existing ptau files.`,
          );
        }

        await run(TASK_CIRCUITS_COMPILE_DOWNLOAD_PTAU_FILE, {
          ptauInfo: {
            file,
            downloadURL: url,
          },
          ptauDirFullPath,
          denyDownload,
        });
      }

      return file;
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GENERATE_ZKEY_FILES)
  .addParam("ptauFile", undefined, undefined, types.string)
  .addParam("compilationsInfo", undefined, undefined, types.any)
  .setAction(
    async (
      {
        ptauFile,
        compilationsInfo,
      }: {
        ptauFile: string;
        compilationsInfo: CircuitCompilationInfo[];
      },
      { config },
    ) => {
      const contributions: number = config.zkit.compilationSettings.contributions;
      const contributionTemplate: ContributionTemplateType = config.zkit.compilationSettings.contributionTemplate;

      await Promise.all(
        compilationsInfo.map(async (info: CircuitCompilationInfo) => {
          const r1csFile = localSourceNameToPath(info.tempArtifactsPath, `${info.circuitName}.r1cs`);
          const zKeyFile = localSourceNameToPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);

          if (contributionTemplate === "groth16") {
            await snarkjs.zKey.newZKey(r1csFile, ptauFile, zKeyFile);

            const zKeyFileNext = `${zKeyFile}.next.zkey`;

            for (let i = 0; i < contributions; ++i) {
              await snarkjs.zKey.contribute(
                zKeyFile,
                zKeyFileNext,
                `${zKeyFile}_contribution_${i}`,
                randomBytes(32).toString("hex"),
              );

              fs.rmSync(zKeyFile);
              fs.renameSync(zKeyFileNext, zKeyFile);
            }
          } else {
            throw new Error(`Unsupported contribution template - ${contributionTemplate}`);
          }
        }),
      );
    },
  );

subtask(TASK_CIRCUITS_COMPILE_GENERATE_VKEY_FILES)
  .addParam("compilationsInfo", undefined, undefined, types.any)
  .setAction(async ({ compilationsInfo }: { compilationsInfo: CircuitCompilationInfo[] }) => {
    await Promise.all(
      compilationsInfo.map(async (info: CircuitCompilationInfo) => {
        const zkeyFile = localSourceNameToPath(info.tempArtifactsPath, `${info.circuitName}.zkey`);
        const vKeyFile = localSourceNameToPath(info.tempArtifactsPath, `${info.circuitName}.vkey.json`);

        const vKeyData = await snarkjs.zKey.exportVerificationKey(zkeyFile);

        fs.writeFileSync(vKeyFile, JSON.stringify(vKeyData));
      }),
    );
  });

subtask(TASK_CIRCUITS_COMPILE_MOVE_FROM_TEMP_TO_ARTIFACTS)
  .addParam("compilationsInfo", undefined, undefined, types.any)
  .setAction(async ({ compilationsInfo }: { compilationsInfo: CircuitCompilationInfo[] }) => {
    compilationsInfo.forEach((info: CircuitCompilationInfo) => {
      fs.mkdirSync(info.artifactsPath, { recursive: true });

      readDirRecursively(info.tempArtifactsPath, (dir: string, file: string) => {
        const correspondingOutDir = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, dir));
        const correspondingOutFile = path.join(info.artifactsPath, path.relative(info.tempArtifactsPath, file));

        if (!fs.existsSync(correspondingOutDir)) {
          fs.mkdirSync(correspondingOutDir);
        }

        if (fs.existsSync(correspondingOutFile)) {
          fs.rmSync(correspondingOutFile);
        }

        fs.copyFileSync(file, correspondingOutFile);
      });
    });
  });

task(TASK_CIRCUITS_COMPILE, "Compile circuits")
  .addOptionalParam("artifactsDir", "The circuits artifacts directory path.", undefined, types.string)
  .addFlag("force", "The force flag.")
  .addFlag("sym", "The sym flag.")
  .addFlag("json", "The json flag.")
  .addFlag("c", "The c flag.")
  .addFlag("quiet", "The quiet flag.")
  .addFlag("denyDownload", "The denyDownload flag.")
  .setAction(
    async (
      {
        artifactsDir,
        force,
        sym,
        json,
        c,
        quiet,
        denyDownload,
      }: {
        artifactsDir?: string;
        force: boolean;
        sym: boolean;
        json: boolean;
        c: boolean;
        quiet: boolean;
        denyDownload: boolean;
      },
      { config, run },
    ) => {
      const projectRoot = config.paths.root;
      const circuitsRoot: string = getCircuitsDirFullPath(projectRoot, config.zkit.circuitsDir);

      const sourcePaths: string[] = await run(TASK_CIRCUITS_COMPILE_GET_SOURCE_PATHS, { sourcePath: circuitsRoot });
      const filteredSourcePaths: string[] = await run(TASK_CIRCUITS_COMPILE_FILTER_SOURCE_PATHS, {
        circuitsRoot,
        sourcePaths,
        filterSettings: config.zkit.compilationSettings,
      });

      const sourceNames: string[] = await run(TASK_CIRCUITS_COMPILE_GET_SOURCE_NAMES, {
        projectRoot,
        sourcePaths: filteredSourcePaths,
      });

      const circuitFilesCachePath = getCircomFilesCachePath(config.paths);
      let circuitFilesCache = await CircomCircuitsCache.readFromFile(circuitFilesCachePath);

      const dependencyGraph: DependencyGraph = await run(TASK_CIRCUITS_COMPILE_GET_DEPENDENCY_GRAPH, {
        projectRoot,
        sourceNames,
        circuitFilesCache,
      });

      const resolvedFilesToCompile: ResolvedFile[] = await run(TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES, {
        resolvedFiles: dependencyGraph.getResolvedFiles(),
        sourceNames,
        withMainComponent: true,
      });

      await run(TASK_CIRCUITS_COMPILE_VALIDATE_RESOLVED_FILES_TO_COMPILE, { resolvedFiles: resolvedFilesToCompile });

      const artifactsDirFullPath = getArtifactsDirFullPath(
        projectRoot,
        artifactsDir ?? config.zkit.compilationSettings.artifactsDir,
      );
      circuitFilesCache = await invalidateCacheMissingArtifacts(
        circuitsRoot,
        artifactsDirFullPath,
        circuitFilesCache,
        resolvedFilesToCompile,
      );

      const compileOptions: CompileOptions = { sym, json, c, quiet };

      const resolvedFilesWithDependencies: ResolvedFileWithDependencies[] = await run(
        TASK_CIRCUITS_COMPILE_FILTER_RESOLVED_FILES_TO_COMPILE,
        {
          resolvedFilesToCompile,
          dependencyGraph,
          circuitFilesCache,
          compileOptions,
          force,
        },
      );

      const filteredFilesToCompile: ResolvedFile[] = resolvedFilesWithDependencies.map((file) => file.resolvedFile);

      const tempDir: string = path.join(os.tmpdir(), ".zkit", uuid());

      if (filteredFilesToCompile.length > 0) {
        try {
          const compilationsInfo: CircuitCompilationInfo[] = await run(TASK_CIRCUITS_COMPILE_COMPILE_CIRCUITS, {
            tempDir,
            circuitsDirFullPath: circuitsRoot,
            artifactsDirFullPath,
            resolvedFilesToCompile: filteredFilesToCompile,
            compileOptions,
          });

          const ptauFile: string = await run(TASK_CIRCUITS_COMPILE_GET_PTAU_FILE, { compilationsInfo, denyDownload });

          await run(TASK_CIRCUITS_COMPILE_GENERATE_ZKEY_FILES, { ptauFile, compilationsInfo });
          await run(TASK_CIRCUITS_COMPILE_GENERATE_VKEY_FILES, { compilationsInfo });

          await run(TASK_CIRCUITS_COMPILE_MOVE_FROM_TEMP_TO_ARTIFACTS, { compilationsInfo });
        } finally {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }

      for (const resolvedFileWithDependecies of resolvedFilesWithDependencies) {
        for (const file of [resolvedFileWithDependecies.resolvedFile, ...resolvedFileWithDependecies.dependencies]) {
          circuitFilesCache.addFile(file.absolutePath, {
            lastModificationDate: file.lastModificationDate.valueOf(),
            contentHash: file.contentHash,
            sourceName: file.sourceName,
            compileOptions,
            imports: file.content.imports,
            versionPragmas: file.content.versionPragmas,
          });
        }
      }

      await circuitFilesCache.writeToFile(circuitFilesCachePath);
    },
  );

async function invalidateCacheMissingArtifacts(
  circuitsDirFullPath: string,
  artifactsDirFullPath: string,
  solidityFilesCache: CircomCircuitsCache,
  resolvedFiles: ResolvedFile[],
): Promise<CircomCircuitsCache> {
  for (const file of resolvedFiles) {
    const cacheEntry = solidityFilesCache.getEntry(file.absolutePath);

    if (cacheEntry === undefined) {
      continue;
    }

    if (!fsExtra.existsSync(file.absolutePath.replace(circuitsDirFullPath, artifactsDirFullPath))) {
      solidityFilesCache.removeEntry(file.absolutePath);
    }
  }

  return solidityFilesCache;
}

function needsCompilation(
  resolvedFilesWithDependecies: ResolvedFileWithDependencies,
  cache: CircomCircuitsCache,
  compileOptions: CompileOptions,
): boolean {
  for (const file of [resolvedFilesWithDependecies.resolvedFile, ...resolvedFilesWithDependecies.dependencies]) {
    const hasChanged = cache.hasFileChanged(file.absolutePath, file.contentHash, compileOptions);

    if (hasChanged) {
      return true;
    }
  }

  return false;
}

function hasMainComponent(resolvedFile: ResolvedFile): boolean {
  return new RegExp(MAIN_COMPONENT_REG_EXP).test(resolvedFile.content.rawContent);
}

function contains(circuitsRoot: string, pathList: string[], source: any) {
  const isSubPath = (parent: string, child: string) => {
    const parentTokens = parent.split(path.posix.sep).filter((i) => i.length);
    const childTokens = child.split(path.posix.sep).filter((i) => i.length);

    return parentTokens.every((t, i) => childTokens[i] === t);
  };

  return pathList.some((p: any) => {
    return isSubPath(localSourceNameToPath(circuitsRoot, p), source);
  });
}
