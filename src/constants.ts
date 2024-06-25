export const PLUGIN_NAME = "@solarity/hardhat-zkit";

export const CIRCOM_CIRCUITS_CACHE_FILENAME = "circom-circuits-cache.json";

export const FORMAT_VERSION = "hh-zkit-cache-1";

export const NODE_MODULES = "node_modules";
export const COMPILER_VERSION = "0.2.18";

export const MB_SIZE = 1048576;

export const MAX_PTAU_ID = 27;
export const PTAU_FILE_REG_EXP = /^(?:.+-|)(\d{1,2}).ptau$/;

export const INCLUDE_REG_EXP = /include +"([.\-/\w]+)";/g;
export const PRAGMA_VERSION_REG_EXP = /pragma +circom +(\d\.\d\.\d) *;/g;
export const CIRCOM_FILE_REG_EXP = /\w+\.circom/;

export const NODE_MODULES_REG_EXP = /^node_modules\//;
export const URI_SCHEME_REG_EXP = /([a-zA-Z]+):\/\//;

export const MAIN_COMPONENT_REG_EXP = /component +main/;
