import { ActionType, HardhatRuntimeEnvironment } from "hardhat/types";

import { VerifierLanguageType, ProvingSystemType } from "@solarity/zkit";

import { ZKIT_SCOPE_NAME, TASK_CIRCUITS_MAKE } from "../task-names";

import { HardhatZKitError } from "../errors";
import { Reporter, createReporter } from "../reporter";
import { getNormalizedFullPath, getUniqueProvingSystems } from "../utils";

import { GenerateVerifiersTaskConfig } from "../types/tasks";
import { CircuitArtifact } from "../types/artifacts/circuit-artifacts";

export const generateVerifiers: ActionType<GenerateVerifiersTaskConfig> = async (
  taskArgs: GenerateVerifiersTaskConfig,
  env: HardhatRuntimeEnvironment,
) => {
  if (!taskArgs.noCompile) {
    await env.run(
      { scope: ZKIT_SCOPE_NAME, task: TASK_CIRCUITS_MAKE },
      {
        quiet: taskArgs.quiet,
        force: taskArgs.force,
      },
    );
  } else {
    createReporter(taskArgs.quiet || env.config.zkit.quiet);
  }

  const verifiersDirFullPath: string = getNormalizedFullPath(
    env.config.paths.root,
    taskArgs.verifiersDir ?? env.config.zkit.verifiersSettings.verifiersDir,
  );
  const verifiersType: VerifierLanguageType = taskArgs.verifiersType ?? env.config.zkit.verifiersSettings.verifiersType;
  const provingSystems: ProvingSystemType[] = getUniqueProvingSystems(
    env.config.zkit.setupSettings.contributionSettings.provingSystem,
  );

  Reporter!.verboseLog("index", "Verifiers generation dir - %s", [verifiersDirFullPath]);

  const allFullyQualifiedNames: string[] = await env.zkit.circuitArtifacts.getAllCircuitFullyQualifiedNames();
  let verifiersCount: number = 0;

  if (allFullyQualifiedNames.length > 0) {
    Reporter!.reportVerifiersGenerationHeader(verifiersType);

    const templateNamesCount: { [key: string]: number } = {};
    const circuitArtifactsInfo = await Promise.all(
      allFullyQualifiedNames.map(async (name: string) => {
        const circuitArtifact: CircuitArtifact = await env.zkit.circuitArtifacts.readCircuitArtifact(name);
        templateNamesCount[circuitArtifact.circuitTemplateName] =
          (templateNamesCount[circuitArtifact.circuitTemplateName] || 0) + 1;

        return { name, circuitArtifact };
      }),
    );

    for (const circuitArtifactInfo of circuitArtifactsInfo) {
      for (const provingSystem of provingSystems) {
        const spinnerId: string | null = Reporter!.reportVerifierGenerationStartWithSpinner(
          circuitArtifactInfo.circuitArtifact.circuitTemplateName,
          verifiersType,
          provingSystem,
        );

        let verifierNameSuffix: string = "";

        if (templateNamesCount[circuitArtifactInfo.circuitArtifact.circuitTemplateName] > 1) {
          Object.values(circuitArtifactInfo.circuitArtifact.baseCircuitInfo.parameters).forEach(
            (param, index, values) => {
              if (Array.isArray(param)) {
                throw new HardhatZKitError("Arrays in main component parameters not supported");
              }

              verifierNameSuffix += `_${param.toString()}${index === values.length - 1 ? "_" : ""}`;
            },
          );
        }

        const currentCircuit = await env.zkit.circuitZKitBuilder.getCircuitZKit(
          circuitArtifactInfo.name,
          provingSystems.length > 1 ? provingSystem : undefined,
          taskArgs.verifiersDir,
        );

        currentCircuit.createVerifier(verifiersType, verifierNameSuffix);

        Reporter!.reportVerifierGenerationResult(
          spinnerId,
          `${circuitArtifactInfo.circuitArtifact.circuitTemplateName}${verifierNameSuffix.slice(0, verifierNameSuffix.length - 1)}`,
          verifiersType,
          provingSystem,
        );

        verifiersCount++;
      }
    }

    Reporter!.reportVerifiersGenerationResult(verifiersType, verifiersCount);
  } else {
    Reporter!.reportNothingToGenerate();
  }
};
