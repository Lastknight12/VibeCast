import { Type, Static } from "@sinclair/typebox";

import dotenv from "dotenv";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const envSchema = Type.Object({
  LOGGER_INFO: Type.Optional(Type.String({ minLength: 1 })),

  DATABASE_URL: Type.String({ minLength: 1 }),
  ANNOUNCED_IP: Type.String({ minLength: 1 }),

  GOOGLE_CLIENT_ID: Type.String({ minLength: 1 }),
  GOOGLE_CLIENT_SECRET: Type.String({ minLength: 1 }),
  GOOGLE_REDIRECT_URL: Type.String({ minLength: 1 }),

  CLOUDINARY_CLOUD_NAME: Type.String({ minLength: 1 }),
  CLOUDINARY_API_KEY: Type.String({ minLength: 1 }),
  CLOUDINARY_API_SECRET: Type.String({ minLength: 1 }),

  FRONTEND_URL: Type.String({ minLength: 1 }),

  HOST: Type.Optional(Type.String()),
  PORT: Type.Optional(Type.String()),
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
    throw new Error(
      `Error loading env variable: ${error?.path} - ${error?.message}`
    );
  }

  for (const key of Object.keys(envSchema.properties ?? {})) {
    env[key] = process.env[key];
  }
})();
