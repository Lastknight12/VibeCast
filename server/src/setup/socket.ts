import { FastifyInstance } from "fastify";
import { Server } from "socket.io";

import { env } from "src/config";
import { TSchema } from "@sinclair/typebox";
import { SocketHandlerMeta } from "src/socket/core/types";
import { createGlobalContext } from "src/socket/core/globalContext";
import { socketGuard } from "src/guards/socket";
import { enhanceSocket, preloadModules } from "src/socket/core";
import { CustomOnEventConfig } from "src/socket/core/enhanceSocket";
import { TypeCheck } from "@sinclair/typebox/build/cjs/compiler";

let preloadedModules: Awaited<ReturnType<typeof preloadModules>> = {};

(async () => {
  preloadedModules = await preloadModules();
})();

function isExpectCb<Ctx extends object>(
  meta: SocketHandlerMeta<Ctx, TSchema, boolean>
): meta is SocketHandlerMeta<Ctx, TSchema, true> {
  return meta.config?.expectCb === true;
}

export function initializeSocketServer(fastifyServer: FastifyInstance) {
  const io = new Server(fastifyServer.server, {
    cors: {
      origin: env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(socketGuard);

  io.on("connection", async (_socket) => {
    const socket = enhanceSocket(_socket);
    const globalCtx = createGlobalContext(socket, io);

    for (const [_modName, module] of Object.entries(preloadedModules)) {
      const moduleCtx = module.createModuleContext
        ? module.createModuleContext({ ...globalCtx, socket })
        : { ...globalCtx };

      for (const eventMeta of module.moduleMetas) {
        const handlerConfig: CustomOnEventConfig<
          TypeCheck<TSchema>,
          boolean
        > = {
          ...eventMeta.config,
          schema: eventMeta.config?.schema
            ? module.schemasCache.get(eventMeta.config.schema)
            : undefined,
        };

        if (isExpectCb(eventMeta)) {
          socket.customOn({
            event: eventMeta.event,
            config: handlerConfig as CustomOnEventConfig<
              TypeCheck<TSchema>,
              true
            >, // HACK: isExceptCb narrow eventMeta.config as {exceptCb: true} so we get {payload, cb} in eventMeta.handler,
            //  but in customOn.config exceptCb is boolean, so in handler we recieve {payload, cb} or just {cb}
            handler: (data, cb) => {
              return eventMeta.handler(moduleCtx, {
                payload: data,
                cb,
              });
            },
          });
        } else {
          socket.customOn<false>({
            event: eventMeta.event,
            config: handlerConfig as CustomOnEventConfig<
              TypeCheck<TSchema>,
              false
            >,
            handler: (data) => {
              return eventMeta.handler(moduleCtx, { payload: data });
            },
          });
        }
      }
    }
  });
}
