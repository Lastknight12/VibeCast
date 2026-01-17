import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { cloudinary } from "./cloudinary";
import { env } from "../config";
import { logger } from "./logger";

// HACK: Yeah yeah bullshit, just lazy to figure out how to make image type of string, not null or undefined
export const defaultUserAvatar =
  "https://i.pinimg.com/736x/27/5f/99/275f99923b080b18e7b474ed6155a17f.jpg";

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
        let image = defaultUserAvatar;

        try {
          const result = await cloudinary.uploader.upload(profile.picture, {
            folder: "avatars",
            resource_type: "image",
          });

          if (result?.secure_url) {
            image = result.secure_url;
          }
        } catch (error) {
          logger.error(`Cloudinary upload failed: ${error}`);
        }

        return { image };
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
