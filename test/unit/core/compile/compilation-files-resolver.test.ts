import fsExtra from "fs-extra";
import * as fs from "fs";

import { expect } from "chai";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { getAllFilesMatching } from "@nomicfoundation/hardhat-utils/fs";

import { CompilationFilesResolverMock } from "./mock/CompilationFilesResolverMock.js";
import { CircomFilesResolver, CircomResolvedFile } from "../../../../src/core/resolve/CircomFilesResolver.js";
import { DependencyGraph } from "../../../../src/core/resolve/DependencyGraph.js";
import { TASK_CIRCUITS_COMPILE, ZKIT_SCOPE_NAME } from "../../../../src/task-names.js";
import { CircomFilesParser } from "../../../../src/core/resolve/parser/CircomFilesParser.js";
import { CircomResolvedFileInfo } from "../../../../src/types/core/compile/compilation-files-resolver.js";
import { getNormalizedFullPath } from "../../../../src/utils/path-utils.js";
import { CircuitsCompileCache } from "../../../../src/cache/CircuitsCompileCache.js";
import { CIRCUITS_COMPILE_CACHE_FILENAME } from "../../../../src/constants.js";

import { useEnvironment } from "../../../helpers.js";

describe("CompilationFilesResolver", () => {
  function getCompilationFilesManagerMock(hre: HardhatRuntimeEnvironment): CompilationFilesResolverMock {
    return new CompilationFilesResolverMock(
      (absolutePath: string) => fs.readFileSync(absolutePath).toString(),
      hre.zkit.circuitArtifacts,
      hre.config,
    );
  }

  describe("filterResolvedFiles", () => {
    let compilationFilesManager: CompilationFilesResolverMock;
    let resolvedFiles: CircomResolvedFile[];
    let dependencyGraph: DependencyGraph;
    let sourceNames: string[];

    useEnvironment({ fixtureProjectName: "with-circuits" });

    beforeEach("setup", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

      compilationFilesManager = getCompilationFilesManagerMock(this.hre);

      const resolver = new CircomFilesResolver(
        this.hre.config.paths.root,
        new CircomFilesParser(),
        (absolutePath: string) => fs.readFileSync(absolutePath).toString(),
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
        "circuits/test folder/test.circom",
        "circuits/test folder/test_2.circom",
        "circuits/vendor/SumMul.circom",
      ];
      const expectedCircuitNames: string[] = ["Multiplier3Arr", "Multiplier2", "Test", "Test", "SumMul"];

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

    useEnvironment({ fixtureProjectName: "with-circuits" });

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

    useEnvironment({ fixtureProjectName: "with-circuits" });

    beforeEach("setup", async function () {
      await this.hre.tasks.getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_COMPILE]).run({});

      compilationFilesManager = getCompilationFilesManagerMock(this.hre);

      const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
        f.endsWith(".circom"),
      );

      sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

      const resolver = new CircomFilesResolver(
        this.hre.config.paths.root,
        new CircomFilesParser(),
        (absolutePath: string) => fs.readFileSync(absolutePath).toString(),
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
