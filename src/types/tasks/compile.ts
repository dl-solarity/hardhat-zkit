export type CompileTaskConfig = {
  force: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
  optimization?: "O0" | "O1" | "O2";
};
