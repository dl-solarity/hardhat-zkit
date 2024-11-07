export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type ExecCallResult = {
  stdout: string;
  stderr: string;
};

export type LinearCombination = { [key: string]: bigint };

export type R1CSConstraint = [LinearCombination, LinearCombination, LinearCombination];
