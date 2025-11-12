import { PackageJSON } from "resolve";

import fsExtra from "fs-extra";
import { FileNotFoundError, findUp, getFileTrueCase } from "@nomicfoundation/hardhat-utils/fs";
import path from "path";
import { HardhatZKitError } from "../errors.js";
import { NODE_MODULES } from "../constants.js";
import { getSourceNameTrueCase } from "./path-utils.js";

/**
 * This function returns true if the sourceName contains the current package's name
 * as a substring
 */
export async function includesOwnPackageName(sourceName: string): Promise<boolean> {
  const packageName = await getPackageName(sourceName);
  if (packageName !== "") {
    return sourceName.startsWith(`${packageName}/`);
  }
  return false;
}

export async function getPackageName(file: string): Promise<string> {
  const packageJsonPath = await findClosestPackageJson(file);

  if (packageJsonPath !== undefined && packageJsonPath !== "") {
    const packageJson: PackageJSON = await fsExtra.readJSON(packageJsonPath);

    return packageJson.name as string;
  }

  return "";
}

export async function findClosestPackageJson(file: string): Promise<string | undefined> {
  return findUp("package.json", path.dirname(file));
}

/**
 * This function validates the source name's format.
 *
 * It throws if the format is invalid.
 * If it doesn't throw all you know is that the format is valid.
 */
export function validateSourceNameFormat(sourceName: string) {
  if (isAbsolutePathSourceName(sourceName)) {
    throw new HardhatZKitError(`Invalid source name ${sourceName}: absolute path`);
  }

  if (isExplicitRelativePath(sourceName)) {
    throw new HardhatZKitError(`Invalid source name ${sourceName}: relative path`);
  }
}

/**
 * This function returns true if the sourceName is a unix absolute path or a
 * platform-dependent one.
 *
 * This function is used instead of just `path.isAbsolute` to ensure that
 * source names never start with `/`, even on Windows.
 */
export function isAbsolutePathSourceName(sourceName: string): boolean {
  return path.isAbsolute(sourceName) || sourceName.startsWith("/");
}

/**
 * This function returns true if the sourceName is a unix path that is based on
 * the current directory `./`.
 */
function isExplicitRelativePath(sourceName: string): boolean {
  const [base] = sourceName.split("/", 1);
  return base === "." || base === "..";
}

/**
 * This function returns true if the sourceName is, potentially, from a local
 * file. It doesn't validate that the file actually exists.
 *
 * The source name must be in a valid format.
 */
export async function isLocalSourceName(projectRoot: string, sourceName: string): Promise<boolean> {
  // Note that we consider "hardhat/console.sol" as a special case here.
  // This lets someone have a "hardhat" directory within their project without
  // it impacting their use of `console.log`.
  // See issue https://github.com/nomiclabs/hardhat/issues/998
  if (sourceName.includes(NODE_MODULES) || sourceName === "hardhat/console.sol") {
    return false;
  }

  const slashIndex = sourceName.indexOf("/");
  const firstDirOrFileName = slashIndex !== -1 ? sourceName.substring(0, slashIndex) : sourceName;

  try {
    await getFileTrueCase(projectRoot, firstDirOrFileName);
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      return false;
    }
    throw error;
  }

  return true;
}

/**
 * Validates that a source name exists, starting from `fromDir`, and has the
 * right casing.
 *
 * The source name must be in a valid format.
 */
export async function validateSourceNameExistenceAndCasing(fromDir: string, sourceName: string) {
  const trueCaseSourceName = await getSourceNameTrueCase(fromDir, sourceName);

  if (trueCaseSourceName !== sourceName) {
    throw new Error(
      "SOURCE_NAMES.WRONG_CASING",
      //   {
      //   incorrect: sourceName,
      //   correct: trueCaseSourceName,
      // }
    );
  }
}
