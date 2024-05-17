import * as fs from "fs";
import path from "path";
import process from "process";

import { HardhatRuntimeEnvironment } from "hardhat/types";

import { CircomZKit, CircuitZKit, CircuitInfo, ManagerZKitConfig, CompileOptions } from "@solarity/zkit";

import { ZKitConfig } from "../types/zkit-config";
import { MAIN_COMPONENT_REG_EXP } from "../constants";
import { NonExistentCircuitError, NotAFullCircuitError } from "./errors";

export class CircomZKitManager {
  private _circomZKit: CircomZKit;

  constructor(
    private _hre: HardhatRuntimeEnvironment,
    private _config: ZKitConfig = _hre.config.zkit,
  ) {
    this._circomZKit = new CircomZKit(this._buildManagerZKitConfig());
  }

  public async compile() {
    const circuitsInfo: CircuitInfo[] = this._circomZKit.getCircuits();
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
    const circuitsInfo: CircuitInfo[] = this._circomZKit.getCircuits();
    const circuits: CircuitZKit[] = [];

    circuitsInfo.forEach((info: CircuitInfo) => {
      if (info.id !== null) {
        circuits.push(this._circomZKit.getCircuit(info.id));
      }
    });

    for (let i = 0; i < circuits.length; i++) {
      await circuits[i].createVerifier();
    }
  }

  public async getCircuit(circuit: string): Promise<CircuitZKit> {
    const circuitInfo = this._circomZKit.getCircuits().find((info: CircuitInfo) => {
      return info.id === circuit;
    });

    if (!circuitInfo) {
      throw new NonExistentCircuitError(circuit);
    }

    if (!this._hasMainComponent(circuitInfo)) {
      throw new NotAFullCircuitError(circuit);
    }

    return this._circomZKit.getCircuit(circuit);
  }

  public getCircuitsInfo(): CircuitInfo[] {
    return this._circomZKit.getCircuits();
  }

  private _buildManagerZKitConfig(): ManagerZKitConfig {
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
}
