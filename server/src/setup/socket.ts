import { FastifyInstance } from "fastify";
import { Server } from "socket.io";

import { env } from "src/config";
import { socketGuard } from "src/guards/socket";
import path from "path";
import { enhanceSocket, preloadModules } from "src/socket/core";
import { usersOnlineMetric } from "src/lib/prometheus/userMetrics";
import { leaveRoom } from "src/socket/modules/room/utils/index";
import { logger } from "src/lib/logger";

let handlers: Awaited<ReturnType<typeof preloadModules>>;

(async () => {
  handlers = await preloadModules({
    modulesDir: path.resolve(__dirname, "../socket/modules"),
    logHandlers: true,
  });
})();

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
    usersOnlineMetric.inc(1);

    socket.on("disconnect", () => {
      usersOnlineMetric.dec(1);
      if (socket.data.user.roomId) {
        leaveRoom(socket.data.user.id, socket.data.user.roomId, socket, io);
        // try {
        //   fetch(
        //     `${env.pushgateway}/metrics/job/webrtc/instance/${socket.data.user.id}`,
        //     {
        //       method: "DELETE",
        //     }
        //   );
        // } catch (error) {
        //   logger.error(error);
        // }
      }
    });

    handlers.forEach((handler) => handler(socket, io));
  });
}
