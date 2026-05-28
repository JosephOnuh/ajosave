import { getRedis } from "./redis";

const MAX_FAILURES = 5;
const FAILURE_WINDOW = 10 * 60; // 10 minutes in seconds
const LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds

/**
 * Checks if a phone number is currently locked out.
 */
export async function isLockedOut(phone: string): Promise<boolean> {
  const redis = await getRedis();
  const lockoutKey = `lockout:${phone}`;
  const isLocked = await redis.get(lockoutKey);
  return !!isLocked;
}

/**
 * Increments the failure count for a phone number.
 * Locks the account if failures exceed MAX_FAILURES.
 */
export async function recordFailure(phone: string): Promise<number> {
  const redis = await getRedis();
  const attemptsKey = `otp_failures:${phone}`;
  const lockoutKey = `lockout:${phone}`;

  const failures = await redis.incr(attemptsKey);
  if (failures === 1) {
    await redis.expire(attemptsKey, FAILURE_WINDOW);
  }

  if (failures >= MAX_FAILURES) {
    await redis.set(lockoutKey, "1", { EX: LOCKOUT_DURATION });
    await redis.del(attemptsKey);
  }

  return failures;
}

/**
 * Resets failure counts and lockout state for a phone number.
 */
export async function resetLockout(phone: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`otp_failures:${phone}`);
  await redis.del(`lockout:${phone}`);
}
