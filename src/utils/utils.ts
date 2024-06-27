import fs from "fs";
import path from "path";
import https from "https";

import { Reporter } from "../reporter";

/**
 * Reads a directory recursively and calls the callback for each file.
 *
 * @dev After Node.js 20.0.0 the `recursive` option is available.
 *
 * @param {string} dir - The directory to read.
 * @param {(dir: string, file: string) => void} callback - The callback function.
 */
export function readDirRecursively(dir: string, callback: (dir: string, file: string) => void): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      readDirRecursively(entryPath, callback);
    }

    if (entry.isFile()) {
      callback(dir, entryPath);
    }
  }
}

/**
 * Downloads a file from the specified URL.
 *
 * @param {string} file - The path to save the file to.
 * @param {string} url - The URL to download the file from.
 * @returns {Promise<boolean>} Whether the file was downloaded successfully.
 */
export async function downloadFile(file: string, url: string): Promise<boolean> {
  const fileStream = fs.createWriteStream(file);

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error(`Unable to download file. Status code: ${response.statusCode}.`);
        return;
      }

      const totalSize = parseInt(response.headers["content-length"] || "0", 10);

      Reporter!.reportStartFileDownloadingWithProgressBar(totalSize, 0);

      response.pipe(fileStream);

      response.on("data", (chunk) => {
        Reporter!.updateProgressBarValue(chunk.length);
      });

      fileStream.on("finish", () => {
        Reporter!.reportPtauFileDownloadingFinish();
        resolve(true);
      });

      fileStream.on("error", (err) => {
        Reporter!.reportPtauFileDownloadingError();
        fs.unlink(file, () => reject(err));
      });
    });

    fileStream.on("finish", () => resolve(true));

    request.on("error", (err) => {
      fs.unlink(file, () => reject(err));
    });

    request.end();
  });
}
