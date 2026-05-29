import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill fetch globals for JSDOM environment
if (typeof global.Request === "undefined") {
  global.Request = globalThis.Request;
  global.Response = globalThis.Response;
  global.Headers = globalThis.Headers;
  global.fetch = globalThis.fetch;
}

// Global mocks for Redis/ioredis to prevent tests from initiating real connections
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      info: jest.fn().mockResolvedValue("redis_version:7.0.0"),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue("OK"),
      disconnect: jest.fn().mockResolvedValue("OK"),
      zRemRangeByScore: jest.fn().mockResolvedValue(0),
      zCard: jest.fn().mockResolvedValue(0),
      zRange: jest.fn().mockResolvedValue([]),
      zAdd: jest.fn().mockResolvedValue(1),
      pExpire: jest.fn().mockResolvedValue(true),
    };
  });
});

// Global mocks for BullMQ to prevent queue background workers from spinning up in tests
jest.mock("bullmq", () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: "job-id" }),
      on: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
    QueueScheduler: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
    Job: jest.fn(),
  };
});
