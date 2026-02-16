export class MemoryCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}
