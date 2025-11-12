export type CompileTaskConfig = {
  json: boolean;
  c: boolean;
  force: boolean;
  quiet: boolean;
  optimization?: string;
};

type optimisationType = "O0" | "O1" | "O2" | undefined; // todo
