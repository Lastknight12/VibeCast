import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: ["GET", "POST"],
    url: "/ping",
    handler(_request, reply) {
      reply.status(200).send("OK");
    },
  });
}
