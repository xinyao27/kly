// Pure utility functions and constants

export const MAX_RETRIES = 3;
export const DEFAULT_TIMEOUT = 5000;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function retry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) throw err;
    return sleep(100).then(() => retry(fn, retries - 1));
  });
}
