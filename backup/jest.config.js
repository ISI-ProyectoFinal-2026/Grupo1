/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  transform: {
    "^.+\.ts$": ["ts-jest", { isolatedModules: true }],
  },
  // cli.ts solo arma dependencias reales y despacha comandos
  collectCoverageFrom: ["src/**/*.ts", "!src/cli.ts"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
  coverageReporters: ["text-summary", "html", "lcov"],
};
