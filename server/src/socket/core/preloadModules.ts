import path from "node:path";
import { defineModuleFactory } from "src/socket/core";
import { logger } from "src/lib/logger";
import fg from "fast-glob";

interface Opts {
  modulesDir: string;
  handlersDir?: string;
  logHandlers?: boolean;
}

export async function preloadModules(opts: Opts) {
  const modulesDir = opts.modulesDir;
  const modules = await fg("*/index.{ts,js}", {
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
        logger.error(`Module '${moduleName}' has no default export`);
        continue;
      }

      const handlersDir =
        opts.handlersDir ?? path.join(path.dirname(moduleEntry), "handlers");
      const moduleHandlers = await fg("*.+(ts|js)", {
        cwd: handlersDir,
        onlyFiles: true,
        absolute: true,
      });

      for (const handler of moduleHandlers) {
        await import(handler);
      }

      const moduleObj = mod.default;
      if (!moduleObj.moduleMetas) {
        logger.error(
          `Module '${moduleName}' default export is missing required properties`
        );
        continue;
      }

      if (opts.logHandlers) {
        logger.info(`Loading module: ${moduleName}`);
        for (const meta of moduleObj.moduleMetas) {
          logger.info(`    ${meta.event}`);
        }
      }

      logger.info(`Loaded module: ${moduleName}`);

      res[moduleName] = moduleObj;
    } catch (err) {
      logger.error(
        `Error loading module '${moduleName}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return res;
}
