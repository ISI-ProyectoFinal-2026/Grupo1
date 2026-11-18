export type Command =
  | { command: "daemon" }
  | { command: "run-once" }
  | { command: "restore"; source: string; targetUrl: string };

export const USAGE = [
  "Uso:",
  "  node dist/cli.js [daemon]                          backup diario a BACKUP_HOUR",
  "  node dist/cli.js run-once                          backup completo ahora",
  "  node dist/cli.js restore <dump> --target <url>     <dump>: ruta local o r2:db/<archivo>",
].join("\n");

function parseRestore(args: string[]): Command {
  let source: string | undefined;
  let targetUrl: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--target") {
      targetUrl = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--target=")) {
      targetUrl = arg.slice("--target=".length);
    } else {
      source = arg;
    }
  }
  // sin destino por defecto: evita pisar la base en uso por error
  if (!targetUrl) throw new Error(`restore requiere --target <url de la base destino>\n${USAGE}`);
  if (!source) throw new Error(`restore requiere el dump a restaurar\n${USAGE}`);
  return { command: "restore", source, targetUrl };
}

export function parseCommand(argv: string[]): Command {
  const [command = "daemon", ...rest] = argv;
  if (command === "daemon" || command === "run-once") return { command };
  if (command === "restore") return parseRestore(rest);
  throw new Error(`Comando desconocido: ${command}\n${USAGE}`);
}
