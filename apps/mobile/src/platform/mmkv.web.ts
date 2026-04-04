/**
 * Web fallback for react-native-mmkv.
 * Uses localStorage as a simple key-value store on web.
 * Metro resolves `react-native-mmkv` to this file when building for web.
 */

export class MMKV {
  private id: string;

  constructor(config?: { id?: string }) {
    this.id = config?.id ?? "default";
  }

  set(key: string, value: string | number | boolean): void {
    localStorage.setItem(`${this.id}:${key}`, JSON.stringify(value));
  }

  getString(key: string): string | undefined {
    const val = localStorage.getItem(`${this.id}:${key}`);
    if (val === null) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  getNumber(key: string): number | undefined {
    const val = this.getString(key);
    return val !== undefined ? Number(val) : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const val = this.getString(key);
    return val !== undefined ? val === "true" || val === true : undefined;
  }

  delete(key: string): void {
    localStorage.removeItem(`${this.id}:${key}`);
  }

  contains(key: string): boolean {
    return localStorage.getItem(`${this.id}:${key}`) !== null;
  }

  clearAll(): void {
    const prefix = `${this.id}:`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  getAllKeys(): string[] {
    const prefix = `${this.id}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k.slice(prefix.length));
    }
    return keys;
  }
}
