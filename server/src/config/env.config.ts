import path from "path";
import Joi from "joi";
import dotenv from "dotenv";

export default function loadConfig(): void {
  const envPath = path.join(__dirname, "..", "..", ".env");

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    throw new Error(
      `Failed to load .env file from path ${envPath}: ${result.error.message}`
    );
  }

  const schema = Joi.object({
    DATABASE_URL: Joi.string().required(),
    ANNOUNCED_IP: Joi.string().required(),

    GOOGLE_CLIENT_ID: Joi.string().required(),
    GOOGLE_CLIENT_SECRET: Joi.string().required(),

    CLOUDINARY_CLOUD_NAME: Joi.string().required(),
    CLOUDINARY_API_KEY: Joi.string().required(),
    CLOUDINARY_API_SECRET: Joi.string().required(),

    FRONTEND_URL: Joi.string().required(),
  }).unknown(true);

  const { error } = schema.validate(process.env);

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
}
