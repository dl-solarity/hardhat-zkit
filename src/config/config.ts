import { isAbsolute } from "path";

import type { ConfigurationVariableResolver, HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import { ConfigHooks } from "hardhat/types/hooks";

import { HardhatUserConfigValidationError, validateUserConfigZodType } from "@nomicfoundation/hardhat-zod-utils";
import { z } from "zod";

import { ZKitConfig, ZKitUserConfig } from "../types/zkit-config.js";
import { ProvingSystemType, VerifierLanguageType } from "@solarity/zkit";

export default async (): Promise<Partial<ConfigHooks>> => ({
  validateUserConfig,
  resolveUserConfig,
});

const userConfigType = z.object({
  zkit: z
    .object({
      compilerVersion: z.string().optional(),
      circuitsDir: z.string().optional(),
      compilationSettings: z
        .object({
          artifactsDir: z.string().optional(),

          onlyFiles: z.array(z.string().refine((p) => !isAbsolute(p), "Expected a relative path")).optional(),
          skipFiles: z.array(z.string().refine((p) => !isAbsolute(p), "Expected a relative path")).optional(),

          c: z.boolean().optional(),
          json: z.boolean().optional(),
          optimization: z.string().optional(),
        })
        .optional(),
      setupSettings: z
        .object({
          contributionSettings: z
            .object({
              provingSystem: z.array(z.string().optional()).optional() || z.string().optional(),
              contributions: z.number().optional(),
            })
            .optional(),
          ptauDir: z.string().optional(),
          ptauDownload: z.boolean().optional(),
          onlyFiles: z.array(z.string().refine((p) => !isAbsolute(p), "Expected a relative path")).optional(),
          skipFiles: z.array(z.string().refine((p) => !isAbsolute(p), "Expected a relative path")).optional(),
        })
        .optional(),
      verifiersSettings: z
        .object({
          verifiersDir: z.string().optional(),
          verifiersType: z.string().optional(),
        })
        .optional(),
      typesDir: z.string().optional(),
      typesWitnessLimit: z.number().optional(),
      quiet: z.boolean().optional(),
    })
    .optional(),
});

export async function validateUserConfig(userConfig: HardhatUserConfig): Promise<HardhatUserConfigValidationError[]> {
  return validateUserConfigZodType(userConfig, userConfigType);
}

export async function resolveUserConfig(
  userConfig: HardhatUserConfig,
  resolveConfigurationVariable: ConfigurationVariableResolver,
  next: (
    nextUserConfig: HardhatUserConfig,
    nextResolveConfigurationVariable: ConfigurationVariableResolver,
  ) => Promise<HardhatConfig>,
): Promise<HardhatConfig> {
  const resolvedConfig = await next(userConfig, resolveConfigurationVariable);

  const zkit = await resolveZkitConfig(userConfig.zkit, resolveConfigurationVariable);

  return {
    ...resolvedConfig,
    zkit,
  };
}

async function resolveZkitConfig(
  zkitConfig: ZKitUserConfig | undefined,
  resolveConfigurationVariable: ConfigurationVariableResolver,
): Promise<ZKitConfig> {
  const defaultConfig: ZKitConfig = {
    compilerVersion: undefined,
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
        provingSystem: "groth16",
        contributions: 2,
      },
      ptauDir: undefined,
      ptauDownload: true,
      onlyFiles: [],
      skipFiles: [],
    },
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
      verifiersType: "sol",
    },
    typesDir: "generated-types/zkit",
    typesWitnessLimit: 50000,
    quiet: false,
  };

  if (zkitConfig === undefined) {
    return defaultConfig;
  }

  const resolved: ZKitConfig = { ...defaultConfig };

  if (typeof zkitConfig.compilerVersion === "string") {
    resolved.compilerVersion = await resolveConfigurationVariable(zkitConfig.compilerVersion).get();
  }

  if (typeof zkitConfig.circuitsDir === "string") {
    resolved.circuitsDir = await resolveConfigurationVariable(zkitConfig.circuitsDir).get();
  }

  if (zkitConfig.compilationSettings !== undefined) {
    if (typeof zkitConfig.compilationSettings.artifactsDir === "string") {
      resolved.compilationSettings.artifactsDir = await resolveConfigurationVariable(
        zkitConfig.compilationSettings.artifactsDir,
      ).get();
    }

    if (Array.isArray(zkitConfig.compilationSettings.onlyFiles)) {
      resolved.compilationSettings.onlyFiles = await Promise.all(
        zkitConfig.compilationSettings.onlyFiles.map((p: string | undefined) => resolveConfigurationVariable(p!).get()),
      );
    }

    if (Array.isArray(zkitConfig.compilationSettings.skipFiles)) {
      resolved.compilationSettings.skipFiles = await Promise.all(
        zkitConfig.compilationSettings.skipFiles.map((p: string | undefined) => resolveConfigurationVariable(p!).get()),
      );
    }

    if (typeof zkitConfig.compilationSettings.c === "boolean") {
      resolved.compilationSettings.c = zkitConfig.compilationSettings.c;
    }

    if (typeof zkitConfig.compilationSettings.json === "boolean") {
      resolved.compilationSettings.json = zkitConfig.compilationSettings.json;
    }

    if (
      zkitConfig.compilationSettings.optimization == "O0" ||
      zkitConfig.compilationSettings.optimization == "O1" ||
      zkitConfig.compilationSettings.optimization == "O2"
    ) {
      resolved.compilationSettings.optimization = zkitConfig.compilationSettings
        .optimization as ZKitConfig["compilationSettings"]["optimization"];
    }
  }

  if (zkitConfig.setupSettings !== undefined) {
    if (zkitConfig.setupSettings.contributionSettings !== undefined) {
      console.log(zkitConfig.setupSettings.contributionSettings.provingSystem);

      if (typeof zkitConfig.setupSettings.contributionSettings.provingSystem === "string") {
        resolved.setupSettings.contributionSettings.provingSystem = zkitConfig.setupSettings.contributionSettings
          .provingSystem as ProvingSystemType;
      }

      if (Array.isArray(zkitConfig.setupSettings.contributionSettings.provingSystem)) {
        resolved.setupSettings.contributionSettings.provingSystem = zkitConfig.setupSettings.contributionSettings
          .provingSystem as ProvingSystemType[];
      }

      if (typeof zkitConfig.setupSettings.contributionSettings.contributions === "number") {
        resolved.setupSettings.contributionSettings.contributions =
          zkitConfig.setupSettings.contributionSettings.contributions;
      }
    }
    if (typeof zkitConfig.setupSettings.ptauDir === "string") {
      resolved.setupSettings.ptauDir = await resolveConfigurationVariable(zkitConfig.setupSettings.ptauDir).get();
    }

    if (typeof zkitConfig.setupSettings.ptauDownload === "boolean") {
      resolved.setupSettings.ptauDownload = zkitConfig.setupSettings.ptauDownload;
    }

    if (Array.isArray(zkitConfig.setupSettings.onlyFiles)) {
      resolved.setupSettings.onlyFiles = await Promise.all(
        zkitConfig.setupSettings.onlyFiles.map((p: string | undefined) => resolveConfigurationVariable(p!).get()),
      );
    }

    if (Array.isArray(zkitConfig.setupSettings.skipFiles)) {
      resolved.setupSettings.skipFiles = await Promise.all(
        zkitConfig.setupSettings.skipFiles.map((p: string | undefined) => resolveConfigurationVariable(p!).get()),
      );
    }
  }

  if (zkitConfig.verifiersSettings !== undefined) {
    if (typeof zkitConfig.verifiersSettings.verifiersDir === "string") {
      resolved.verifiersSettings.verifiersDir = await resolveConfigurationVariable(
        zkitConfig.verifiersSettings.verifiersDir,
      ).get();
    }

    if (typeof zkitConfig.verifiersSettings.verifiersType === "string") {
      resolved.verifiersSettings.verifiersType = (await resolveConfigurationVariable(
        zkitConfig.verifiersSettings.verifiersType,
      ).get()) as VerifierLanguageType;
    }
  }

  if (typeof zkitConfig.typesDir === "string") {
    resolved.typesDir = await resolveConfigurationVariable(zkitConfig.typesDir).get();
  }
  if (typeof zkitConfig.typesWitnessLimit === "number") {
    resolved.typesWitnessLimit = zkitConfig.typesWitnessLimit;
  }
  if (typeof zkitConfig.quiet === "boolean") {
    resolved.quiet = zkitConfig.quiet;
  }

  return resolved;
}
