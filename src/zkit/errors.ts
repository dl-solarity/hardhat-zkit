import { NomicLabsHardhatPluginError } from "hardhat/plugins";

export class HardhatZKitError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super("@solarity/hardhat-zkit", message, parent);
  }
}

export class NonExistentCircuitError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`Circuit '${circuit}' does not exist`);
  }
}

export class NotAFullCircuitError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`Circuit '${circuit}' does not have a main component definition`);
  }
}
