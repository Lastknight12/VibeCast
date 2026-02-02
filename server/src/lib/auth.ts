import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { cloudinary } from "./cloudinary";
import { env } from "../config";

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
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          let image =
            "https://i.pinimg.com/736x/27/5f/99/275f99923b080b18e7b474ed6155a17f.jpg";

          if (user.image) {
            try {
              const result = await cloudinary.uploader.upload(user.image, {
                folder: "avatars",
                resource_type: "image",
              });

              if (result?.secure_url) {
                image = result.secure_url;
              }
            } catch (error) {
              console.error(`Cloudinary upload failed: ${String(error)}`);
            }
          }

          return { data: { ...user, image } };
        },
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
