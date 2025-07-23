import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { ErrorCb, HandlerInput } from "src/socket/core";
import { RtpParameters } from "mediasoup/node/lib/rtpParametersTypes";
import { ProducerType } from "mediasoup/node/lib/ProducerTypes";

const rtpCodecParametersSchema = Type.Object({
  mimeType: Type.String(),
  payloadType: Type.Number(),
  clockRate: Type.Number(),
  channels: Type.Optional(Type.Number()),
  parameters: Type.Optional(Type.Record(Type.String(), Type.Any())),
  rtcpFeedback: Type.Optional(
    Type.Array(
      Type.Object({
        type: Type.String(),
        parameter: Type.Optional(Type.String()),
      })
    )
  ),
});

const rtpEncodingParametersSchema = Type.Object({
  ssrc: Type.Optional(Type.Number()),
  rid: Type.Optional(Type.String()),
  scalabilityMode: Type.Optional(Type.String()),
  dtx: Type.Optional(Type.Boolean()),
  active: Type.Optional(Type.Boolean()),
  maxBitrate: Type.Optional(Type.Number()),
  maxFramerate: Type.Optional(Type.Number()),
  scaleResolutionDownBy: Type.Optional(Type.Number()),
});

const rtpHeaderExtensionParametersSchema = Type.Object({
  uri: Type.String(),
  id: Type.Number(),
  encrypt: Type.Optional(Type.Boolean()),
  parameters: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const rtcpParametersSchema = Type.Object({
  cname: Type.Optional(Type.String()),
  reducedSize: Type.Optional(Type.Boolean()),
});

const rtpParametersSchema = Type.Object({
  codecs: Type.Array(rtpCodecParametersSchema),
  encodings: Type.Array(rtpEncodingParametersSchema),
  headerExtensions: Type.Optional(
    Type.Array(rtpHeaderExtensionParametersSchema)
  ),
  rtcp: Type.Optional(rtcpParametersSchema),
  mid: Type.Optional(Type.String()),
});

const produceSchema = Type.Object({
  parameters: Type.Object({
    kind: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
    rtpParameters: rtpParametersSchema,
    appData: Type.Object({
      type: Type.Union([
        Type.Literal("audio"),
        Type.Literal("video"),
        Type.Literal("video_audio"),
      ]),
    }),
  }),
});

type Data = HandlerInput<{
  payload: Static<typeof produceSchema>;
  cb: (data: { id: string } | Parameters<ErrorCb>[0]) => void;
}>;

sfuModule.defineSocketHandler({
  event: "produce",
  config: {
    schema: produceSchema,
    expectCb: true,
  },
  handler: async (ctx, params: Data) => {
    const { socket, rooms } = ctx;
    const { payload, cb } = params;

    const { user } = socket.data;

    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });
    if (!peer.transports.send) return cb({ error: "Transport not found" });

    const producer = await peer.transports.send.produce({
      kind: payload.parameters.kind,
      rtpParameters: payload.parameters.rtpParameters as RtpParameters,
    });

    switch (payload.parameters.appData.type) {
      case "audio": {
        peer.producers.audio = producer;
        break;
      }
      case "video": {
        peer.producers.screenShare = { video: producer };
        break;
      }
      case "video_audio": {
        // TODO: throw error if no screenshare producer provided
        if (peer.producers.screenShare) {
          peer.producers.screenShare.audio = producer;
        }
        break;
      }
    }

    cb({ id: producer.id });

    socket.broadcast
      .to(user.roomName)
      .emit(
        "newProducer",
        producer.id,
        user.id,
        payload.parameters.appData.type as ProducerType
      );
  },
});
