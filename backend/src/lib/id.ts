export function createId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return `${prefix}_${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
