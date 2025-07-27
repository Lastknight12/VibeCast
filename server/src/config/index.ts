import { Type, Static } from "@sinclair/typebox";

import dotenv from "dotenv";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const envSchema = Type.Object({
  LOGGER_INFO: Type.Union(
    [
      Type.Literal("debug"),
      Type.Literal("fatal"),
      Type.Literal("error"),
      Type.Literal("warn"),
      Type.Literal("info"),
      Type.Literal("trace"),
      Type.Literal("silent"),
    ],
    { default: "silent" }
  ),

  DATABASE_URL: Type.Required(Type.String()),
  ANNOUNCED_IP: Type.Required(Type.String()),

  GOOGLE_CLIENT_ID: Type.Required(Type.String()),
  GOOGLE_CLIENT_SECRET: Type.Required(Type.String()),
  GOOGLE_REDIRECT_URL: Type.Required(Type.String()),

  CLOUDINARY_CLOUD_NAME: Type.Required(Type.String()),
  CLOUDINARY_API_KEY: Type.Required(Type.String()),
  CLOUDINARY_API_SECRET: Type.Required(Type.String()),

  FRONTEND_URL: Type.Required(Type.String()),

  HOST: Type.Optional(Type.String({ default: "localhost" })),
  PORT: Type.Optional(Type.Number({ default: 5001 })),
});

type EnvConfig = Static<typeof envSchema>;

export const env: EnvConfig = {} as EnvConfig;

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
  const isValid = validator.Check(process.env);

  if (!isValid) {
    const error = validator.Errors(process.env).First();
    throw new Error(
      `Error loading env variable: ${error?.path} - ${error?.message}`
    );
  }

  for (const key of Object.keys(envSchema.properties ?? {})) {
    env[key] = process.env[key];
  }
})();
