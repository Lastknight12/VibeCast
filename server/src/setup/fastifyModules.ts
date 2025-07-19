import { FastifyInstance } from "fastify";
import formbody from "@fastify/formbody";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import authRouter from "../routes/auth.route";
import { env } from "../config";

export function setupModules(server: FastifyInstance) {
  server.register(fastifyCookie, {
    secret: "secret",
    hook: "onRequest",
  });
  server.register(formbody);
  server.register(helmet);
  server.register(cors, {
    origin: env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  });

  server.register(authRouter);

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.status(500).send({ error: "Something went wrong" });
  });
}
