import fs from "fs/promises";
import type { LocalFiles } from "../ports";

export class NodeFiles implements LocalFiles {
  async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async list(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  }

  async rename(from: string, to: string): Promise<void> {
    await fs.rename(from, to);
  }

  async remove(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true });
  }
}
