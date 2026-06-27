import { NextResponse } from "next/server";
import { query, getPoolStats } from "@/lib/db";
import { serverConfig } from "@/server/config";
import { checkHorizonHealth } from "@/lib/stellar";
import logger from "@/lib/logger";

const POOL_WAITING_ALERT_THRESHOLD = 3;

async function checkDb(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: serverConfig.redis.url });
    await client.connect();
    await client.ping();
    await client.disconnect();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis, horizon] = await Promise.all([checkDb(), checkRedis(), checkHorizonHealth()]);

  const healthy = db && redis;
  const poolStats = getPoolStats();

  // Alert when waiting queue exceeds threshold (#478)
  if (poolStats && poolStats.waitingCount > POOL_WAITING_ALERT_THRESHOLD) {
    logger.warn(
      { pool: poolStats },
      `[db] Pool waiting queue (${poolStats.waitingCount}) exceeds threshold of ${POOL_WAITING_ALERT_THRESHOLD}`
    );
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db: db ? "ok" : "error",
      redis: redis ? "ok" : "error",
      horizon: horizon ? "ok" : "error",
      pool: poolStats
        ? {
            total: poolStats.totalCount,
            idle: poolStats.idleCount,
            waiting: poolStats.waitingCount,
            alert: poolStats.waitingCount > POOL_WAITING_ALERT_THRESHOLD,
          }
        : null,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
