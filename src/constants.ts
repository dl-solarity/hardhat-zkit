export const PLUGIN_NAME = "@solarity/hardhat-zkit";

export const CIRCUITS_COMPILE_CACHE_FILENAME = "circuits-compile-cache.json";
export const CIRCUITS_SETUP_CACHE_FILENAME = "circuits-setup-cache.json";

export const CIRCUIT_COMPILE_CACHE_VERSION = "hh-zkit-compile-cache-1";
export const CIRCUIT_SETUP_CACHE_VERSION = "hh-zkit-setup-cache-1";
export const CIRCUIT_ARTIFACT_VERSION = "hh-zkit-artifacts-1";

export const BN128_CURVE_NAME = "bn128";

export const NODE_MODULES = "node_modules";

export const MAGIC_DESCRIPTOR = 1337;

export const BYTES_IN_MB = 1048576;

export const MAX_PTAU_ID = 27;
export const PTAU_FILE_REG_EXP = /^(?:.+-|)(\d{1,2}).ptau$/;

export const CIRCOM_FILE_REG_EXP = /\w+\.circom/;

export const NODE_MODULES_REG_EXP = /^node_modules\//;
export const URI_SCHEME_REG_EXP = /([a-zA-Z]+):\/\//;

export const CIRCUIT_ARTIFACTS_SUFFIX = "_artifacts.json";

export const COMPILER_AMD_REPOSITORY_URL = "https://github.com/iden3/circom/releases/download";
export const COMPILER_ARM_REPOSITORY_URL = "https://github.com/distributed-lab/circom/releases/download";
export const COMPILER_WASM_REPOSITORY_URL = "https://github.com/distributed-lab/circom-wasm/releases/download";

export const LATEST_SUPPORTED_CIRCOM_VERSION = "2.1.9";
export const OLDEST_SUPPORTED_CIRCOM_VERSION = "2.0.5";

export const WASM_COMPILER_VERSIONING: { [key: string]: string } = {
  "2.1.8": "0.2.18-rc.3",
  "2.1.9": "0.2.19-rc.0",
};
