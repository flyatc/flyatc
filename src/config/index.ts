import { exists } from "deno/fs";
import { basename, dirname, extname } from "deno/path";
import { parse } from "deno/yaml";
import { Eta } from "eta";
import * as fn from "./eta.ts";
import { spec } from "./spec.ts";

export const renderConfig = async (filepath: string) => {
  if (!(await exists(filepath))) {
    throw new Error(`Cannot find FlyATC configuration at ${filepath}`);
  }
  const eta = new Eta({
    views: dirname(filepath),
    tags: ["{{", "}}"],
    useWith: true,
    autoTrim: false,
    defaultExtension: ".flyatc",
  });
  return eta.renderAsync(basename(filepath, extname(filepath)), fn);
};

export const validateConfig = async (filepath: string) => {
  const yamlConfig = await renderConfig(filepath);
  const jsonConfig = parse(yamlConfig);
  const validatedConfig = await spec.safeParseAsync(jsonConfig);

  if (validatedConfig.success) {
    return validatedConfig.data;
  } else {
    // TODO: error formatting
    throw new Error(JSON.stringify(validatedConfig.error, null, 2));
  }
};
