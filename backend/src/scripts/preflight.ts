import "dotenv/config";
import { defaultChecks, formatPreflightReport, preflightExitCode, runPreflight } from "./preflight-checks";

// uso: npm run preflight | docker compose exec backend node dist/scripts/preflight.js
async function main(): Promise<void> {
  const results = await runPreflight(defaultChecks());
  console.log(formatPreflightReport(results));
  process.exit(preflightExitCode(results));
}

void main();
