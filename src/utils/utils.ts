import fs from "fs";
import https from "https";
import { exec } from "child_process";

import { Reporter } from "../reporter";
import { ExecCallResult } from "../types/utils";

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
