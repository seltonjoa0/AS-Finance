import { getServerEnv } from "@/lib/env";

type Entry = {
  attempts: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

export function consumeAuthAttempt(key: string, now = Date.now()) {
  const env = getServerEnv();
  const windowMs = env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.attempts >= env.AUTH_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000),
    };
  }

  current.attempts += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearAuthAttempts(key: string) {
  buckets.delete(key);
}
