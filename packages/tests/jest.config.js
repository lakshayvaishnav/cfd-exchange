/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/setup/**", "!src/fixtures/**", "!src/mocks/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/src/setup/jest.setup.ts"],
  globalSetup: "<rootDir>/src/setup/global-setup.ts",
  globalTeardown: "<rootDir>/src/setup/global-teardown.ts",
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  // Skip ESM workspace packages for now - only run engine tests
  testPathIgnorePatterns: ["/node_modules/", "/src/api/", "/src/integration/"],
};
