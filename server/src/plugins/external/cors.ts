import cors, { FastifyCorsOptions } from "@fastify/cors";
import { env } from "src/config";

export const autoConfig: FastifyCorsOptions = {
  origin: env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

export default cors;
