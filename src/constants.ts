export const PLUGIN_NAME = "@solarity/hardhat-zkit";

export const CIRCUITS_COMPILE_CACHE_FILENAME = "circuits-compile-cache.json";
export const CIRCUITS_SETUP_CACHE_FILENAME = "circuits-setup-cache.json";

export const CIRCUIT_COMPILE_CACHE_VERSION = "hh-zkit-compile-cache-1";
export const CIRCUIT_SETUP_CACHE_VERSION = "hh-zkit-setup-cache-1";
export const CIRCUIT_ARTIFACT_VERSION = "hh-zkit-artifacts-1";

export const NODE_MODULES = "node_modules";
export const COMPILER_VERSION = "0.2.18";

export const MAGIC_DESCRIPTOR = 1337;

export const BYTES_IN_MB = 1048576;

export const MAX_PTAU_ID = 27;
export const PTAU_FILE_REG_EXP = /^(?:.+-|)(\d{1,2}).ptau$/;

export const INCLUDE_REG_EXP = /^\s*include\s+"([.\-/\w]+)";/gm;
export const PRAGMA_VERSION_REG_EXP = /pragma\s+circom\s+(\d\.\d\.\d);/g;
export const CIRCOM_FILE_REG_EXP = /\w+\.circom/;

export const NODE_MODULES_REG_EXP = /^node_modules\//;
export const URI_SCHEME_REG_EXP = /([a-zA-Z]+):\/\//;

export const MAIN_COMPONENT_REG_EXP = /component\s+main.*=\s*([\w-]+)\s*\((?:.*\s*)*\)\s*;/gm;

export const CIRCUIT_ARTIFACTS_SUFFIX = "_artifacts.json";
