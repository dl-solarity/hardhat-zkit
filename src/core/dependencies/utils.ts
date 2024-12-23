export function deepClone<T>(value: T): T {
  const visited = new WeakSet();

  const replacer = (_: any, obj: any) => {
    if (typeof obj === "object" && obj !== null) {
      if (visited.has(obj)) {
        return "[Circular]";
      }
      visited.add(obj);
    }

    return obj;
  };

  return JSON.parse(JSON.stringify(value, replacer));
}
