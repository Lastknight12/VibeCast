import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { cloudinary } from "./cloudinary";
import axios from "axios";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      clientId: process.env.GOOGLE_CLIENT_ID!,
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
  trustedOrigins: [process.env.FRONTEND_URL!],
});
