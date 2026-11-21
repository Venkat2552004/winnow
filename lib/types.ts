export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively merge `patch` into `base`, ignoring `undefined` values. */
export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;

  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out as T;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
