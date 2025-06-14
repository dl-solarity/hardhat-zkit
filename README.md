![](https://github.com/dl-solarity/hardhat-zkit/assets/47551140/938bf108-194d-45de-a6f1-7280aaa0c8c1)

[![npm](https://img.shields.io/npm/v/@solarity/hardhat-zkit.svg)](https://www.npmjs.com/package/@solarity/hardhat-zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/dl-solarity/hardhat-zkit/actions/workflows/tests.yml/badge.svg?branch=master)](https://github.com/dl-solarity/hardhat-zkit/actions/workflows/tests.yml)
[![GitPOAP Badge](https://public-api.gitpoap.io/v1/repo/dl-solarity/hardhat-zkit/badge)](https://www.gitpoap.io/gh/dl-solarity/hardhat-zkit)
[![hardhat](https://hardhat.org/buidler-plugin-badge.svg?1)](https://hardhat.org)

# Hardhat ZKit

**The ultimate TypeScript environment for Circom development.**

## What

This hardhat plugin is a zero-config, one-stop Circom development environment that streamlines circuits management and lets you focus on the important - code.

- Developer-oriented abstractions that simplify `r1cs`, `witness`, `zkey`, and `vkey` generation processes.
- Support of `groth16` and `plonk` proving systems.
- Recompilation and resetup of only the modified circuits.
- Full TypeScript typization of signals and ZK proofs.
- Automatic downloads of phase-1 `ptau` files.
- Convenient phase-2 contributions to `zkey` files.
- Practical witness (with signals substitution) and proof testing via chai assertions.
- Invisible platform-specific and `wasm`-based Circom compiler management.
- Simplified `node_modules` libraries resolution.
- Rich plugin configuration.
- And much more!

## Installation

```bash
npm install --save-dev @solarity/hardhat-zkit
```

And add the following line to your `hardhat.config`:

```ts
import "@solarity/hardhat-zkit"; // TypeScript

require("@solarity/hardhat-zkit"); // JavaScript
```

> [!TIP]
> There is no need to download the Circom compiler separately. The plugin automatically installs required compilers under the hood.

## Usage

The `hardhat-zkit` is a zero-config plugin, however, you may add the following to your `hardhat.config` file:

```ts
module.exports = {
  zkit: {
    compilerVersion: "2.1.9",
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      onlyFiles: [],
      skipFiles: [],
      c: false,
      json: false,
      optimization: "O1",
    },
    setupSettings: {
      contributionSettings: {
        provingSystem: "groth16", // or "plonk"
        contributions: 2,
      },
      onlyFiles: [],
      skipFiles: [],
      ptauDir: undefined,
      ptauDownload: true,
    },
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
      verifiersType: "sol", // or "vy"
    },
    typesDir: "generated-types/zkit",
    typesWitnessLimit: 50000,
    quiet: false,
  },
};
```

Where:

- `compilerVersion` - The value to indicate which Circom compiler to use (latest by default).
- `circuitsDir` - The directory where to look for the circuits.
- `compilationSettings`
  - `artifactsDir` - The directory where to save the circuits artifacts (r1cs, zkey, etc).
  - `onlyFiles` - The list of directories (or files) to be considered for the compilation.
  - `skipFiles` - The list of directories (or files) to be excluded from the compilation.
  - `c` - The flag to generate the c-based witness generator (generates wasm by default).
  - `json` - The flag to output the constraints in json format.
  - `optimization` - The flag to set the level of constraint simplification during compilation (`"O0"`, `"O1"` or `"O2"`). 
- `setupSettings`
  - `contributionSettings`
    - `provingSystem` - The option to indicate which proving system to use (`"groth16"`, `"plonk"` or `["groth16", "plonk"]`).
    - `contributions` - The number of phase-2 `zkey` contributions to make if `groth16` is chosen.
  - `onlyFiles` - The list of directories (or files) to be considered for the setup phase.
  - `skipFiles` - The list of directories (or files) to be excluded from the setup phase.
  - `ptauDir` - The directory where to look for the `ptau` files. `$HOME/.zkit/ptau/` by default.
  - `ptauDownload` - The flag to allow automatic download of required `ptau` files.
- `verifiersSettings`
    - `verifiersDir` - The directory where to generate the Solidity | Vyper verifiers.
    - `verifiersType` - The option (`"sol"` or `"vy"`) to indicate which language to use for verifiers generation.
- `typesDir` - The directory where to save the generated typed circuits wrappers.
- `typesWitnessLimit` - The maximum number of witness substitution signals to generate types for.
- `quiet` - The flag indicating whether to suppress the output.

### Tasks

There are several hardhat tasks in the `zkit` scope that the plugin provides:

- `compile` task that compiles or recompiles the modified circuits with the main component.
- `setup` task that generates or regenerates `zkey` and `vkey` for the previously compiled circuits.
- `make` task that executes both `compile` and `setup` for convenience.
- `verifiers` task that generates Solidity | Vyper verifiers for all the previously setup circuits.
- `clean` task that cleans up the generated artifacts, types, etc.

To view the available options, run the help command:

```bash
npx hardhat help zkit <zkit task name>
```

### Typization

The plugin provides full TypeScript typization of Circom circuits leveraging [`zktype`](https://github.com/dl-solarity/zktype) library. Both `groth16` and `plonk` proving systems are supported.

The following config may be added to `tsconfig.json` file to allow for a better development experience:

```json
{
  "compilerOptions": {
    "paths": {
      "@zkit": ["./generated-types/zkit"]
    }
  }
}
```

### Testing

In order to utilize user-friendly [Chai](https://www.chaijs.com/) assertions for witness and ZK proof testing, the [`chai-zkit`](https://github.com/dl-solarity/chai-zkit) package needs to be installed:

```bash
npm install --save-dev @solarity/chai-zkit
```

And add the following line to your `hardhat.config`:

```ts
import "@solarity/chai-zkit"; // TypeScript

require("@solarity/chai-zkit"); // JavaScript
```

The package extends `expect` chai assertion to recognize typed `zktype` objects for frictionless testing experience.

The plugin supports:

1. Basic witness `input` -> `output` testing.
2. Deep witness (signals) substitution testing.
3. Proof generation success/failure testing.
4. Circuit constraints number testing.

> [!NOTE]
> Please note that for witness testing purposes it is sufficient to compile circuits just with `zkit compile` task, without generating the keys.

### Example

The plugin extends the hardhat environment with the `zkit` object that allows typed circuits to be used in scripts and tests:

<table style="width:100%">
<tr>
<th>Circom circuit</th>
<th>Usage example</th>
</tr>

<tr>
<td>

```circom
// file location: ./circuits/multiplier.circom

pragma circom 2.0.0;

template Multiplier() {
   signal input in1;
   signal input in2;
   signal output out;

   out <== in1 * in2;
}

// main component to compile the circuit
component main = Multiplier();
```

</td>
<td>

```ts
// file location: ./test/multiplier.test.ts

import { zkit } from "hardhat"; // hardhat-zkit plugin
import { expect } from "chai"; // chai-zkit extension
import { Multiplier } from "@zkit"; // zktype circuit-object

describe("Multiplier", () => {
  it("should test the circuit", async () => {
    const circuit: Multiplier = await zkit.getCircuit("Multiplier");
    // or await zkit.getCircuit("circuits/multiplier.circom:Multiplier");

    // witness testing
    await expect(circuit)
        // provide a second parameter here to override witness values
        .with.witnessInputs({ in1: "3", in2: "7" })
        .to.have.witnessOutputs({ out: "21" });

    // proof testing
    const proof = await circuit.generateProof({ in1: "4", in2: "2" });

    await expect(circuit).to.verifyProof(proof);
  });
});
```

</td>
</tr>
</table>

To see the plugin in action, place the `Multiplier` circuit in the `circuits` directory and execute:

```bash
npx hardhat zkit make
```

This command will install the newest compatible Circom compiler, compile the provided circuit, download the necessary `ptau` file regarding the number of circuit's constraints and the proving system of choice, build the required `zkey` and `vkey` files, and generate TypeScript object wrappers to enable full typization of signals and ZK proofs.

Afterward, copy the provided script to the `test` directory and run the tests via `npx hardhat test`. You will see that all the tests are passing!

> [!TIP]
> Check out the [Medium blog post](https://medium.com/@Arvolear/introducing-hardhat-zkit-how-did-you-even-use-circom-before-a7b463a5575b) and [Solarity circom-lib](https://github.com/dl-solarity/circom-lib) to learn more.

### API reference

---

- **`async getCircuit(<circuitName|fullCircuitName>, <provingSystem?>) -> zkit`**

The method accepts the name of the `main` component of the circuit, optional proving system and returns the instantiated zkit object pointing to that circuit.

The method works regardless of how the circuit was compiled, however, if `zkit compile` task was used, the zkit methods that utilize proof generation or proof verification would throw an error by design.

In case there are conflicts between circuit file names and `main` component names, you should use the `fullCircuitName`, which has the following form: `circuitSourceName:circuitName`.

Where:

- `circuitSourceName` - Path to the circuit file from the project root.
- `circuitName` - Circuit `main` component name.

The optional `provingSystem` parameter should only be specified if multiple proving systems were set in the config. Otherwise, leave it as `undefined`.

> [!IMPORTANT]
> Please note that the method actually returns the [`zktype`](https://github.com/dl-solarity/zktype) typed zkit wrapper objects which enable full TypeScript typization of signals and proofs. Also, check out the [`zkit`](https://github.com/dl-solarity/zkit) documentation to understand zkit object capabilities and how to interact with circuits.

## Future work

- [x] ZK proofs generation with custom witness files (witness substitution).
- [ ] Per-circuit plugin configuration.
- [ ] `BLS12-381` on-chain ZK verifiers (EIP-2537).
- [ ] Support for `--prime bls12381` Circom (and Snarkjs) compilation flag.

## Known limitations

- Currently there is minimal support for `var` Circom variables. Some circuits may not work if you are using complex `var`-dependent expressions.
- Even though the plugin provides support of Circom `v2.2.2`, its newest feature `bus` is not supported.
- Due to current `wasm` memory limitations (address space is 32-bit), the plugin may fail to compile especially large circuits on some platforms.
