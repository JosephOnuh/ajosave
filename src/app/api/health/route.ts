import { NextResponse } from "next/server";
import { serverConfig } from "@/server/config";

async function checkDb(): Promise<boolean> {
  try {
    // Lightweight DB check — replace with actual query when DB client is wired up
    return Boolean(serverConfig.database.url);
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    return Boolean(serverConfig.redis.url);
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const healthy = db && redis;
  const body = {
    status: healthy ? "ok" : "degraded",
    db: db ? "ok" : "error",
    redis: redis ? "ok" : "error",
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
