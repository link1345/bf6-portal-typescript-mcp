import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, URL } from "node:url";
import * as tar from "tar";

const owner = "link1345";
const repo = "bf-portal-book";
const branch = "main";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(packageRoot, "vendor");
const targetDir = path.join(vendorRoot, repo);
const archiveUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${branch}`;

await downloadBook();

async function downloadBook() {
  await fs.mkdir(vendorRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(vendorRoot, `.${repo}-`));
  const archivePath = path.join(tempDir, `${repo}.tar.gz`);
  const extractDir = path.join(tempDir, "extract");

  try {
    await fs.mkdir(extractDir, { recursive: true });
    await downloadFile(archiveUrl, archivePath);
    await tar.x({
      file: archivePath,
      cwd: extractDir,
      strip: 1
    });

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.rename(extractDir, targetDir);
    console.log(`Downloaded ${owner}/${repo} to ${path.relative(packageRoot, targetDir)}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadFile(url, outputPath, redirectsRemaining = 5) {
  await new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "bf6-portal-typescript-mcp" } }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        if (redirectsRemaining === 0) {
          reject(new Error(`Too many redirects while downloading ${url}`));
          return;
        }
        const nextUrl = new URL(location, url).toString();
        downloadFile(nextUrl, outputPath, redirectsRemaining - 1).then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download ${url}: HTTP ${statusCode}`));
        return;
      }

      pipeline(response, createWriteStream(outputPath)).then(resolve, reject);
    });

    request.on("error", reject);
  });
}
