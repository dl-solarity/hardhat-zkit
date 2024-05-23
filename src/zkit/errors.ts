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

export class UncompiledCircuitError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`Circuit '${circuit}' was not compiled yet. Please compile circuits and try again`);
  }
}

export class CircuitWithoutMainComponentError extends HardhatZKitError {
  constructor(circuit: string) {
    super(`Circuit '${circuit}' does not have a main component definition`);
  }
}
