export function createId(prefix) {
    const random = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    return `${prefix}_${random}`;
}
export function nowIso() {
    return new Date().toISOString();
}
