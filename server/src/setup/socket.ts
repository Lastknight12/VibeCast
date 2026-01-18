import { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { env } from "src/config";
import { socketGuard } from "src/guards/socket";
import path from "path";
import { enhanceSocket, preloadModules } from "src/socket/core";
import { leaveRoom } from "src/socket/modules/room/utils";
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

    socket.on("disconnect", async () => {
      if (socket.data.user?.roomId) {
        try {
          await leaveRoom(io, {
            id: socket.data.user.id,
            roomId: socket.data.user.roomId,
            socket,
          });
        } catch (error) {
          logger.error(error);
        }
      }
    });

    handlers.forEach((handler) => handler(socket, io));
  });
}
