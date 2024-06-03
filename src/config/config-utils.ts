export function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

export function deepMerge(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

export function definedProps(obj: any): any {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== false));
}
