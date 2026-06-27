/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/e2e/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",
    "!src/app/error.tsx",
    "!src/app/**/error.tsx",
  ],
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 70, statements: 70 },
  },
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "jest-environment-jsdom",
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"],
      testPathIgnorePatterns: ["<rootDir>/src/__tests__/integration/"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    },
    {
      displayName: "integration",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    },
  ],
};

module.exports = config;
