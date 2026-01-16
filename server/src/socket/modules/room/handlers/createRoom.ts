import { getMediasoupWorker } from "src/lib/worker";
import { RouterRtpCodecCapability } from "mediasoup/node/lib/types";
import { Type } from "@sinclair/typebox";
import { CustomSocket, SocketError } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { ApiRoomErrors } from "../errors";
import { chatMessagesState } from "src/state/chatMessages";

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
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/VP9",
    clockRate: 90000,
    parameters: {
      "profile-id": 2,
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/h264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "4d0032",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/h264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
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
      const roomExist = rooms.get(data.roomName)
      if (roomExist) {
        throw new SocketError(ApiRoomErrors.ALREADY_EXISTS);
      }

      if (!safeRoomRegexp.test(data.roomName)) {
        throw new SocketError(ApiRoomErrors.UNSAFE_NAME);
      }

      const worker = getMediasoupWorker();
      const router = await worker.createRouter({
        mediaCodecs,
      });

      const roomId = rooms.create(router, data.roomType, data.roomName);
      chatMessagesState.createChat(roomId);

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
