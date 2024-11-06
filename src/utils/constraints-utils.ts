import * as snarkjs from "snarkjs";
// @ts-expect-error: No type definitions available for the "r1csfile" package
import * as r1csfile from "r1csfile";
// @ts-expect-error: No type definitions available for the "@iden3/binfileutils" package
import * as binfileutils from "@iden3/binfileutils";

import { LinearCombination, R1CSConstraint } from "../../src/types/utils";

export async function getR1CSConstraintsNumber(r1csFilePath: string): Promise<number> {
  return (await snarkjs.r1cs.info(r1csFilePath)).nConstraints;
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

  const { fd: fdR1cs, sections: sectionsR1cs } = await binfileutils.readBinFile(
    r1csFilePath,
    "r1cs",
    1,
    1 << 22,
    1 << 24,
  );
  const r1cs = await r1csfile.readR1csFd(fdR1cs, sectionsR1cs, { loadConstraints: true, loadCustomGates: true });

  let plonkConstraintsCount = r1cs.nOutputs + r1cs.nPubInputs;

  r1cs.constraints.forEach((constraint: R1CSConstraint) => process(...constraint));

  await fdR1cs.fd.close();

  return plonkConstraintsCount;
}
