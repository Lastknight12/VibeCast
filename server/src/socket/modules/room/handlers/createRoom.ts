import { getMediasoupWorker } from "src/lib/worker";
import { RouterRtpCodecCapability } from "mediasoup/node/lib/types";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import ApiRoomError from "../utils/errors";
import { createRoom } from "../utils";

export const createRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
  roomType: Type.Union([Type.Literal("public"), Type.Literal("private")]),
});

const mediaCodecs: RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
];

const safeRoomRegexp = /^(?!.*\.\.)[a-zA-Z0-9._~-]+$/;

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "createRoom",
    config: {
      schema: createRoomSchema,
      protected: true,
      expectCb: true,
    },
    handler: async (input, cb) => {
      if (rooms.has(input.roomName)) {
        throw new SocketError(ApiRoomError.ALREADY_EXISTS);
      }

      if (!safeRoomRegexp.test(input.roomName)) {
        throw new SocketError(ApiRoomError.UNSAFE_NAME);
      }

      const worker = getMediasoupWorker();
      const router = await worker.createRouter({
        mediaCodecs,
      });

      const roomId = createRoom(router, input.roomType, input.roomName);

      if (input.roomType === "public") {
        socket.broadcast.emit("roomCreated", {
          name: input.roomName,
          id: roomId,
        });
        socket.emit("roomCreated", { name: input.roomName, id: roomId });
      }

      cb({ data: { id: roomId } });
    },
  });
}
