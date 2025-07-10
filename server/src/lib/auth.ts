import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { cloudinary } from "./cloudinary";
import axios from "axios";
import { env } from "../config";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      async mapProfileToUser(profile) {
        try {
          const res = await axios.get(profile.picture, {
            responseType: "arraybuffer",
          });

          const base64 = `data:image/jpeg;base64,${Buffer.from(res.data).toString("base64")}`;

          const uploadRes = await cloudinary.uploader.upload(base64, {
            folder: "avatars",
          });

          return {
            image: uploadRes.secure_url,
          };
        } catch (error) {
          console.error("Cloudinary upload failed:", error);
        }
      },
    },
  },
  trustedOrigins: [env.FRONTEND_URL],
});
