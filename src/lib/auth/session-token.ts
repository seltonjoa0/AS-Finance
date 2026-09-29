import { createHash, randomBytes } from "node:crypto";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiration(days: number, now = new Date()) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);
}
