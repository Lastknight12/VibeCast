import { FastifyInstance } from "fastify";
import { collectWorkersMetrics } from "src/lib/prometheus/workersMetric";
import register from "src/lib/prometheus/registry";
import { workers } from "src/lib/worker";
import { collectUserMetrics } from "src/lib/prometheus/userMetrics";
import { rooms } from "src/state/roomState";

export default function (fastify: FastifyInstance) {
  fastify.route({
    method: ["GET"],
    url: "/metrics",
    handler: async (_req, reply) => {
      await collectWorkersMetrics(workers);
      collectUserMetrics(rooms);

      reply.header("Content-Type", register?.contentType);
      reply.send(await register?.metrics());
    },
  });
}
