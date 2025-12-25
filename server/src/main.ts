import fastify from "fastify";
import { env } from "./config";
import { setupFastifyModules } from "./setup/fastifyModules";
import { initializeSocketServer } from "./setup/socket";
import { createMediasoupWorkers } from "./lib/worker";
import { logger } from "./lib/logger";

async function startServer() {
  const port = +env.PORT;
  const host = env.HOST;

  const server = fastify({
    logger: {
      level: env.LOGGER_LEVEL,
    },
    https:
      env.CERT && env.KEY
        ? {
            cert: env.CERT,
            key: env.KEY,
          }
        : null,
  });

  await createMediasoupWorkers();
  setupFastifyModules(server);
  initializeSocketServer(server);

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      try {
        await server.close();
        server.log.error(`Closed application on ${signal}`);
        process.exit(0);
      } catch (error) {
        if (error instanceof Error) {
          server.log.error(
            `Error closing application on ${signal}: ${error.message}`
          );
        }
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
    logger.info(`mediasoup anounced ip ${env.ANNOUNCED_IP}`);
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
