import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { cloudinary } from "./cloudinary";
import streamifier from "streamifier";
import axios from "axios";
import { env } from "../config";
import { logger } from "./logger";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: env.GOOGLE_REDIRECT_URL,
      async mapProfileToUser(profile) {
        try {
          const res = await axios.get(profile.picture, {
            responseType: "arraybuffer",
          });

          let image =
            "https://i.pinimg.com/736x/27/5f/99/275f99923b080b18e7b474ed6155a17f.jpg";

          const cldUploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "avatars",
              public_id: profile.picture,
            },
            (err, response) => {
              if (err) {
                logger.error(err.message);
                return;
              }

              if (response?.secure_url) {
                image = response.secure_url;
              }
            }
          );

          streamifier
            .createReadStream(Buffer.from(res.data))
            .pipe(cldUploadStream);

          return {
            image,
          };
        } catch (error) {
          logger.error("Cloudinary upload failed:", error);
        }
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/callback/:id")) {
        if (ctx.context.newSession) {
          ctx.redirect(env.FRONTEND_URL);
        }
      }
    }),
  },
  trustedOrigins: [env.FRONTEND_URL],
});
