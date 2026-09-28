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
  // Sin `collectCoverageFrom` Jest solo mide los archivos que algún test
  // importa, lo que infla el porcentaje: un módulo sin tests simplemente no
  // aparece en el reporte. Con el glob, todo `src/` cuenta aunque nadie lo
  // toque, que es lo que pide el criterio de "cobertura global".
  collectCoverageFrom: [
    "src/**/*.ts",
    // Entrypoints, no lógica: index.ts solo hace listen() y check-connection.ts
    // es un script de CLI (`npm run db:check`). No hay nada que testear acá.
    "!src/index.ts",
    "!src/db/check-connection.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "html", "lcov"],
};
