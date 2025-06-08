import fastify from "fastify";
import loadConfig from "./config/env.config";

import { setupModules } from "./setup/fastifyModules";
import { setupSocket } from "./setup/socket";
import { createMediasoupWorkers } from "./lib/worker";

loadConfig();

const port = Number(process.env.API_PORT) || 5001;
const host = String(process.env.API_HOST ?? "localhost");

const startServer = async () => {
  const server = fastify({
    logger: false,
  });

  await createMediasoupWorkers();

  setupModules(server);
  setupSocket(server);

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      try {
        await server.close();
        server.log.error(`Closed application on ${signal}`);
        process.exit(0);
      } catch (err) {
        server.log.error(`Error closing application on ${signal}`, err);
        process.exit(1);
      }
    });
  });

  // Start server
  try {
    await server.listen({
      port,
      host,
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

startServer();
