import { NomicLabsHardhatPluginError } from "hardhat/plugins";

import { CircuitInfo } from "@solarity/zkit";

import { PLAGIN_NAME } from "./internal/constants";

export class HardhatZKitError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super(PLAGIN_NAME, message, parent);
  }
}

export class NonExistentFile extends HardhatZKitError {
  constructor(filePath: string) {
    super(`The file at path ${filePath} does not exist`);
  }
}

export class NonExistentR1CSHeader extends HardhatZKitError {
  constructor(r1csFilePath: string) {
    super(`Header section in ${r1csFilePath} file is not found.`);
  }
}

export class MultipleCircuitsInfoError extends HardhatZKitError {
  constructor(fileSourceName: string, circuitsInfo: CircuitInfo[]) {
    super(
      `Circuit with ${fileSourceName} source name has several circuits info: ${circuitsInfo.map((info) => `[Path: ${info.path}, Id: ${info.id}]`)}`,
    );
  }
}

export class ZeroCircuitsInfoError extends HardhatZKitError {
  constructor(fileSourceName: string) {
    super(`Circuit with ${fileSourceName} source name does not have any circuit info`);
  }
}

export class DuplicateCircuitsNameError extends HardhatZKitError {
  constructor(fileSourceName: string) {
    super(`Circuit with ${fileSourceName} source name duplicated another circuit`);
  }
}

export class NonExistentCircuitArtifactsError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`The artifacts for '${circuit}' circuit do not exist. Please compile circuits`);
  }
}

export class NonExistentCircuitError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`Circuit '${circuit}' does not exist`);
  }
}
