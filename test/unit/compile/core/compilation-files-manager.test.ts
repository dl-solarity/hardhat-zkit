// import fsExtra from "fs-extra";
// import path from "path";
// import os from "os";

// import { expect } from "chai";

// import { TASK_COMPILE_SOLIDITY_READ_FILE as TASK_READ_FILE } from "hardhat/builtin-tasks/task-names";
// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { getAllFilesMatching } from "hardhat/internal/util/fs-utils";

// import { CompilationFilesManager } from "../../../../src/compile/core";
// import { CircomCircuitsCache, createCircuitsCache } from "../../../../src/cache/CircomCircuitsCache";
// import { DependencyGraph, ResolvedFile } from "../../../../src/compile/dependencies";
// import { createReporter } from "../../../../src/reporter";
// import { CompilationFilesManagerConfig, ResolvedFileWithDependencies } from "../../../../src/types/compile";
// import { getNormalizedFullPath } from "../../../../src/utils/path-utils";
// import { TASK_CIRCUITS_COMPILE } from "../../../../src/task-names";
// import { useEnvironment } from "../../../helpers";
// import { CompilationFilesManagerMock } from "./CompilationFilesManagerMock";

// describe("CompilationFilesManager", () => {
//   const defaultConfig: CompilationFilesManagerConfig = {
//     artifactsDir: "artifacts/zkit",
//     ptauDir: "ptau",
//     force: false,
//     ptauDownload: true,
//   };

//   function getCompilationFilesManager(
//     hre: HardhatRuntimeEnvironment,
//     config: CompilationFilesManagerConfig = defaultConfig,
//   ): CompilationFilesManager {
//     return new CompilationFilesManager(
//       config,
//       (absolutePath: string) => hre.run(TASK_READ_FILE, { absolutePath }),
//       hre.config,
//     );
//   }

//   function getCompilationFilesManagerMock(
//     hre: HardhatRuntimeEnvironment,
//     config: CompilationFilesManagerConfig = defaultConfig,
//   ): CompilationFilesManagerMock {
//     return new CompilationFilesManagerMock(
//       config,
//       (absolutePath: string) => hre.run(TASK_READ_FILE, { absolutePath }),
//       hre.config,
//     );
//   }

//   describe("getCircuitsDirFullPath", () => {
//     useEnvironment("with-circuits");

//     it("should return correct circuits dir full path", async function () {
//       const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre);

//       const expectedCircuitsDirFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "circuits");

//       expect(compilationFilesManager.getCircuitsDirFullPath()).to.be.eq(expectedCircuitsDirFullPath);
//     });
//   });

//   describe("getArtifactsDirFullPath", () => {
//     useEnvironment("with-circuits");

//     it("should return correct artifacts dir full path from the manager config", async function () {
//       const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre);

//       const expectedCircuitsDirFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "artifacts/zkit");

//       expect(compilationFilesManager.getArtifactsDirFullPath()).to.be.eq(expectedCircuitsDirFullPath);
//     });

//     it("should return correct artifacts dir full path from the hardhat config", async function () {
//       const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre, {
//         ...defaultConfig,
//         artifactsDir: undefined,
//       });

//       const expectedCircuitsDirFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "zkit/artifacts");

//       expect(compilationFilesManager.getArtifactsDirFullPath()).to.be.eq(expectedCircuitsDirFullPath);
//     });
//   });

//   describe("getPtauDirFullPath", () => {
//     describe("env with config", () => {
//       useEnvironment("with-circuits");

//       it("should return correct ptau dir full path from the manager config", async function () {
//         const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre);

//         const expectedCircuitsDirFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "ptau");

//         expect(compilationFilesManager.getPtauDirFullPath()).to.be.eq(expectedCircuitsDirFullPath);
//       });

//       it("should return correct ptau dir full path from the hardhat config", async function () {
//         const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre, {
//           ...defaultConfig,
//           ptauDir: undefined,
//         });

//         const expectedCircuitsDirFullPath: string = getNormalizedFullPath(this.hre.config.paths.root, "zkit/ptau");

//         expect(compilationFilesManager.getPtauDirFullPath()).to.be.eq(expectedCircuitsDirFullPath);
//       });

//       it("should return correct ptau dir full path for absolute path", async function () {
//         const absolutePath: string = "/home/ptau";
//         const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre, {
//           ...defaultConfig,
//           ptauDir: absolutePath,
//         });

//         expect(compilationFilesManager.getPtauDirFullPath()).to.be.eq(absolutePath);
//       });
//     });

//     describe("env with default config", () => {
//       useEnvironment("undefined-config");

//       it("should return correct ptau dir full path for undefined config value", async function () {
//         const compilationFilesManager: CompilationFilesManager = getCompilationFilesManager(this.hre, {
//           ...defaultConfig,
//           ptauDir: undefined,
//         });

//         expect(compilationFilesManager.getPtauDirFullPath()).to.be.eq(path.join(os.homedir(), ".zkit", "ptau"));
//       });
//     });
//   });

//   describe("filterResolvedFilesToCompile", () => {
//     let compilationFilesManager: CompilationFilesManagerMock;
//     let resolvedFilesWithDependencies: ResolvedFileWithDependencies[] = [];
//     let sourceNames: string[];

//     useEnvironment("with-circuits");

//     beforeEach("setup", async function () {
//       await this.hre.run(TASK_CIRCUITS_COMPILE);

//       compilationFilesManager = getCompilationFilesManagerMock(this.hre, defaultConfig);

//       const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
//         f.endsWith(".circom"),
//       );

//       sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

//       const dependencyGraph: DependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames);

//       const resolvedFilesToCompile: ResolvedFile[] = compilationFilesManager.filterResolvedFiles(
//         dependencyGraph.getResolvedFiles(),
//         sourceNames,
//         true,
//       );

//       for (const file of resolvedFilesToCompile) {
//         resolvedFilesWithDependencies.push({
//           resolvedFile: file,
//           dependencies: dependencyGraph.getTransitiveDependencies(file).map((dep) => dep.dependency),
//         });
//       }
//     });

//     afterEach("clean", async () => {
//       resolvedFilesWithDependencies = [];
//     });

//     it("should correctly filter resolve files by onlyFiles setting", async function () {
//       const filteredFiles: ResolvedFileWithDependencies[] = compilationFilesManager.filterResolvedFilesToCompile(
//         resolvedFilesWithDependencies,
//         { onlyFiles: ["main"], skipFiles: [] },
//       );

//       const expectedSourcePaths: string[] = [
//         getNormalizedFullPath(compilationFilesManager.getCircuitsDirFullPath(), "main/mul2.circom"),
//         getNormalizedFullPath(compilationFilesManager.getCircuitsDirFullPath(), "main/mul3Arr.circom"),
//       ];

//       expect(filteredFiles.map((fileWithDep) => fileWithDep.resolvedFile.absolutePath)).to.be.deep.eq(
//         expectedSourcePaths,
//       );
//     });

//     it("should correctly filter source paths by skipFiles setting", async function () {
//       const filteredFiles: ResolvedFileWithDependencies[] = compilationFilesManager.filterResolvedFilesToCompile(
//         resolvedFilesWithDependencies,
//         { onlyFiles: [], skipFiles: ["base", "vendor"] },
//       );

//       const expectedSourcePaths: string[] = [
//         getNormalizedFullPath(compilationFilesManager.getCircuitsDirFullPath(), "main/mul2.circom"),
//         getNormalizedFullPath(compilationFilesManager.getCircuitsDirFullPath(), "main/mul3Arr.circom"),
//       ];

//       expect(filteredFiles.map((fileWithDep) => fileWithDep.resolvedFile.absolutePath)).to.be.deep.eq(
//         expectedSourcePaths,
//       );
//     });

//     it("should correctly filter source paths by onlyFiles and skipFiles settings", async function () {
//       const filteredFiles: ResolvedFileWithDependencies[] = compilationFilesManager.filterResolvedFilesToCompile(
//         resolvedFilesWithDependencies,
//         { onlyFiles: ["main"], skipFiles: ["main/mul2.circom"] },
//       );

//       const expectedSourcePaths: string[] = [
//         getNormalizedFullPath(compilationFilesManager.getCircuitsDirFullPath(), "main/mul3Arr.circom"),
//       ];

//       expect(filteredFiles.map((fileWithDep) => fileWithDep.resolvedFile.absolutePath)).to.be.deep.eq(
//         expectedSourcePaths,
//       );
//     });
//   });

//   describe("filterResolvedFiles", () => {
//     let compilationFilesManager: CompilationFilesManagerMock;
//     let resolvedFiles: ResolvedFile[];
//     let sourceNames: string[];

//     useEnvironment("with-circuits");

//     beforeEach("setup", async function () {
//       await this.hre.run(TASK_CIRCUITS_COMPILE);

//       compilationFilesManager = getCompilationFilesManagerMock(this.hre, defaultConfig);

//       const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
//         f.endsWith(".circom"),
//       );

//       sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

//       const dependencyGraph: DependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames);

//       resolvedFiles = dependencyGraph.getResolvedFiles();
//     });

//     it("should correctly filter resolved files with withMainComponent=true", async function () {
//       const filteredResolvedFiles: ResolvedFile[] = compilationFilesManager.filterResolvedFiles(
//         resolvedFiles,
//         sourceNames,
//         true,
//       );

//       const expectedSourceNames: string[] = [
//         "circuits/main/mul2.circom",
//         "circuits/main/mul3Arr.circom",
//         "circuits/vendor/sumMul.circom",
//       ];

//       expect(filteredResolvedFiles.length).to.be.eq(expectedSourceNames.length);

//       filteredResolvedFiles.forEach((file: ResolvedFile, index: number) => {
//         expect(file.sourceName).to.be.eq(expectedSourceNames[index]);
//       });
//     });

//     it("should correctly filter resolved files with withMainComponent=false", async function () {
//       const filteredResolvedFiles: ResolvedFile[] = compilationFilesManager.filterResolvedFiles(
//         resolvedFiles,
//         sourceNames,
//         false,
//       );

//       const expectedSourceNames: string[] = [
//         "circuits/base/mul2Base.circom",
//         "circuits/base/sumMul.circom",
//         "circuits/main/mul2.circom",
//         "circuits/main/mul3Arr.circom",
//         "circuits/vendor/sumMul.circom",
//       ];

//       expect(filteredResolvedFiles.length).to.be.eq(expectedSourceNames.length);

//       filteredResolvedFiles.forEach((file: ResolvedFile, index: number) => {
//         expect(file.sourceName).to.be.eq(expectedSourceNames[index]);
//       });
//     });

//     it("should correctly filter resolved files by source names", async function () {
//       const expectedSourceNames: string[] = ["circuits/main/mul2.circom", "circuits/main/mul3Arr.circom"];

//       const filteredResolvedFiles: ResolvedFile[] = compilationFilesManager.filterResolvedFiles(
//         resolvedFiles,
//         expectedSourceNames,
//         false,
//       );

//       expect(filteredResolvedFiles.length).to.be.eq(expectedSourceNames.length);

//       filteredResolvedFiles.forEach((file: ResolvedFile, index: number) => {
//         expect(file.sourceName).to.be.eq(expectedSourceNames[index]);
//       });
//     });
//   });

//   describe("validateResolvedFiles", () => {
//     let compilationFilesManager: CompilationFilesManagerMock;
//     let resolvedFiles: ResolvedFile[];

//     useEnvironment("with-duplicate-circuits");

//     beforeEach("setup", async function () {
//       createCircuitsCache();
//       createReporter(true);

//       compilationFilesManager = getCompilationFilesManagerMock(this.hre, defaultConfig);

//       const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
//         f.endsWith(".circom"),
//       );

//       const sourceNames: string[] = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);
//       const dependencyGraph: DependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames);

//       resolvedFiles = dependencyGraph.getResolvedFiles();
//     });

//     it("should get exception for circuits with duplicated names", async function () {
//       const reason: string = `Circuit ${resolvedFiles[1].sourceName} duplicated ${resolvedFiles[0].sourceName} circuit`;

//       expect(function () {
//         compilationFilesManager.validateResolvedFiles(resolvedFiles);
//       }).to.throw(reason);
//     });
//   });

//   describe("getSourceNamesFromSourcePaths", () => {
//     let compilationFilesManager: CompilationFilesManagerMock;

//     useEnvironment("with-circuits");

//     beforeEach("setup", async function () {
//       compilationFilesManager = getCompilationFilesManagerMock(this.hre);
//     });

//     it("should return correct source names from source paths", async function () {
//       const expectedSourceName: string = "circuits/main/mul2.circom";
//       const sourcePath: string = getNormalizedFullPath(this.hre.config.paths.root, expectedSourceName);

//       expect(await compilationFilesManager.getSourceNamesFromSourcePaths([sourcePath])).to.be.deep.eq([
//         expectedSourceName,
//       ]);
//     });
//   });

//   describe("invalidateCacheMissingArtifacts", () => {
//     let compilationFilesManager: CompilationFilesManagerMock;
//     let resolvedFiles: ResolvedFile[];
//     let sourceNames: string[];

//     useEnvironment("with-circuits");

//     beforeEach("setup", async function () {
//       await this.hre.run(TASK_CIRCUITS_COMPILE);

//       compilationFilesManager = getCompilationFilesManagerMock(this.hre, defaultConfig);

//       const sourcePaths: string[] = await getAllFilesMatching(compilationFilesManager.getCircuitsDirFullPath(), (f) =>
//         f.endsWith(".circom"),
//       );

//       sourceNames = await compilationFilesManager.getSourceNamesFromSourcePaths(sourcePaths);

//       const dependencyGraph: DependencyGraph = await compilationFilesManager.getDependencyGraph(sourceNames);

//       resolvedFiles = compilationFilesManager.filterResolvedFiles(
//         dependencyGraph.getResolvedFiles(),
//         sourceNames,
//         true,
//       );
//     });

//     it("should correctly update cache according to existing artifacts", async function () {
//       const circuitToRemove: string = "main/mul2.circom";
//       const circuitFullPath: string = getNormalizedFullPath(
//         compilationFilesManager.getCircuitsDirFullPath(),
//         circuitToRemove,
//       );

//       const entry = CircomCircuitsCache!.getEntry(circuitFullPath);

//       expect(entry).not.to.be.undefined;

//       if (entry) {
//         expect(entry.sourceName).to.be.eq(getNormalizedFullPath("circuits", circuitToRemove));
//       }

//       fsExtra.rmSync(getNormalizedFullPath(compilationFilesManager.getArtifactsDirFullPath(), circuitToRemove), {
//         recursive: true,
//         force: true,
//       });

//       compilationFilesManager.invalidateCacheMissingArtifacts(resolvedFiles);

//       expect(CircomCircuitsCache!.getEntry(circuitFullPath)).to.be.undefined;
//     });
//   });
// });
