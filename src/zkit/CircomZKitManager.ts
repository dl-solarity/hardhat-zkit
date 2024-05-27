import * as fs from "fs";
import path from "path";
import process from "process";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircomZKit, CircuitZKit, CircuitInfo, ManagerZKitConfig, CompileOptions } from "@solarity/zkit";

import { FileFilterSettings, ZKitConfig } from "../types/zkit-config";
import { NonExistentCircuitError, CircuitWithoutMainComponentError, UncompiledCircuitError } from "./errors";
import { MAIN_COMPONENT_REG_EXP } from "../constants";

export class CircomZKitManager {
  private _circomZKit: CircomZKit;

  constructor(
    private _hre: HardhatRuntimeEnvironment,
    private _config: ZKitConfig = _hre.config.zkit,
  ) {
    this._circomZKit = new CircomZKit(this._buildManagerZKitConfig());

    this._config.compilationSettings = {
      ...this._config.compilationSettings,
      ...this._normalizeFilterSettings(this._config.compilationSettings),
    };
    this._config.verifiersSettings = {
      ...this._config.verifiersSettings,
      ...this._normalizeFilterSettings(this._config.verifiersSettings),
    };
  }

  public async compile() {
    const circuitsInfo: CircuitInfo[] = this._filterCircuits(this.getCircuitsInfo(), this._config.compilationSettings);
    const circuits: CircuitZKit[] = [];

    circuitsInfo.forEach((info: CircuitInfo) => {
      if (info.id !== null && this._hasMainComponent(info)) {
        circuits.push(this._circomZKit.getCircuit(info.id));
      }
    });

    for (let i = 0; i < circuits.length; i++) {
      await circuits[i].compile(this._buildCompilerOptions());
    }
  }

  public async generateVerifiers() {
    const compiledFilteredCircuitsInfo: CircuitInfo[] = this._filterCircuits(
      this.getCircuitsInfo(),
      this._config.compilationSettings,
    );
    const filteredCircuitsInfo: CircuitInfo[] = this._filterCircuits(
      compiledFilteredCircuitsInfo,
      this._config.verifiersSettings,
    );
    const circuits: CircuitZKit[] = [];

    filteredCircuitsInfo.forEach((info: CircuitInfo) => {
      if (info.id !== null && this._hasMainComponent(info)) {
        if (!fs.existsSync(`${this._config.compilationSettings.artifactsDir}/${info.path}`)) {
          throw new UncompiledCircuitError(info.id);
        }

        circuits.push(this._circomZKit.getCircuit(info.id));
      }
    });

    for (let i = 0; i < circuits.length; i++) {
      await circuits[i].createVerifier();
    }
  }

  public async getCircuit(circuit: string): Promise<CircuitZKit> {
    const circuitInfo = this.getCircuitsInfo().find((info: CircuitInfo) => {
      return info.id === circuit;
    });

    if (!circuitInfo) {
      throw new NonExistentCircuitError(circuit);
    }

    if (!this._hasMainComponent(circuitInfo)) {
      throw new CircuitWithoutMainComponentError(circuit);
    }

    return this._circomZKit.getCircuit(circuit);
  }

  public getCircuitsInfo(): CircuitInfo[] {
    return this._circomZKit.getCircuits();
  }

  private _buildManagerZKitConfig(): Partial<ManagerZKitConfig> {
    return {
      circuitsDir: this._config.circuitsDir,
      artifactsDir: this._config.compilationSettings.artifactsDir,
      verifiersDir: this._config.verifiersSettings.verifiersDir,
      ptauDir: this._config.ptauDir,
      allowDownload: this._config.allowDownload,
    };
  }

  private _buildCompilerOptions(): CompileOptions {
    return {
      c: this._config.compilationSettings.c,
      json: this._config.compilationSettings.json,
      quiet: this._config.compilationSettings.quiet,
      sym: this._config.compilationSettings.sym,
    };
  }

  private _hasMainComponent(circuitInfo: CircuitInfo): boolean {
    const circuitFile: string = fs.readFileSync(
      `${path.join(process.cwd(), this._config.circuitsDir)}/${circuitInfo.path}`,
      "utf-8",
    );

    return new RegExp(MAIN_COMPONENT_REG_EXP).test(circuitFile);
  }

  private _filterCircuits(circuitsInfo: CircuitInfo[], filterSettings: FileFilterSettings): CircuitInfo[] {
    return circuitsInfo.filter((circuitInfo: CircuitInfo) => {
      return (
        (filterSettings.onlyFiles.length == 0 || this._contains(filterSettings.onlyFiles, circuitInfo.path)) &&
        !this._contains(filterSettings.skipFiles, circuitInfo.path)
      );
    });
  }

  private _contains(pathList: string[], source: any) {
    const isSubPath = (parent: string, child: string) => {
      const parentTokens = parent.split(path.posix.sep).filter((i) => i.length);
      const childTokens = child.split(path.posix.sep).filter((i) => i.length);

      return parentTokens.every((t, i) => childTokens[i] === t);
    };

    return pathList.some((p: any) => isSubPath(p, source));
  }

  private _normalizeFilterSettings(filterSettings: FileFilterSettings): FileFilterSettings {
    filterSettings.onlyFiles = filterSettings.onlyFiles.map((p) => this._toUnixPath(path.normalize(p)));
    filterSettings.skipFiles = filterSettings.skipFiles.map((p) => this._toUnixPath(path.normalize(p)));

    return filterSettings;
  }

  private _toUnixPath(userPath: string) {
    return userPath.split(path.sep).join(path.posix.sep);
  }
}
