import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    session?: any;
  }
}
