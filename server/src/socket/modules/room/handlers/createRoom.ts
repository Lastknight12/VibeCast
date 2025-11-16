import { getMediasoupWorker } from "src/lib/worker";
import { RouterRtpCodecCapability } from "mediasoup/node/lib/types";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../utils/errors";
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
      const { data } = input;
      if (rooms.has(data.roomName)) {
        throw new SocketError(ApiRoomErrors.ALREADY_EXISTS);
      }

      if (!safeRoomRegexp.test(data.roomName)) {
        throw new SocketError(ApiRoomErrors.UNSAFE_NAME);
      }

      const worker = getMediasoupWorker();
      const router = await worker.createRouter({
        mediaCodecs,
      });

      const roomId = createRoom(router, data.roomType, data.roomName);

      if (data.roomType === "public") {
        socket.broadcast.emit("roomCreated", {
          name: data.roomName,
          id: roomId,
        });
        socket.emit("roomCreated", { name: data.roomName, id: roomId });
      }

      cb({ data: { id: roomId } });
    },
  });
}
