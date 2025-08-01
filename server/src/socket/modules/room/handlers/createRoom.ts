import { getMediasoupWorker } from "src/lib/worker";
import { RtpCodecCapability } from "mediasoup/node/lib/types";
import { PeersMap } from "src/lib/peersMap";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../errors";

const createRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
  roomType: Type.Union([Type.Literal("public"), Type.Literal("private")]),
});

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
];

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
        throw new SocketError(errors.room.ALREADY_EXISTS);
      }

      const worker = getMediasoupWorker();
      const router = await worker.createRouter({
        mediaCodecs,
      });

      rooms.set(input.roomName, {
        router,
        peers: new PeersMap(),
        type: input.roomType,
      });

      if (input.roomType === "public") {
        socket.broadcast.emit("roomCreated", input.roomName);
        socket.emit("roomCreated", input.roomName);
      }

      cb({ data: { success: true } });
    },
  });
}
