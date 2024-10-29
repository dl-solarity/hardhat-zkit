export enum CompilerPlatformBinary {
  LINUX_AMD = "circom-linux-amd64",
  LINUX_ARM = "circom-linux-arm64",
  WINDOWS_AMD = "circom-windows-amd64.exe",
  WINDOWS_ARM = "circom-windows-arm64.exe",
  MACOS_AMD = "circom-macos-amd64",
  MACOS_ARM = "circom-macos-arm64",
  WASM = "circom.wasm",
}

export type CompilerInfo = {
  binaryPath: string;
  version: string;
  isWasm: boolean;
};
