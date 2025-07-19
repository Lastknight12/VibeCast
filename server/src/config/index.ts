import path from "path";
import Ajv, { JSONSchemaType } from "ajv";
import dotenv from "dotenv";

interface EnvData {
  DATABASE_URL: string;
  ANNOUNCED_IP: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;

  FRONTEND_URL: string;

  API_HOST: string | undefined;
  API_PORT: string | undefined;
}

const ajv = new Ajv();

export const env: EnvData = {} as EnvData;

(function () {
  const envPath = path.join(__dirname, "..", "..", ".env");

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    throw new Error(
      `Failed to load .env file from path ${envPath}: ${result.error.message}`
    );
  }

  const envSchema: JSONSchemaType<EnvData> = {
    type: "object",
    properties: {
      DATABASE_URL: { type: "string", minLength: 1 },
      ANNOUNCED_IP: { type: "string", minLength: 1 },

      GOOGLE_CLIENT_ID: { type: "string", minLength: 1 },
      GOOGLE_CLIENT_SECRET: { type: "string", minLength: 1 },

      CLOUDINARY_CLOUD_NAME: { type: "string", minLength: 1 },
      CLOUDINARY_API_KEY: { type: "string", minLength: 1 },
      CLOUDINARY_API_SECRET: { type: "string", minLength: 1 },

      FRONTEND_URL: { type: "string", minLength: 1 },

      API_HOST: { type: "string", nullable: true },
      API_PORT: { type: "string", nullable: true },
    },
    required: [
      "DATABASE_URL",
      "ANNOUNCED_IP",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "FRONTEND_URL",
    ],
  };

  const validator = ajv.compile(envSchema);
  const valid = validator(process.env);

  if (!valid) {
    throw new Error(
      `Config validation error: ${validator.errors?.[0].message}`
    );
  }

  for (const key of Object.keys(envSchema.properties ?? {})) {
    env[key] = process.env[key];
  }
})();
