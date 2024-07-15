export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type ExecCallResult = {
  stdout: string;
  stderr: string;
};
