import fsExtra from "fs-extra";
import https from "https";
import { createHash } from "crypto";
import { exec } from "child_process";

import * as snarkjs from "snarkjs";

import { ProvingSystemType } from "@solarity/zkit";

import { Reporter } from "../reporter";
import { HardhatZKitError } from "../errors";
import { BN128_CURVE_NAME } from "../constants";

import { ExecCallResult } from "../types/utils";

/**
 * Downloads a file from the specified URL
 *
 * @param file The path to save the file to
 * @param url The URL to download the file from
 * @param onFinishReporter The Reporter callback function for when the download finishes
 * @param onErrorReporter The Reporter callback function for when an error occurs during the download
 * @returns Whether the file was downloaded successfully
 */
export async function downloadFile(
  file: string,
  url: string,
  onFinishReporter: () => void,
  onErrorReporter: () => void,
): Promise<boolean> {
  try {
    await fsExtra.ensureFile(file);
    const fileStream = fsExtra.createWriteStream(file);

    return new Promise((resolve) => {
      const handleRequest = (currentUrl: string) => {
        const request = https.get(currentUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              handleRequest(redirectUrl);
            } else {
              onErrorReporter();
              fsExtra.unlink(file, () => resolve(false));
            }
            return;
          }

          if (response.statusCode !== 200) {
            onErrorReporter();
            fsExtra.unlink(file, () => resolve(false));
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
              fsExtra.unlink(file, () => resolve(false));
            });

          fileStream
            .on("finish", () => {
              fileStream.close(() => {
                onFinishReporter();
                resolve(true);
              });
            })
            .on("error", () => {
              onErrorReporter();
              fsExtra.unlink(file, () => resolve(false));
            });
        });

        request.on("error", () => {
          fsExtra.unlink(file, () => resolve(false));
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

export async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha1");
    const stream = fsExtra.createReadStream(filePath);

    stream.on("data", (data: string | Buffer) => {
      // Add data chunk to the hash object
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", () => {
      reject(new HardhatZKitError(`Failed to read ${filePath} file`));
    });
  });
}

export function getUniqueProvingSystems(provingSystems: ProvingSystemType | ProvingSystemType[]): ProvingSystemType[] {
  if (Array.isArray(provingSystems)) {
    return [...new Set(provingSystems)];
  } else {
    return [provingSystems];
  }
}

export async function terminateCurve() {
  await (await (snarkjs as any).curves.getCurveFromName(BN128_CURVE_NAME)).terminate();
}
