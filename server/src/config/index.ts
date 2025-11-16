import { Type, Static } from "@sinclair/typebox";

import dotenv from "dotenv";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const pinoLoggerLevelSchema = Type.Union(
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
);

const envSchema = Type.Object({
  LOGGER_LEVEL: Type.Optional(pinoLoggerLevelSchema),

  pushgateway: Type.String(),

  CERT: Type.Optional(Type.String()),
  KEY: Type.Optional(Type.String()),

  DATABASE_URL: Type.Required(Type.String()),

  ANNOUNCED_IP: Type.Required(Type.String()),
  MIN_MEDIASOUP_PORT: Type.Optional(Type.String({ default: "40000" })),
  MAX_MEDIASOUP_PORT: Type.Optional(Type.String({ default: "40050" })),

  GOOGLE_CLIENT_ID: Type.Required(Type.String()),
  GOOGLE_CLIENT_SECRET: Type.Required(Type.String()),
  GOOGLE_REDIRECT_URL: Type.Required(Type.String()),

  CLOUDINARY_CLOUD_NAME: Type.Required(Type.String()),
  CLOUDINARY_API_KEY: Type.Required(Type.String()),
  CLOUDINARY_API_SECRET: Type.Required(Type.String()),

  FRONTEND_URL: Type.Required(Type.String()),

  HOST: Type.Optional(Type.String({ default: "localhost" })),
  PORT: Type.Optional(Type.String({ default: "5001" })),
});

type ForceRequired<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: Exclude<T[P], undefined>;
};

type EnvConfig = ForceRequired<
  Static<typeof envSchema>,
  "LOGGER_LEVEL" | "MIN_MEDIASOUP_PORT" | "MAX_MEDIASOUP_PORT" | "PORT" | "HOST"
>;

export const env: EnvConfig = {} as EnvConfig;

(function () {
  const { error } = dotenv.config();

  if (error) {
    throw new Error(`Failed to load .env file from path: ${error.message}`);
  }

  const validator = TypeCompiler.Compile(envSchema);
  const isValid = validator.Check(process.env);

  if (!isValid) {
    const error = validator.Errors(process.env).First();
    throw new Error(
      `Error loading env variable: ${error?.path} - ${error?.message}`
    );
  }

  for (const [key, val] of Object.entries(envSchema.properties)) {
    env[key] = process.env[key] ?? val.default;
  }
})();
