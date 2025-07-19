import path from "node:path";
import { defineModuleFactory } from "src/socket/core";
import { logger } from "src/lib/logger";
import fg from "fast-glob";

export async function preloadModules() {
  const modulesDir = path.resolve(__dirname, "..", "modules");
  const modules = await fg("**/*/index.{ts,js}", {
    cwd: modulesDir,
    onlyFiles: true,
    absolute: true,
  });

  const res: Record<string, ReturnType<typeof defineModuleFactory>> = {};

  for (const moduleEntry of modules) {
    const moduleName = path.basename(path.dirname(moduleEntry));

    try {
      const mod: { default: ReturnType<typeof defineModuleFactory> } =
        await import(moduleEntry);

      if (!mod?.default) {
        logger.error(`Module ${moduleName} has no default export`);
        continue;
      }

      const handlersPath = path.join(path.dirname(moduleEntry), "handlers");

      const handlerFiles = await fg("*.+(ts|js)", {
        cwd: handlersPath,
        onlyFiles: true,
      });

      for (const file of handlerFiles) {
        await import(path.join(handlersPath, file));
      }

      const moduleObj = mod.default;
      if (!moduleObj.moduleMetas) {
        logger.error(
          `Module ${moduleName} default export is missing required properties`
        );
        continue;
      }

      logger.info(`Loaded module: ${moduleName}`);

      res[moduleName] = moduleObj;
    } catch (err) {
      logger.error(
        `Error loading module ${moduleName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return res;
}
