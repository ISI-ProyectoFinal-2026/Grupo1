/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  // Sin esto, `npm test` en local falla al cargar cualquier suite que importe
  // src/app.ts, porque app.ts exige JWT_SECRET y Jest no lee el .env por su
  // cuenta. En CI las variables ya vienen del workflow y dotenv no las pisa
  // (no sobreescribe lo que ya está en process.env), así que el comportamiento
  // del pipeline no cambia.
  setupFiles: ["dotenv/config"],
  transform: {
    "^.+\.ts$": ["ts-jest", { isolatedModules: true }],
  },
};
