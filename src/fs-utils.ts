import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(target: string): Promise<string | undefined> {
  try {
    return await fs.readFile(target, "utf8");
  } catch {
    return undefined;
  }
}

export async function walkFiles(root: string, predicate?: (filePath: string) => boolean): Promise<string[]> {
  const found: string[] = [];
  if (!(await pathExists(root))) return found;

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && (!predicate || predicate(fullPath))) {
        found.push(fullPath);
      }
    }
  }

  await walk(root);
  return found.sort();
}

export function relativePosix(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join("/");
}
