import { Type } from "@sinclair/typebox";
import { RtpParameters } from "mediasoup/node/lib/rtpParametersTypes";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { HandlerCallback, SocketError } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";
import ApiSfuError from "../utils/errors";

const rtcpFeedbackSchema = Type.Object({
  type: Type.String(),
  parameter: Type.String(),
});

const codecSchema = Type.Object({
  mimeType: Type.String(),
  payloadType: Type.Number(),
  clockRate: Type.Number(),
  channels: Type.Optional(Type.Number()),
  parameters: Type.Record(
    Type.String(),
    Type.Union([Type.String(), Type.Number()])
  ),
  rtcpFeedback: Type.Array(rtcpFeedbackSchema),
});

const headerExtensionSchema = Type.Object({
  uri: Type.String(),
  id: Type.Number(),
  encrypt: Type.Boolean(),
  parameters: Type.Record(Type.String(), Type.Any()),
});

const encodingSchema = Type.Object({
  ssrc: Type.Optional(Type.Number()), // present in audio encodings
  dtx: Type.Optional(Type.Boolean()),
  active: Type.Optional(Type.Boolean()), // present in video encodings
  scaleResolutionDownBy: Type.Optional(Type.Number()),
  maxBitrate: Type.Optional(Type.Number()),
  rid: Type.Optional(Type.String()),
  scalabilityMode: Type.Optional(Type.String()),
});

const rtcpSchema = Type.Object({
  cname: Type.String(),
  reducedSize: Type.Boolean(),
});

const rtpParametersSchema = Type.Object({
  mid: Type.String(),
  codecs: Type.Array(codecSchema),
  headerExtensions: Type.Array(headerExtensionSchema),
  encodings: Type.Array(encodingSchema),
  rtcp: rtcpSchema,
});

export const produceSchema = Type.Object({
  kind: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
  rtpParameters: rtpParametersSchema,
  appData: Type.Object({
    type: Type.Union([
      Type.Literal("audio"),
      Type.Literal("video"),
      Type.Literal("video_audio"),
    ]),
  }),
});

interface Result {
  id: string;
}

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "produce",
    config: {
      schema: produceSchema,
      protected: true,
      expectCb: true,
    },
    handler: async (input, cb: HandlerCallback<Result>) => {
      const { user } = socket.data;

      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) throw new SocketError(ApiRoomError.NOT_FOUND);

      const peer = room.peers.get(user.id);
      if (!peer) throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      if (!peer.transports.send)
        throw new SocketError(ApiSfuError.transport.SEND_TRANSPORT_NOT_FOUND);

      const producer = await peer.transports.send.produce({
        kind: input.kind,
        rtpParameters: input.rtpParameters as unknown as RtpParameters,
        appData: { type: input.appData.type },
      });

      switch (input.appData.type) {
        case "audio": {
          peer.producers.audio = producer;
          break;
        }
        case "video": {
          peer.producers.screenShare = { video: producer };
          break;
        }
        case "video_audio": {
          if (peer.producers.screenShare) {
            peer.producers.screenShare.audio = producer;
          }
          break;
        }
      }

      socket.broadcast
        .to(user.roomId)
        .emit("newProducer", producer.id, user.id, input.appData.type);
      cb({ data: { id: producer.id } });
    },
  });
}
