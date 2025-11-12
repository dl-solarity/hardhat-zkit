import { CircomValueType } from "@tawny0wl/test-circom-parser";

import { VerifierLanguageType, ProvingSystemType } from "@solarity/zkit";

import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { NewTaskActionFunction } from "hardhat/types/tasks";

import { TASK_CIRCUITS_MAKE, ZKIT_SCOPE_NAME } from "../task-names.js";

import { Reporter, createReporter } from "../reporter/index.js";
import { getNormalizedFullPath, getUniqueProvingSystems } from "../utils/index.js";
import { GenerateVerifiersTaskConfig, CircuitArtifactInfo } from "../types/tasks/index.js";
import { CircuitArtifact } from "../types/artifacts/circuit-artifacts.js";
import { HardhatZKitError } from "../../src/errors.js";

const generateVerifiersAction: NewTaskActionFunction<GenerateVerifiersTaskConfig> = async (taskArgs, hre) => {
  if (!taskArgs.noCompile) {
    await hre.tasks
      .getTask([ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE])
      .run({ quiet: taskArgs.quiet, force: taskArgs.force });
  } else {
    createReporter(taskArgs.quiet || hre.config.zkit.quiet);
  }

  const verifiersDirFullPath: string = getNormalizedFullPath(
    hre.config.paths.root,
    taskArgs.verifiersDir ?? hre.config.zkit.verifiersSettings.verifiersDir,
  );

  const _verifiersType = taskArgs.verifiersType ?? hre.config.zkit.verifiersSettings.verifiersType;
  if (!(_verifiersType == "sol" || _verifiersType == "vy")) {
    throw new HardhatZKitError(`Invalid verifier type: ${_verifiersType}`);
  } // todo

  const verifiersType: VerifierLanguageType = _verifiersType;
  const provingSystems: ProvingSystemType[] = getUniqueProvingSystems(
    hre.config.zkit.setupSettings.contributionSettings.provingSystem,
  );

  Reporter!.verboseLog("index", "Verifiers generation dir - %s", [verifiersDirFullPath]);

  const allFullyQualifiedNames: string[] = await hre.zkit.circuitArtifacts.getAllCircuitFullyQualifiedNames();
  let verifiersCount: number = 0;

  if (allFullyQualifiedNames.length > 0) {
    Reporter!.reportVerifiersGenerationHeader(verifiersType);

    const [templateNamesCount, circuitArtifactsInfo] = await getAndCountArtifacts(hre, allFullyQualifiedNames);

    for (const circuitArtifactInfo of circuitArtifactsInfo) {
      for (const provingSystem of provingSystems) {
        await generateVerifierForProvingSystem(
          taskArgs,
          hre,
          provingSystems.length,
          circuitArtifactInfo,
          provingSystem,
          verifiersType,
          templateNamesCount,
        );

        verifiersCount++;
      }
    }

    Reporter!.reportVerifiersGenerationResult(verifiersType, verifiersCount);
  } else {
    Reporter!.reportNothingToGenerate();
  }
};

async function getAndCountArtifacts(
  hre: HardhatRuntimeEnvironment,
  allFullyQualifiedNames: string[],
): Promise<[{ [key: string]: number }, CircuitArtifactInfo[]]> {
  const templateNamesCount: { [key: string]: number } = {};
  const circuitArtifactsInfo = await Promise.all(
    allFullyQualifiedNames.map(async (name: string) => {
      const circuitArtifact: CircuitArtifact = await hre.zkit.circuitArtifacts.readCircuitArtifact(name);

      // Count the number of uses of templates to determine whether a verifier file
      // will need a suffix in case of non-uniqueness
      templateNamesCount[circuitArtifact.circuitTemplateName] =
        (templateNamesCount[circuitArtifact.circuitTemplateName] || 0) + 1;

      return { name, circuitArtifact };
    }),
  );

  return [templateNamesCount, circuitArtifactsInfo];
}

async function generateVerifierForProvingSystem(
  taskArgs: GenerateVerifiersTaskConfig,
  hre: HardhatRuntimeEnvironment,
  totalProvingSystems: number,
  circuitArtifactInfo: CircuitArtifactInfo,
  provingSystem: ProvingSystemType,
  verifiersType: VerifierLanguageType,
  templateNamesCount: { [key: string]: number },
) {
  const spinnerId: string | null = Reporter!.reportVerifierGenerationStartWithSpinner(
    circuitArtifactInfo.circuitArtifact.circuitTemplateName,
    verifiersType,
    provingSystem,
  );

  let verifierNameSuffix: string = "";

  if (templateNamesCount[circuitArtifactInfo.circuitArtifact.circuitTemplateName] > 1) {
    const flattenParametersArr: bigint[] = flattenParameters(
      circuitArtifactInfo.circuitArtifact.baseCircuitInfo.parameters,
    );

    flattenParametersArr.forEach((param: bigint, index: number) => {
      verifierNameSuffix += `_${param.toString()}${index === flattenParametersArr.length - 1 ? "_" : ""}`;
    });
  }

  const currentCircuit = await hre.zkit.circuitZKitBuilder.getCircuitZKit(
    circuitArtifactInfo.name,
    totalProvingSystems > 1 ? provingSystem : undefined,
    taskArgs.verifiersDir,
  );

  currentCircuit.createVerifier(verifiersType, verifierNameSuffix);

  Reporter!.reportVerifierGenerationResult(
    spinnerId,
    `${circuitArtifactInfo.circuitArtifact.circuitTemplateName}${verifierNameSuffix.slice(0, verifierNameSuffix.length - 1)}`,
    verifiersType,
    provingSystem,
  );
}

function flattenParameters(parameters: Record<string, CircomValueType>): bigint[] {
  const flattenParametersArr: bigint[] = [];

  for (const parameterKey of Object.keys(parameters)) {
    flattenParametersArr.push(...flattenParameter(parameters[parameterKey]));
  }

  return flattenParametersArr;
}

function flattenParameter(parameter: CircomValueType): bigint[] {
  const flatValue = Array.isArray(parameter)
    ? parameter.flatMap((parameter) => flattenParameter(parameter))
    : parameter;

  return Array.isArray(flatValue) ? flatValue : [flatValue];
}

export default generateVerifiersAction;
