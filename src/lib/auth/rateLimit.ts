interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();
let lastPrune = Date.now();

function pruneExpired(now: number) {
  for (const [k, b] of buckets.entries()) {
    if (b.resetAt <= now) {
      buckets.delete(k);
    }
  }
  lastPrune = now;
}

export function checkRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Prune expired buckets every 60 seconds or when map approaches threshold
  if (now - lastPrune > 60_000 || buckets.size >= MAX_BUCKETS) {
    pruneExpired(now);
  }

  // If still at capacity after pruning, evict the oldest key to prevent unbounded memory growth
  if (buckets.size >= MAX_BUCKETS) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function _resetRateLimitsForTesting(): void {
  buckets.clear();
  lastPrune = Date.now();
}

export function _getRateLimitBucketCountForTesting(): number {
  return buckets.size;
}
