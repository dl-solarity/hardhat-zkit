![](https://github.com/dl-solarity/hardhat-zkit/assets/47551140/938bf108-194d-45de-a6f1-7280aaa0c8c1)

[![npm](https://img.shields.io/npm/v/@solarity/hardhat-zkit.svg)](https://www.npmjs.com/package/@solarity/hardhat-zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/dl-solarity/hardhat-zkit/actions/workflows/tests.yml/badge.svg?branch=master)](./.github/workflows/tests.yml)
[![hardhat](https://hardhat.org/buidler-plugin-badge.svg?1)](https://hardhat.org)

# Hardhat ZKit

**The ultimate environment for building with Circom.**

## What

This hardhat plugin is a zero-config, one-stop Circom development environment that abstracts away circuits management hassle and lets you focus on the important - code.

- Developer-oriented abstractions that simplify `r1cs`, `zkey`, `vkey`, and `witness` generation processes.
- Recompilation of only the modified circuits.
- Full TypeScript typization of signals and ZK proofs.
- Automatic downloads of phase-1 `ptau` files.
- Convenient phase-2 contributions to `zkey` files.
- Invisible `wasm`-based Circom compiler management.
- Simplified `node_modules` libraries resolution.
- Extensive development and testing API.
- Rich plugin configuration.
- And much more!

## Installation

```bash
npm install --save-dev @solarity/hardhat-zkit
```

And add the following line to your `hardhat.config`:

```js
require("@solarity/hardhat-zkit");
```

Or if you are using TypeScript:

```ts
import "@solarity/hardhat-zkit";
```

> [!TIP]
> There is no need to download the Circom compiler separately. The plugin works with the WASM-based version under the hood.

## Usage

The `hardhat-zkit` is a zero-config plugin, however, you may add the following to your `hardhat.config` file:

```ts
module.exports = {
  zkit: {
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      onlyFiles: [],
      skipFiles: [],
      c: false,
      json: false,
      sym: false,
    },
    setupSettings: {
      contributionSettings: {
        contributionTemplate: "groth16",
        contributions: 1,
      },
      onlyFiles: [],
      skipFiles: [],
      ptauDir: undefined,
      ptauDownload: true,
    },
    typesSettings: {
      typesArtifactsDir: "zkit/abi",
      typesDir: "generated-types/zkit",
    },
    verifiersDir: "contracts/verifiers",
    nativeCompiler: false,
    quiet: false,
  },
};
```

Where:

- `circuitsDir` - The directory where to look for the circuits.
- `compilationSettings`
  - `artifactsDir` - The directory where to save the circuits artifacts (r1cs, zkey, etc).
  - `onlyFiles` - The list of directories (or files) to be considered for the compilation.
  - `skipFiles` - The list of directories (or files) to be excluded from the compilation.
  - `c` - The flag to generate the c-based witness generator (generates wasm by default).
  - `json` - The flag to output the constraints in json format.
  - `sym` - The flag to output the constraint system in an annotated mode.
- `setupSettings`
  - `contributionSettings`
    - `contributionTemplate` - The option to indicate which proving system to use.
    - `contributions` - The number of phase-2 `zkey` contributions to make if `groth16` is chosen.
  - `onlyFiles` - The list of directories (or files) to be considered for the setup phase.
  - `skipFiles` - The list of directories (or files) to be excluded from the setup phase.
  - `ptauDir` - The directory where to look for the `ptau` files. `$HOME/.zkit/ptau/` by default.
  - `ptauDownload` - The flag to allow automatic download of required `ptau` files.
- `typesSettings`
  - `typesArtifactsDir` - The directory where to save the generated circuits ABI.
  - `typesDir` - The directory where to save the generated circuits wrappers.
- `verifiersDir` - The directory where to generate the Solidity verifiers.
- `nativeCompiler` - The flag indicating whether to use the natively installed compiler.
- `quiet` - The flag indicating whether to suppress the output.

### Typization

The plugin provides full TypeScript typization of Circom circuits leveraging [`zktype`](https://github.com/dl-solarity/zktype) library.

The following config may be added to `tsconfig.json` file to allow for a better user experience:

```json
{
  "compilerOptions": {
    "paths": {
      "@zkit": ["./generated-types/zkit"]
    }
  }
}
```

### Tasks

There are several hardhat tasks that the plugin provides:

- `zkit:compile` task that compiles or recompiles the modified circuits with the main component.
- `zkit:setup` task that generates or regenerates `zkey` and `vkey` for the previously compiled circuits.
- `zkit:make` task that executes both `zkit:compile` and `zkit:setup` for convenience.
- `zkit:verifiers` task that generates Solidity verifiers for all the previously setup circuits.
- `zkit:clean` task that cleans up the generated artifacts, types, etc.

To view the available options, run the help command:

```bash
npx hardhat help <zkit task name>
```

### Environment extensions

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

template Multiplier(){
   signal input in1;
   signal input in2;
   signal output out;

   out <== in1 * in2;
}

component main = Multiplier();
```

</td>
<td>

```ts
import { zkit } from "hardhat";
import { Multiplier } from "@zkit"; // typed circuit-object

async function main() {
  const circuit: Multiplier = await zkit.getCircuit("Multiplier");
  // OR await zkit.getCircuit("circuits/multiplier.circom:Multiplier");

  const proof = await circuit.generateProof({ in1: "4", in2: "2" });

  await circuit.verifyProof(proof); // success
}

main()
  .then()
  .catch((e) => console.log(e));
```

</td>
</tr>
</table>

To see the plugin in action, place the `Multiplier` circuit in the `circuits` directory and execute:

```bash
npx hardhat zkit:make
```

This command will compile the circuit leveraging `wasm`-based Circom compiler, download the necessary `ptau` file regarding the number of circuit constraints, build the required `zkey` and `vkey` files, and generate TypeScript object wrappers to enable full typization of signals and ZK proofs.

Afterwards you may proceed with the provided exemplary hardhat script.

### API reference

---

- **`getCircuit(<fullCircuitName|circuitName>) -> zkit`**

The method accepts the name of the `main` component of the circuit and returns the instantiated zkit object pointing to that circuit.

The method works regardless of how the circuit was compiled, however, if `zkit:compile` task was used, the zkit methods that utilize proof generation or proof verification would throw an error by design.

In case there are conflicts between circuit file names and `main` component names, you should use the `fullCircuitName`, which has the following form: `circuitSourceName:circuitName`.

Where:

- `circuitSourceName` - Path to the circuit file from the project root.
- `circuitName` - Circuit `main` component name.

> [!IMPORTANT]
> Please note that the method actually returns the [`zktype`](https://github.com/dl-solarity/zktype) typed zkit wrapper objects which enable full TypeScript typization of signals and proofs. Also check out the [`zkit`](https://github.com/dl-solarity/zkit) documentation to understand zkit object capabilities and how to interact with circuits.

## Known limitations

- Currently the Circom `2.1.8` is used to compile circuits.
- Temporarily, the only supported proving system is `groth16`.
