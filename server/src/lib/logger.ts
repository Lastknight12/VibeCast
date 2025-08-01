import pino from "pino";
import { env } from "src/config";

export const logger = pino({
  level: env.LOGGER_LEVEL ?? "silent",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss",
    },
  },
});
