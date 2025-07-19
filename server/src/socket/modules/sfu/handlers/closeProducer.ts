import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { HandlerInput } from "src/socket/core/types";
import { closeRelatedConsumers } from "../sfu.utils";

const closeProducerSchema = Type.Object({
  type: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
});

type Data = HandlerInput<{
  payload: Static<typeof closeProducerSchema>;
}>;

sfuModule.defineSocketHandler({
  event: "closeProducer",
  config: {
    schema: closeProducerSchema,
  },
  handler(ctx, params: Data) {
    const { socket, rooms } = ctx;
    const { payload } = params;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      console.log("Room not found");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("Peer not found");
      return;
    }

    const onConsumerClosed = (consumerId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      socket.broadcast.to(user.roomName!).emit("consumerClosed", consumerId);
    };

    switch (payload.type) {
      case "video": {
        const videoProducer = peer.producers.screenShare?.video;
        const systemAudioProducer = peer.producers.screenShare?.audio;
        if (!videoProducer) {
          console.log("Video producer not found");
          return;
        }
        videoProducer.close();
        systemAudioProducer?.close();

        socket.broadcast.to(user.roomName).emit("peerClosedProducer", {
          peerId: user.id,
          type: "screenShare",
        });

        closeRelatedConsumers(
          [videoProducer.id, systemAudioProducer?.id].filter(
            Boolean
          ) as string[],
          user.roomName,
          onConsumerClosed
        );
        peer.producers.screenShare = undefined;
        break;
      }
      case "audio": {
        const audioProducer = peer.producers.audio;
        if (!audioProducer) {
          console.log("Audio producer not found");
          return;
        }
        audioProducer.close();

        socket.broadcast.to(user.roomName).emit("peerClosedProducer", {
          peerId: user.id,
          type: "screenShare",
        });

        closeRelatedConsumers(
          [audioProducer.id],
          user.roomName,
          onConsumerClosed
        );

        peer.producers.audio = undefined;
        break;
      }
    }
  },
});
