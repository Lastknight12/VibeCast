import { FastifyInstance } from "fastify";
import fastifyAutoload from "@fastify/autoload";
import path from "path";

export function setupFastifyModules(server: FastifyInstance) {
  server.register(fastifyAutoload, {
    dir: path.join(__dirname, "../plugins/external"),
  });

  server.register(fastifyAutoload, {
    dir: path.join(__dirname, "../routes"),
  });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.status(500).send({ error: "Something went wrong" });
  });
}
