import path from "path";
import { logger } from "src/lib/logger";
import fg from "fast-glob";
import { CustomSocket } from "src/socket/core";
import { Server } from "socket.io";

interface Opts {
  modulesDir: string;
  handlersDir?: string;
  logHandlers?: boolean;
  handlerRegexp?: string;
}

export async function preloadModules(opts: Opts) {
  const start = performance.now();

  const modulesDir = opts.modulesDir;
  const modules = await fg("*", {
    cwd: modulesDir,
    onlyDirectories: true,
    absolute: true,
  });
  const handlers: ((socket: CustomSocket, io: Server) => void)[] = [];

  for (const modulePath of modules) {
    const moduleName = path.basename(modulePath);
    try {
      const handlersDir = opts.handlersDir ?? path.join(modulePath, "handlers");
      const handlerRegexp = opts.handlerRegexp ?? "*.+(ts|js)";
      const moduleHandlers = await fg(handlerRegexp, {
        cwd: handlersDir,
        onlyFiles: true,
        absolute: true,
      });

      logger.info(`Loading ${moduleName} module...`);

      for (const handler of moduleHandlers) {
        const fileName = path.parse(handler).name;
        const data = await import(handler);
        handlers.push(data.default);
        if (opts.logHandlers) {
          logger.info(`    ${fileName}`);
        }
      }
    } catch (err) {
      logger.error(
        `Error loading module '${moduleName}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const end = performance.now();
  const duration = (end - start).toFixed(2);

  logger.info(`Preload complete in ${duration} ms`);
  return handlers;
}
