import { getMediasoupWorker } from "src/lib/worker";
import { RtpCodecCapability } from "mediasoup/node/lib/types";
import { PeersMap } from "src/lib/peersMap";
import { Static, Type } from "@sinclair/typebox";
import roomModule from "../index";
import { ErrorCb, HandlerInput } from "src/socket/core/types";
import { TypeCompiler } from "@sinclair/typebox/build/cjs/compiler";

const createRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
  roomType: Type.Union([Type.Literal("public"), Type.Literal("private")]),
});

type Data = HandlerInput<{
  payload: Static<typeof createRoomSchema>;
  cb: ErrorCb;
}>;

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
];

roomModule.defineSocketHandler({
  event: "createRoom",
  config: {
    schema: createRoomSchema,
    expectCb: true,
  },
  handler: async (ctx, data: Data) => {
    const { socket, rooms } = ctx;
    const { payload, cb } = data;

    if (rooms.has(payload.roomName)) {
      return cb({
        error: "Room already exists",
      });
    }

    const worker = getMediasoupWorker();
    const router = await worker.createRouter({
      mediaCodecs,
    });

    rooms.set(payload.roomName, {
      router,
      peers: new PeersMap(),
      type: payload.roomType,
    });

    if (payload.roomType === "public") {
      socket.broadcast.emit("roomCreated", payload.roomName);
      socket.emit("roomCreated", payload.roomName);
    }

    cb({
      error: undefined,
    });
  },
});
