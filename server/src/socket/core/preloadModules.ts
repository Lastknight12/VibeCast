import fs from "node:fs";
import path from "node:path";
import { defineModuleFactory } from "src/socket/core";
import { logger } from "src/lib/logger";

export async function preloadModules() {
  const modulesDir = path.resolve(__dirname, "..", "modules");
  const modules = fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const res: Record<string, ReturnType<typeof defineModuleFactory>> = {};

  for (const moduleName of modules) {
    const moduleEntryPath = path.join(modulesDir, moduleName, "index.ts");
    if (!fs.existsSync(moduleEntryPath)) {
      logger.warn(`Module entry not found: ${moduleEntryPath}`);
      continue;
    }

    try {
      const mod: { default: ReturnType<typeof defineModuleFactory> } =
        await import(moduleEntryPath);

      if (!mod?.default) {
        logger.warn(`Module ${moduleName} has no default export`);
        continue;
      }

      const handlersPath = path.join(modulesDir, moduleName, "handlers");
      if (fs.existsSync(handlersPath)) {
        const handlerFiles = fs
          .readdirSync(handlersPath)
          .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

        for (const file of handlerFiles) {
          await import(path.join(handlersPath, file));
        }
      }

      const moduleObj = mod.default;
      if (!moduleObj.moduleMetas) {
        logger.warn(
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
