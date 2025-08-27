import { Type } from "@sinclair/typebox";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import { errors } from "../../errors";
import { cloudinary } from "src/lib/cloudinary";
import streamifier from "streamifier";
import { logger } from "src/lib/logger";
import { UploadApiResponse } from "cloudinary";

const uploadThumbnailSchema = Type.Object({
  imageBuffer: Type.Any(),
});

export const thumbnails = new Map<string, string>();

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "uploadThumbnail",
    config: {
      protected: true,
      schema: uploadThumbnailSchema,
    },
    async handler(input) {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      await new Promise<UploadApiResponse>((resolve, reject) => {
        const cldUploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `thumbnails/${user.roomId}`,
            public_id: `${user.id}`,
          },
          (err, result) => {
            if (err) {
              logger.error(err.message);
              return reject(err);
            }

            if (!result) {
              const error = new Error(
                "Cloudinary upload failed: no result returned"
              );
              logger.error(error.message);
              return reject(error);
            }

            const url = result.secure_url + `?t=${Date.now()}`;

            thumbnails.set(user.id, url);
            resolve(result);

            socket.broadcast.emit("new-thumbnail", url, user.id);
          }
        );

        streamifier
          .createReadStream(Buffer.from(input.imageBuffer))
          .pipe(cldUploadStream);
      });
    },
  });
}
