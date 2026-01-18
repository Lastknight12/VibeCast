import { Type } from "@sinclair/typebox";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../errors";
import { cloudinary } from "src/lib/cloudinary";
import streamifier from "streamifier";
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
      const {
        data,
        context: { logger, user },
      } = input;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      await new Promise<UploadApiResponse>((resolve, reject) => {
        const cldUploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `thumbnails`,
            public_id: user.id,
          },
          (err, result) => {
            if (err) {
              logger.error(err.message);
              return reject(err);
            }

            if (!result) {
              const error = new Error(
                "Cloudinary upload failed: no result returned",
              );
              logger.error(error.message);
              return reject(error);
            }

            thumbnails.set(user.id, result.secure_url);
            resolve(result);

            socket.broadcast.emit("new-thumbnail", {
              url: result.secure_url,
              userId: user.id,
            });
          },
        );

        streamifier
          .createReadStream(Buffer.from(data.imageBuffer))
          .pipe(cldUploadStream);
      });
    },
  });
}
