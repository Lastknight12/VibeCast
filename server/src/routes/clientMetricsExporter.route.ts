import { FastifyInstance } from "fastify";
import { env } from "src/config";
import { logger } from "src/lib/logger";

export default function (fastify: FastifyInstance) {
  fastify.route({
    method: ["POST"],
    url: "/exportClientMetrics/:userId",
    handler: async (request, reply) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const { userId } = request.params;

      try {
        const res = await fetch(
          `${env.pushgateway}/metrics/job/webrtc/instance/${userId}`,
          {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: request.body as string,
          }
        );
        reply.status(res.status);
      } catch (err) {
        reply.status(500);
        logger.error(err);
      }
    },
  });
}
