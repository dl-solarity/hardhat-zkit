import { NomicLabsHardhatPluginError } from "hardhat/plugins";

import { PLAGIN_NAME } from "../internal/constants";

export class HardhatZKitError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super(PLAGIN_NAME, message, parent);
  }
}

export class NonExistentR1CSHeader extends HardhatZKitError {
  constructor(r1csFilePath: string) {
    super(`Header section in ${r1csFilePath} file is not found.`);
  }
}

export class DuplicateCircuitsNameError extends HardhatZKitError {
  constructor(fileSourceName: string, duplicatedFileSourceName: string) {
    super(`Circuit ${fileSourceName} duplicated ${duplicatedFileSourceName} circuit`);
  }
}

export class MultipleCircuitsNameError extends HardhatZKitError {
  constructor(circuitName: string, foundPaths: string[]) {
    super(`Invalid circuit name ${circuitName}. Multiple artifacts found along ${foundPaths} paths`);
  }
}

export class NonExistentCircuitArtifactsError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`The artifacts for '${circuit}' circuit do not exist. Please compile circuits`);
  }
}
