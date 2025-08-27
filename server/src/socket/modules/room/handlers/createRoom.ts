import { getMediasoupWorker } from "src/lib/worker";
import { Router, RtpCodecCapability } from "mediasoup/node/lib/types";
import { PeersMap } from "src/lib/peersMap";
import { Static, Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../errors";

const createRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
  roomType: Type.Union([Type.Literal("public"), Type.Literal("private")]),
});

function createRoom(
  router: Router,
  roomType: Static<typeof createRoomSchema.properties.roomType>,
  name: string
) {
  const uuid = crypto.randomUUID();

  if (rooms.has(uuid)) {
    const uuid = createRoom(router, roomType, name);
    return uuid;
  }

  rooms.set(uuid, {
    name,
    router,
    peers: new PeersMap(),
    type: roomType,
  });

  return uuid;
}

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
];

const safeRoomRegexp = /^(?!.*\.\.)[a-zA-Z0-9/_\-.]+$/;

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

      if (!safeRoomRegexp.test(input.roomName)) {
        throw new SocketError(errors.room.UNSAFE_NAME);
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
