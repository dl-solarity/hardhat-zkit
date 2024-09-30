import { NomicLabsHardhatPluginError } from "hardhat/plugins";

import { PLUGIN_NAME } from "./constants";

/**
 * Custom error class for handling errors within the Hardhat ZKit plugin.
 *
 * This class extends the {@link NomicLabsHardhatPluginError} to provide
 * more specific error handling for the ZKit plugin. It allows for
 * the inclusion of a parent error for better context when errors
 * are propagated, while maintaining the plugin name for consistent
 * error reporting.
 */
export class HardhatZKitError extends NomicLabsHardhatPluginError {
  constructor(message: string, parent?: Error) {
    super(PLUGIN_NAME, message, parent);

    Object.setPrototypeOf(this, HardhatZKitError.prototype);
  }
}
