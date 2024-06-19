import fs from "fs";
import path from "path";
import https from "https";

import { MAX_PTAU_ID } from "./constants";
import { HardhatZKitError } from "../tasks/errors";

export class PtauDownloader {
  constructor(public readonly ptauDirFullPath: string) {}

  public async downloadPtau(ptauId: number): Promise<string> {
    if (ptauId > MAX_PTAU_ID) {
      throw new HardhatZKitError(
        `Circuits has too many constraints. The maximum ptauId to download is ${this.getMaxPtauID()}. Consider passing "ptauDir=PATH_TO_LOCAL_DIR" with existing ptau files.`,
      );
    }

    const ptauFileName: string = `powers-of-tau-${ptauId}.ptau`;

    const ptauFilePath = path.join(this.ptauDirFullPath, ptauFileName);
    const url = this.getDownloadURL(ptauId);

    fs.mkdirSync(this.ptauDirFullPath, { recursive: true });

    const fileStream = fs.createWriteStream(ptauFilePath);

    await new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        response.pipe(fileStream);
      });

      fileStream.on("finish", () => resolve(true));

      request.on("error", (err) => {
        fs.unlink(ptauFilePath, () => reject(err));
      });

      fileStream.on("error", (err) => {
        fs.unlink(ptauFilePath, () => reject(err));
      });

      request.end();
    });

    return ptauFilePath;
  }

  public getDownloadURL(ptauId: number): string {
    return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauId.toString().padStart(2, "0")}.ptau`;
  }

  public getMaxPtauID(): number {
    return MAX_PTAU_ID;
  }
}
