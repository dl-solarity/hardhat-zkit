![](https://github.com/dl-solarity/hardhat-zkit/assets/47551140/938bf108-194d-45de-a6f1-7280aaa0c8c1)

[![npm](https://img.shields.io/npm/v/@solarity/hardhat-zkit.svg)](https://www.npmjs.com/package/@solarity/hardhat-zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/dl-solarity/hardhat-zkit/actions/workflows/tests.yml/badge.svg?branch=master)](./.github/workflows/tests.yml)
[![hardhat](https://hardhat.org/buidler-plugin-badge.svg?1)](https://hardhat.org)

# Hardhat ZKit

**The ultimate environment for building with Circom.**

## What

This hardhat plugin is a zero-config, one-stop Circom development environment that abstracts away circuits management hassle and let's you focus on the important - code.

- Developer-oriented abstractions that simplify `r1cs`, `zkey`, `vkey`, and `witness` generation processes.
- Recompilation of only the modified circuits.
- Automatic downloads of phase-1 `ptau` files.
- Convenient phase-2 contributions to `zkey` files.
- Invisible `wasm`-based Circom compiler management.
- Zero platform-specific dependencies: everything is in TypeScript.
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

The `hardhat-zkit` is a zero-config plugin, however you may add the following to your `hardhat.config` file:

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
      contributionTemplate: "groth16",
      contributions: 1,
    },
    quiet: false,
    verifiersDir: "contracts/verifiers",
    ptauDir: undefined,
    ptauDownload: true,
  },
};
```

Where:

- `circuitsDir` - The directory where to look for the circuits.
- `compilationSettings`
  - `artifactsDir` - The directory where to save the circuits artifacts (r1cs, zkey, etc).
  - `onlyFiles` - The list of directories (or files) to be considered for the compilation.
  - `skipFiles` - The list of directories (or files) to be skipped for the compilation.
  - `c` - The flag to generate the c-based witness generator (generates wasm by default).
  - `json` - The flag to output the constraints in json format.
  - `sym` - The flag to output the constraint system in an annotated mode.
  - `contributionTemplate` - The option to indicate which proving system to use.
  - `contributions` - The number of phase-2 `zkey` contributions to make if `groth16` is chosen.
- `quiet` - The flag indicating whether to suppress the output.
- `verifiersDir` - The directory where to generate the Solidity verifiers.
- `ptauDir` - The directory where to look for the `ptau` files. `$HOME/.zkit/ptau/` by default.
- `ptauDownload` - The flag to allow automatic download of required `ptau` files.

### Tasks

There are several hardhat tasks that the plugin provides:

- `zkit:compile` task that compiles or recompiles the modified circuits that have the main component.
- `zkit:verifiers` task that generates Solidity verifiers for all the previously compiled circuits.

To view the available options, run the help command:

```bash
npx hardhat help zkit:compile
npx hardhat help zkit:verifiers
```

### Environment extensions

The plugin extends the hardhat environment with the `zkit` object that allows circuits to be used in scripts and tests:

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

async function main() {
  const circuit = await zkit.getCircuit("Multiplier");
  // OR const circuit = await zkit.getCircuit("circuits/multiplier.circom:Multiplier");

  const proof = await circuit.generateProof({ in1: "4", in2: "2" });

  await circuit.verifyProof(proof); // success
  await circuit.createVerifier();
}

main()
  .then()
  .catch((e) => console.log(e));
```

</td>
</tr>
</table>

### API reference

---

- **`getCircuit(<fullCircuitName|circuitName>) -> zkit`**

The method accepts the name of the `main` component of the circuit, the object of which should be created. Returns the instanciated zkit object.

In case there are conflicts between circuit file names and `main` component names, you should use the `fullCircuitName`, which has the following form: `circuitSourceName:circuitName`.

Where:

- `circuitSourceName` - Path to the circuit file from the project root.
- `circuitName` - Circuit `main` component name.

> [!IMPORTANT] 
> Check out the [`zkit`](https://github.com/dl-solarity/zkit) documentation to understand zkit objects capabilities.

## Known limitations

- Currently the Circom `2.1.8` is used for the compilation of circuits.
- Temporarily, the only supported proving system is `groth16`.
- Full TypeScript typization of circuits is in progress.
