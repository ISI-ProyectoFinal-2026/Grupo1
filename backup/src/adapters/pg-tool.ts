import { spawn } from "child_process";
import type { DatabaseTool } from "../ports";

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

// máximo de stderr que se guarda para el mensaje de error
const STDERR_LIMIT = 4000;

export function pgDumpArgs(databaseUrl: string, outFile: string): string[] {
  return ["--format=custom", `--file=${outFile}`, `--dbname=${databaseUrl}`];
}

export function pgRestoreArgs(dumpFile: string, targetUrl: string): string[] {
  return ["--no-owner", "--clean", "--if-exists", `--dbname=${targetUrl}`, dumpFile];
}

// el mensaje de error no incluye los argumentos: la URL lleva la contraseña
export const runCommand: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_LIMIT);
    });
    child.on("error", (error) => reject(new Error(`No se pudo ejecutar ${command}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} terminó con código ${code}: ${stderr.trim()}`));
    });
  });

export class PgTool implements DatabaseTool {
  constructor(private readonly run: CommandRunner = runCommand) {}

  dump(databaseUrl: string, outFile: string): Promise<void> {
    return this.run("pg_dump", pgDumpArgs(databaseUrl, outFile));
  }

  restore(dumpFile: string, targetUrl: string): Promise<void> {
    return this.run("pg_restore", pgRestoreArgs(dumpFile, targetUrl));
  }
}
