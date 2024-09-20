import fsExtra from "fs-extra";

import { expect } from "chai";

import { TASK_COMPILE_SOLIDITY_READ_FILE as TASK_READ_FILE } from "hardhat/builtin-tasks/task-names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";

import { CompilationFilesResolverMock } from "./CompilationFilesResolverMock";
import { useEnvironment } from "../../../../helpers";
import { CircuitsCompileCache } from "../../../../../src/cache";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "../../../../../src/task-names";
import { DependencyGraph, CircomFilesResolver, CircomFilesParser } from "../../../../../src/core";
import { getNormalizedFullPath } from "../../../../../src/utils/path-utils";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../../../src/constants";

import { CircomResolvedFileInfo, CircomResolvedFile } from "../../../../../src/types/core";

describe("CompilationFilesResolver", () => {
  function getCompilationFilesManagerMock(hre: HardhatRuntimeEnvironment): CompilationFilesResolverMock {
    return new CompilationFilesResolverMock(
      (absolutePath: string) => hre.run(TASK_READ_FILE, { absolutePath }),
      hre.zkit.circuitArtifacts,
      hre.config,
    );
  }

  describe("filterResolvedFiles", () => {
    let compilationFilesManager: CompilationFilesResolverMock;
    let resolvedFiles: CircomResolvedFile[];
    let dependencyGraph: DependencyGraph;
    let sourceNames: string[];

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      compilationFilesManager = getCompilationFilesManagerMock(this.hre);

      const resolver = new CircomFilesResolver(
        this.hre.config.paths.root,
        new CircomFilesParser(),
        (absolutePath: string) => this.hre.run(TASK_READ_FILE, { absolutePath }),
      );

      const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
        f.endsWith(".circom"),
      );

      sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

      dependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames, resolver);

      resolvedFiles = dependencyGraph.getResolvedFiles();
    });

    it("should correctly filter resolved files", async function () {
      const filteredResolvedFilesInfo: CircomResolvedFileInfo[] = compilationFilesManager.filterResolvedFiles(
        resolvedFiles,
        sourceNames,
        dependencyGraph,
      );

      const expectedSourceNames: string[] = [
        "circuits/main/Multiplier3Arr.circom",
        "circuits/main/mul2.circom",
        "circuits/vendor/SumMul.circom",
      ];
      const expectedCircuitNames: string[] = ["Multiplier3Arr", "Multiplier2", "SumMul"];

      expect(filteredResolvedFilesInfo.length).to.be.eq(expectedSourceNames.length);

      filteredResolvedFilesInfo.forEach((fileInfo: CircomResolvedFileInfo, index: number) => {
        expect(fileInfo.circuitName).to.be.eq(expectedCircuitNames[index]);
        expect(fileInfo.resolvedFile.sourceName).to.be.eq(expectedSourceNames[index]);
      });
    });

    it("should correctly filter resolved files by source names", async function () {
      const expectedSourceNames: string[] = ["circuits/main/Multiplier3Arr.circom", "circuits/main/mul2.circom"];

      const filteredResolvedFilesInfo: CircomResolvedFileInfo[] = compilationFilesManager.filterResolvedFiles(
        resolvedFiles,
        expectedSourceNames,
        dependencyGraph,
      );

      expect(filteredResolvedFilesInfo.length).to.be.eq(expectedSourceNames.length);

      filteredResolvedFilesInfo.forEach((fileInfo: CircomResolvedFileInfo, index: number) => {
        expect(fileInfo.resolvedFile.sourceName).to.be.eq(expectedSourceNames[index]);
      });
    });
  });

  describe("getSourceNamesFromSourcePaths", () => {
    let compilationFilesManager: CompilationFilesResolverMock;

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      compilationFilesManager = getCompilationFilesManagerMock(this.hre);
    });

    it("should return correct source names from source paths", async function () {
      const expectedSourceName: string = "circuits/main/mul2.circom";
      const sourcePath: string = getNormalizedFullPath(this.hre.config.paths.root, expectedSourceName);

      expect(await compilationFilesManager.getSourceNamesFromSourcePaths([sourcePath])).to.be.deep.eq([
        expectedSourceName,
      ]);
    });
  });

  describe("invalidateCacheMissingArtifacts", () => {
    let compilationFilesManager: CompilationFilesResolverMock;
    let resolvedFilesInfo: CircomResolvedFileInfo[];
    let sourceNames: string[];

    useEnvironment("with-circuits");

    beforeEach("setup", async function () {
      await this.hre.run({ scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_COMPILE });

      compilationFilesManager = getCompilationFilesManagerMock(this.hre);

      const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
        f.endsWith(".circom"),
      );

      sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

      const resolver = new CircomFilesResolver(
        this.hre.config.paths.root,
        new CircomFilesParser(),
        (absolutePath: string) => this.hre.run(TASK_READ_FILE, { absolutePath }),
      );
      const dependencyGraph: DependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames, resolver);

      resolvedFilesInfo = compilationFilesManager.filterResolvedFiles(
        dependencyGraph.getResolvedFiles(),
        sourceNames,
        dependencyGraph,
      );
    });

    it("should correctly update cache according to existing artifacts", async function () {
      const circuitSourceNameToRemove: string = "circuits/main/mul2.circom";
      const circuitFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, circuitSourceNameToRemove);

      const entry = CircuitsCompileCache!.getEntry(circuitFullPath);

      expect(entry).not.to.be.undefined;

      if (entry) {
        expect(entry.sourceName).to.be.eq(circuitSourceNameToRemove);
      }

      fsExtra.rmSync(
        getNormalizedFullPath(
          this.hre.zkit.circuitArtifacts.getCircuitArtifactsDirFullPath(),
          circuitSourceNameToRemove,
        ),
        {
          recursive: true,
          force: true,
        },
      );

      await compilationFilesManager.invalidateCacheMissingArtifacts(resolvedFilesInfo);

      expect(CircuitsCompileCache!.getEntry(circuitFullPath)).to.be.undefined;

      const circuitsCompileCacheFullPath: string = getNormalizedFullPath(
        this.hre.config.paths.cache,
        CIRCUITS_COMPILE_CACHE_FILENAME,
      );

      await CircuitsCompileCache!.writeToFile(circuitsCompileCacheFullPath);
    });
  });
});
