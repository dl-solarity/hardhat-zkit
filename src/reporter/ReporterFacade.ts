/* eslint-disable no-console */
import debug from "debug";

import { VerifierLanguageType } from "@solarity/zkit";

import { CircuitArtifact } from "../types/artifacts/circuit-artifacts";
import { CompilationInfo, CircuitSetupInfo, SimpleParserRuleContext } from "../types/core";
import {
  ProgressReporter,
  CircuitFilesResolvingReporter,
  SetupReporter,
  CircomCompilerReporter,
  CircuitCompilationReporter,
  PtauFileReporter,
  VerifiersGenerationReporter,
  VKeyFilesGenerationReporter,
  ZKeyFilesGenerationReporter,
  WarningsReporter,
} from "./reporters";

import { createProgressBarProcessor } from "./ProgressBarProcessor";
import { createSpinnerProcessor } from "./SpinnerProcessor";

/**
 * A facade for reporting various types of log information to the user,
 * including general information, warnings, errors, and verbose logging for more detailed output.
 *
 * This class simplifies the interaction with the logging system, providing an easy-to-use interface
 * for standard messages and detailed logs during the execution of operations.
 */
class ReporterFacade {
  private _setupReporter!: SetupReporter;
  private _progressReporter!: ProgressReporter;
  private _ptauFileReporter!: PtauFileReporter;
  private _warningsReporter!: WarningsReporter;
  private _circomCompilerReporter!: CircomCompilerReporter;
  private _circuitCompilationReporter!: CircuitCompilationReporter;
  private _verifiersGenerationReporter!: VerifiersGenerationReporter;
  private _vKeyFilesGenerationReporter!: VKeyFilesGenerationReporter;
  private _zKeyFilesGenerationReporter!: ZKeyFilesGenerationReporter;
  private _circuitFilesResolvingReporter!: CircuitFilesResolvingReporter;

  constructor(quiet: boolean) {
    createProgressBarProcessor();
    createSpinnerProcessor();

    this._initReporters(quiet);
  }

  private _initReporters(quiet: boolean) {
    this._setupReporter = new SetupReporter(quiet);
    this._progressReporter = new ProgressReporter(quiet);
    this._ptauFileReporter = new PtauFileReporter(quiet);
    this._circomCompilerReporter = new CircomCompilerReporter(quiet);
    this._circuitCompilationReporter = new CircuitCompilationReporter(quiet);
    this._verifiersGenerationReporter = new VerifiersGenerationReporter(quiet);
    this._vKeyFilesGenerationReporter = new VKeyFilesGenerationReporter(quiet);
    this._zKeyFilesGenerationReporter = new ZKeyFilesGenerationReporter(quiet);
    this._circuitFilesResolvingReporter = new CircuitFilesResolvingReporter(quiet);
    this._warningsReporter = new WarningsReporter(quiet);
  }

  public setQuiet(newValue: boolean) {
    this._initReporters(newValue);
  }

  public reportCircuitFilesResolvingProcessHeader() {
    this._circuitFilesResolvingReporter.reportHeader();
  }

  public reportCircuitFilesResolvingStartWithSpinner(): string | null {
    return this._circuitFilesResolvingReporter.reportStartWithSpinner();
  }

  public reportCircuitFilesResolvingResult(spinnerId: string | null) {
    this._circuitFilesResolvingReporter.reportResult(spinnerId);
  }

  public reportCircuitFilesResolvingFail(spinnerId: string | null) {
    this._circuitFilesResolvingReporter.reportFail(spinnerId);
  }

  public reportCompilerVersion(compilerVersion: string) {
    this._circomCompilerReporter.reportVersion(compilerVersion);
  }

  public reportCompilationProcessHeader() {
    this._circuitCompilationReporter.reportHeader();
  }

  public reportCircuitListToCompile(filteredSourceNames: string[], filteredSourceNamesToCompile: string[]) {
    this._circuitCompilationReporter.reportCircuitListToCompile(filteredSourceNames, filteredSourceNamesToCompile);
  }

  public reportCircuitCompilationStartWithSpinner(circuitName: string, circuitFileName: string): string | null {
    return this._circuitCompilationReporter.reportStartWithSpinner(circuitName, circuitFileName);
  }

  public reportCircuitCompilationResult(spinnerId: string | null, circuitName: string, circuitFileName: string) {
    this._circuitCompilationReporter.reportResult(spinnerId, circuitName, circuitFileName);
  }

  public reportCircuitCompilationFail(spinnerId: string | null, circuitName: string, circuitFileName: string) {
    this._circuitCompilationReporter.reportFail(spinnerId, circuitName, circuitFileName);
  }

  public reportCompilationResult(compilationInfoArr: CompilationInfo[]) {
    this._circuitCompilationReporter.reportFinalResult(compilationInfoArr);
  }

  public reportCompilationBottomLine() {
    this._circuitCompilationReporter.reportBottomLine();
  }

  public reportPtauFileInfo(maxConstraintsNumber: number, ptauId: number, ptauFileFullPath?: string) {
    this._ptauFileReporter.reportInfo(maxConstraintsNumber, ptauId, ptauFileFullPath);
  }

  public reportPtauFileDownloadingInfo(ptauFilePath: string, downloadUrl: string) {
    this._ptauFileReporter.reportDownloadingInfo(ptauFilePath, downloadUrl);
  }

  public reportPtauFileDownloadingFinish() {
    this._ptauFileReporter.reportDownloadingFinish();
  }

  public reportPtauFileDownloadingError() {
    this._ptauFileReporter.reportDownloadingError();
  }

  public reportCircomCompilerDownloadingInfo(version: string, isWasm: boolean) {
    this._circomCompilerReporter.reportDownloadingInfo(version, isWasm);
  }

  public reportCircomCompilerDownloadingFinish() {
    this._circomCompilerReporter.reportDownloadingFinish();
  }

  public reportCircomCompilerDownloadingError() {
    this._circomCompilerReporter.reportDownloadingError();
  }

  public reportCircuitListToSetup(
    allCircuitsSetupInfo: CircuitSetupInfo[],
    filteredCircuitsSetupInfo: CircuitSetupInfo[],
  ) {
    this._setupReporter.reportCircuitList(allCircuitsSetupInfo, filteredCircuitsSetupInfo);
  }

  public reportSetupProcessHeader() {
    this._setupReporter.reportHeader();
  }

  public reportSetupResult(circuitArtifacts: CircuitArtifact[]) {
    this._setupReporter.reportResult(circuitArtifacts);
  }

  public reportZKeyFilesGenerationHeader(contributions: number) {
    this._zKeyFilesGenerationReporter.reportHeader(contributions);
  }

  public reportZKeyFileGenerationStartWithSpinner(circuitName: string): string | null {
    return this._zKeyFilesGenerationReporter.reportStartWithSpinner(circuitName);
  }

  public reportZKeyFileGenerationResult(spinnerId: string | null, circuitName: string, contributionsNumber: number) {
    this._zKeyFilesGenerationReporter.reportResult(spinnerId, circuitName, contributionsNumber);
  }

  public reportVKeyFilesGenerationHeader() {
    this._vKeyFilesGenerationReporter.reportHeader();
  }

  public reportVKeyFileGenerationStartWithSpinner(circuitName: string): string | null {
    return this._vKeyFilesGenerationReporter.reportStartWithSpinner(circuitName);
  }

  public reportVKeyFileGenerationResult(spinnerId: string | null, circuitName: string) {
    this._vKeyFilesGenerationReporter.reportResult(spinnerId, circuitName);
  }

  public reportNothingToCompile() {
    this._progressReporter.reportNothingTo("compile");
  }

  public reportNothingToSetup() {
    this._progressReporter.reportNothingTo("setup");
  }

  public reportNothingToGenerate() {
    this._progressReporter.reportNothingTo("generate");
  }

  public reportVerifiersGenerationHeader(verifiersType: VerifierLanguageType) {
    this._verifiersGenerationReporter.reportHeader(verifiersType);
  }

  public reportVerifierGenerationStartWithSpinner(
    circuitName: string,
    verifiersType: VerifierLanguageType,
  ): string | null {
    return this._verifiersGenerationReporter.reportStartWithSpinner(circuitName, verifiersType);
  }

  public reportVerifierGenerationResult(
    spinnerId: string | null,
    circuitName: string,
    verifiersType: VerifierLanguageType,
  ) {
    this._verifiersGenerationReporter.reportResult(spinnerId, circuitName, verifiersType);
  }

  public reportVerifiersGenerationResult(verifiersType: VerifierLanguageType, verifiersCount: number) {
    this._verifiersGenerationReporter.reportFinalResult(verifiersType, verifiersCount);
  }

  public reportStartFileDownloadingWithProgressBar(totalValue: number, startValue: number) {
    this._progressReporter.reportStartFileDownloadingWithProgressBar(totalValue, startValue);
  }

  public updateProgressBarValue(valueToAdd: number) {
    this._progressReporter.updateProgressBarValue(valueToAdd);
  }

  public reportUnsupportedExpression(templateName: string, context: SimpleParserRuleContext) {
    this._warningsReporter.reportUnsupportedExpression(templateName, context);
  }

  public reportAllWarnings(spinnerId: string | null) {
    this._warningsReporter.reportAllWarnings(spinnerId);
  }

  public verboseLog(namespace: string, formatterStr: string, logArgs: any[] = []) {
    debug(`hardhat-zkit:${namespace}`)(formatterStr, ...logArgs);
  }
}

export let Reporter: ReporterFacade | null = null;

export function createReporter(quiet: boolean) {
  if (Reporter) {
    return;
  }

  Reporter = new ReporterFacade(quiet);
}

/**
 * Used only in test environments to ensure test atomicity
 */
export function resetReporter() {
  Reporter = null;
}
