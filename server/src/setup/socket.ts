import { FastifyInstance } from "fastify";
import { Server } from "socket.io";

import { env } from "src/config";
import { HandlerMeta } from "src/socket/core";
import {
  createGlobalContext,
  enhanceSocket,
  preloadModules,
  type CustomOnConfig,
} from "src/socket/core";
import { socketGuard } from "src/guards/socket";

let preloadedModules: Awaited<ReturnType<typeof preloadModules>> = {};

(async () => {
  preloadedModules = await preloadModules();
})();

function isExpectCb<Ctx extends object>(
  meta: HandlerMeta<Ctx, boolean>
): meta is HandlerMeta<Ctx, true> {
  return meta.config?.expectCb === true;
}

export function initializeSocketServer(fastifyServer: FastifyInstance) {
  const io = new Server(fastifyServer.server, {
    cors: {
      origin: env.FRONTEND_URL ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(socketGuard);

  io.on("connection", async (_socket) => {
    const socket = enhanceSocket(_socket);
    const globalCtx = createGlobalContext({ socket, io });

    for (const module of Object.values(preloadedModules)) {
      const moduleCtx = module.createModuleContext
        ? module.createModuleContext({ ...globalCtx, socket })
        : { ...globalCtx };

      for (const eventMeta of module.moduleMetas) {
        const handlerConfig: CustomOnConfig<boolean> = {
          ...eventMeta.config,
          schema: eventMeta.config?.schema
            ? module.schemasCache.get(eventMeta.config.schema)
            : undefined,
        };

        if (isExpectCb(eventMeta)) {
          socket.customOn({
            event: eventMeta.event,
            config: handlerConfig as CustomOnConfig<true>,
            handler: (data, cb) => {
              return eventMeta.handler(moduleCtx, {
                payload: data,
                cb,
              });
            },
          });
        } else {
          socket.customOn({
            event: eventMeta.event,
            config: handlerConfig as CustomOnConfig<false>,
            handler: (data) => {
              return eventMeta.handler(moduleCtx, { payload: data });
            },
          });
        }
      }
    }
  });
}
