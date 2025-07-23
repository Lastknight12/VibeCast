import fastify from "fastify";
import { env } from "./config";
import { setupModules } from "./setup/fastifyModules";
import { initializeSocketServer } from "./setup/socket";
import { createMediasoupWorkers } from "./lib/worker";

async function startServer() {
  const port = Number(env.PORT) || 5001;
  const host = env.HOST || "localhost";

  const server = fastify({
    logger: {
      level: env.LOGGER_INFO,
    },
  });

  await createMediasoupWorkers();

  setupModules(server);
  initializeSocketServer(server);

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
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

startServer();
