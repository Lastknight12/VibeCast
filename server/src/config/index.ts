import { Type, Static } from "@sinclair/typebox";

import dotenv from "dotenv";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { logger } from "src/lib/logger";

const envSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  ANNOUNCED_IP: Type.String({ minLength: 1 }),

  GOOGLE_CLIENT_ID: Type.String({ minLength: 1 }),
  GOOGLE_CLIENT_SECRET: Type.String({ minLength: 1 }),

  CLOUDINARY_CLOUD_NAME: Type.String({ minLength: 1 }),
  CLOUDINARY_API_KEY: Type.String({ minLength: 1 }),
  CLOUDINARY_API_SECRET: Type.String({ minLength: 1 }),

  FRONTEND_URL: Type.String({ minLength: 1 }),

  API_HOST: Type.Optional(Type.String()),
  API_PORT: Type.Optional(Type.String()),
});

export const env: Static<typeof envSchema> = {} as Static<typeof envSchema>;

(function () {
  if (process.env.NODE_ENV !== "production") {
    const result = dotenv.config();

    if (result.error) {
      throw new Error(
        `Failed to load .env file from path: ${result.error.message}`
      );
    }
  }

  const validator = TypeCompiler.Compile(envSchema);
  const valid = validator.Check(process.env);

  if (!valid) {
    const error = validator.Errors(process.env).First();
    logger.error("Error validation env config");
    logger.error(`${error?.path} - ${error?.message}`);
    process.exit(1);
  }

  for (const key of Object.keys(envSchema.properties ?? {})) {
    env[key] = process.env[key];
  }
})();
