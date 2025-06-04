import { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { setupSocketRoutes } from "../socket";
import { socketGuard } from "../guards/socket";

export function setupSocket(fastifyServer: FastifyInstance) {
  const io = new Server(fastifyServer.server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(socketGuard);

  io.on("connection", async (socket) => {
    setupSocketRoutes(socket);
  });
}
