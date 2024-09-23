import fs from "fs-extra";
import https from "https";
import { exec } from "child_process";

import { createNonCryptographicHashBasedIdentifier } from "hardhat/internal/util/hash";

import { Reporter } from "../reporter";

import { ExecCallResult } from "../types/utils";

/**
 * Downloads a file from the specified URL.
 *
 * @param {string} file - The path to save the file to.
 * @param {string} url - The URL to download the file from.
 * @param {Function} onFinishReporter - The Reporter callback function for when the download finishes.
 * @param {Function} onErrorReporter - The Reporter callback function for when an error occurs during the download.
 * @returns {Promise<boolean>} Whether the file was downloaded successfully.
 */
export async function downloadFile(
  file: string,
  url: string,
  onFinishReporter: () => void,
  onErrorReporter: () => void,
): Promise<boolean> {
  try {
    await fs.ensureFile(file);
    const fileStream = fs.createWriteStream(file);

    return new Promise((resolve) => {
      const handleRequest = (currentUrl: string) => {
        const request = https.get(currentUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              handleRequest(redirectUrl);
            } else {
              onErrorReporter();
              fs.unlink(file, () => resolve(false));
            }
            return;
          }

          if (response.statusCode !== 200) {
            onErrorReporter();
            fs.unlink(file, () => resolve(false));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"] || "0", 10);
          Reporter!.reportStartFileDownloadingWithProgressBar(totalSize, 0);

          response.pipe(fileStream);

          response
            .on("data", (chunk) => {
              Reporter!.updateProgressBarValue(chunk.length);
            })
            .on("error", () => {
              onErrorReporter();
              fs.unlink(file, () => resolve(false));
            });

          fileStream
            .on("finish", () => {
              onFinishReporter();
              resolve(true);
            })
            .on("error", () => {
              onErrorReporter();
              fs.unlink(file, () => resolve(false));
            });
        });

        request.on("error", () => {
          fs.unlink(file, () => resolve(false));
        });
      };

      handleRequest(url);
    });
  } catch (error: any) {
    return false;
  }
}

export async function execCall(execFile: string, callArgs: string[]): Promise<ExecCallResult> {
  return new Promise<ExecCallResult>((resolve, reject) => {
    exec(`${execFile} ${callArgs.join(" ")}`, (error, stdout, stderr) => {
      if (error === null) {
        resolve({ stdout, stderr });
      } else {
        reject(error);
      }
    });
  });
}

export function getFileHash(filePath: string): string {
  return createNonCryptographicHashBasedIdentifier(Buffer.from(fs.readFileSync(filePath))).toString("hex");
}
