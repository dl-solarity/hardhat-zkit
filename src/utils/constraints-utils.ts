import * as snarkjs from "snarkjs";

import fsExtra from "fs-extra";

import { LinearCombination, R1CSConstraint } from "../../src/types/utils.js";
import { HardhatZKitError } from "../../src/errors.js";
import { terminateCurve } from "./utils.js";

export async function getR1CSConstraintsNumber(r1csFilePath: string): Promise<number> {
  const r1csDescriptor = fsExtra.openSync(r1csFilePath, "r");

  const readBytes = (position: number, length: number): bigint => {
    const buffer = Buffer.alloc(length);

    fsExtra.readSync(r1csDescriptor, buffer, { length, position });

    return BigInt(`0x${buffer.reverse().toString("hex")}`);
  };

  // https://github.com/iden3/r1csfile/blob/d82959da1f88fbd06db0407051fde94afbf8824a/doc/r1cs_bin_format.md#format-of-the-file
  const numberOfSections = readBytes(8, 4);
  let sectionStart = 12;

  for (let i = 0; i < numberOfSections; ++i) {
    const sectionType = Number(readBytes(sectionStart, 4));
    const sectionSize = Number(readBytes(sectionStart + 4, 8));

    // Reading header section
    if (sectionType == 1) {
      const totalConstraintsOffset = 4 + 8 + 4 + 32 + 4 + 4 + 4 + 4 + 8;

      return Number(readBytes(sectionStart + totalConstraintsOffset, 4));
    }

    sectionStart += 4 + 8 + sectionSize;
  }

  throw new HardhatZKitError(`Header section in ${r1csFilePath} file is not found.`);

  // const nConstraints =  (await snarkjs.r1cs.info(r1csFilePath)).nConstraints;

  //     await terminateCurve();

  //     return nConstraints;
}

export async function getGroth16ConstraintsNumber(r1csFilePath: string): Promise<number> {
  const r1cs = await snarkjs.r1cs.info(r1csFilePath);

  return r1cs.nConstraints + r1cs.nPubInputs + r1cs.nOutputs;
}

export async function getPlonkConstraintsNumber(r1csFilePath: string, Fr: any): Promise<number> {
  const normalize = (lc: LinearCombination) => {
    Object.keys(lc).forEach((key) => {
      if (lc[key] == 0n) delete lc[key];
    });
  };

  const join = (lc1: LinearCombination, k: bigint, lc2: LinearCombination) => {
    const res = { ...lc1 };

    Object.keys(lc2).forEach((s) => {
      res[s] = res[s] ? Fr.add(res[s], Fr.mul(k, lc2[s])) : lc2[s];
    });

    normalize(res);

    return res;
  };

  const reduceCoefs = (linearComb: LinearCombination, maxC: number) => {
    let n = Object.keys(linearComb).filter((s) => s !== "0" && linearComb[s] != 0n).length;

    while (n > maxC) {
      plonkConstraintsCount++;
      n--;
    }
  };

  const addConstraintSum = (lc: LinearCombination) => {
    reduceCoefs(lc, 3);
    plonkConstraintsCount++;
  };

  const getLinearCombinationType = (lc: LinearCombination) => {
    let k = Fr.zero;
    let n = 0;

    Object.keys(lc).forEach((key) => {
      if (lc[key] === 0n) {
        return;
      }

      if (key === "0") {
        k = Fr.add(k, lc[key]);
      } else {
        n++;
      }
    });

    return n > 0 ? n.toString() : k != Fr.zero ? "k" : "0";
  };

  const process = (lcA: LinearCombination, lcB: LinearCombination, lcC: LinearCombination) => {
    const lctA = getLinearCombinationType(lcA);
    const lctB = getLinearCombinationType(lcB);

    if (lctA === "0" || lctB === "0") {
      normalize(lcC);
      addConstraintSum(lcC);
    } else if (lctA === "k") {
      addConstraintSum(join(lcB, lcA[0], lcC));
    } else if (lctB === "k") {
      addConstraintSum(join(lcA, lcB[0], lcC));
    } else {
      [lcA, lcB, lcC].forEach((lc) => reduceCoefs(lc, 1));
      plonkConstraintsCount++;
    }
  };

  const r1cs = await snarkjs.r1cs.info(r1csFilePath);

  let plonkConstraintsCount = r1cs.nOutputs + r1cs.nPubInputs;

  r1cs.constraints.forEach((constraint: R1CSConstraint) => process(...constraint));

  return plonkConstraintsCount;
}
