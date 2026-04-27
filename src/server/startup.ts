/**
 * Server startup initialization
 * Starts background services when the Next.js server boots
 */

import { startHorizonStream } from "./services/horizon-stream.service";

let initialized = false;

/**
 * Initialize all background services
 * Should be called once when the server starts
 */
export async function initializeServices(): Promise<void> {
  if (initialized) {
    console.warn("[startup] Services already initialized");
    return;
  }

  console.log("[startup] Initializing background services...");

  try {
    // Start Horizon payment stream
    if (process.env.ENABLE_HORIZON_STREAM !== "false") {
      await startHorizonStream();
      console.log("[startup] ✓ Horizon stream started");
    } else {
      console.log("[startup] ⊘ Horizon stream disabled");
    }

    // Add other background services here
    // e.g., Redis connection, scheduled jobs, etc.

    initialized = true;
    console.log("[startup] All services initialized successfully");
  } catch (error) {
    console.error("[startup] Failed to initialize services:", error);
    throw error;
  }
}

/**
 * Graceful shutdown of all services
 */
export async function shutdownServices(): Promise<void> {
  console.log("[startup] Shutting down services...");

  const { stopHorizonStream } = await import("./services/horizon-stream.service");
  stopHorizonStream();

  initialized = false;
  console.log("[startup] Services shut down");
}

// Handle process termination
if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    console.log("[startup] SIGTERM received");
    await shutdownServices();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[startup] SIGINT received");
    await shutdownServices();
    process.exit(0);
  });
}
